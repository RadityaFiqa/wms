import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AnalyticsUnitGroup,
  FlowGranularity,
  FlowInOut,
  FlowSkuPoint,
  FlowTrendGroup,
  FlowTrendQueryInput,
  FlowTrendResponse,
  FlowTrendSku,
  InboundDocument,
  InboundProduct,
  InboundSender,
  InboundStack,
  StockInboundResponse,
  StockOriginCategory,
} from '@bulog-wms/schema';
import { PrismaService } from '@/core/prisma/prisma.service';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import {
  formatDateInTimezone,
  getLocalEndOfDay,
  getLocalStartOfDay,
} from '@/core/utils/date';
import {
  classifyOrigin,
  cleanPartnerName,
  compareUnitGroups,
  getCommodityCategory,
  getProductPrograms,
  getUnitGroup,
  isProductProgram,
  PRODUCT_PROGRAMS,
  round3,
} from '@/modules/reports/analytics.utils';
import { listPeriods, shiftMonth } from '@/modules/reports/analytics-periods';

// Commodity category of an ERP item, same rule as getCommodityCategory
const ITEM_CATEGORY_SQL = Prisma.sql`upper(split_part(regexp_replace(i."productName", '^\\s*\\[[^]]*\\]\\s*', ''), ' ', 1))`;

const NOT_RECORDED = 'Tidak tercatat';

type FlowRow = {
  period: string;
  pickingTypeCode: 'incoming' | 'outgoing';
  productUuid: string;
  sku: string;
  name: string;
  uom: string | null;
  qty: number;
};

type OriginRow = {
  inventoryId: number;
  lotName: string;
  uuid: string;
  documentNumber: string;
  partnerName: string | null;
  purchaseName: string | null;
  origin: string | null;
  sourceLocationName: string | null;
  dateDone: Date | null;
  qty: number;
};

type LotOrigin = {
  sender: string;
  originCategory: StockOriginCategory;
  qty: number;
  document: InboundDocument;
};

type GroupAccumulator = {
  group: AnalyticsUnitGroup;
  points: Map<string, FlowInOut>;
  totals: FlowInOut;
  thisMonth: FlowInOut;
  lastMonth: FlowInOut;
  skus: Map<string, FlowTrendSku>;
  skuPoints: Map<string, FlowSkuPoint>;
};

const emptyFlow = (): FlowInOut => ({ in: 0, out: 0 });
const roundFlow = (f: FlowInOut): FlowInOut => ({
  in: round3(f.in),
  out: round3(f.out),
});

@Injectable()
export class ReportsAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  /**
   * Incoming vs outgoing goods of done ERP documents per period, one series per unit
   * group found in the data (Kg in Ton, L in KL, other UoMs as they are), with the
   * per-SKU breakdown. Internal transfers are left out: they only move goods between
   * locations of the same warehouse.
   */
  async getFlowTrend(
    warehouseId: number,
    query: FlowTrendQueryInput,
  ): Promise<FlowTrendResponse> {
    const timezone = this.warehouseContext.getTimezone();
    const filters = { category: query.category, account: query.account };

    const today = formatDateInTimezone(new Date(), timezone);
    const thisMonthStart = `${today.slice(0, 7)}-01`;
    const lastMonthStart = shiftMonth(thisMonthStart, -1);

    const [rows, monthRows, { categories, programs }] = await Promise.all([
      this.aggregateFlow(
        warehouseId,
        timezone,
        query.granularity,
        getLocalStartOfDay(query.startDate, timezone),
        getLocalEndOfDay(query.endDate, timezone),
        filters,
      ),
      this.aggregateFlow(
        warehouseId,
        timezone,
        'month',
        getLocalStartOfDay(lastMonthStart, timezone),
        getLocalEndOfDay(today, timezone),
        filters,
      ),
      this.getFlowCategories(warehouseId),
    ]);

    // SKU options come from every row in the range, before the SKU filter
    const skuOptions = new Map<
      string,
      FlowTrendSku & { category: string; programs: string[] }
    >();
    for (const row of rows) {
      if (!skuOptions.has(row.productUuid)) {
        skuOptions.set(row.productUuid, {
          productUuid: row.productUuid,
          sku: row.sku,
          name: row.name,
          category: getCommodityCategory(row.name),
          programs: getProductPrograms(row.name),
        });
      }
    }

    const periods = listPeriods(
      query.startDate,
      query.endDate,
      query.granularity,
    );
    const groups = new Map<string, GroupAccumulator>();
    const groupFor = (group: AnalyticsUnitGroup) => {
      let acc = groups.get(group.key);
      if (!acc) {
        acc = {
          group,
          points: new Map(periods.map((p) => [p, emptyFlow()])),
          totals: emptyFlow(),
          thisMonth: emptyFlow(),
          lastMonth: emptyFlow(),
          skus: new Map(),
          skuPoints: new Map(),
        };
        groups.set(group.key, acc);
      }
      return acc;
    };
    const matchesSku = (row: FlowRow) =>
      !query.productUuid || row.productUuid === query.productUuid;

    for (const row of rows) {
      if (!matchesSku(row)) continue;
      const { group, toDisplay } = getUnitGroup(row.uom);
      const value = Number(row.qty) * toDisplay;
      const side = row.pickingTypeCode === 'incoming' ? 'in' : 'out';
      const acc = groupFor(group);

      const point = acc.points.get(row.period);
      if (!point) continue;
      point[side] += value;
      acc.totals[side] += value;

      acc.skus.set(row.productUuid, {
        productUuid: row.productUuid,
        sku: row.sku,
        name: row.name,
      });
      const skuKey = `${row.period}|${row.productUuid}`;
      const skuPoint = acc.skuPoints.get(skuKey) || {
        period: row.period,
        productUuid: row.productUuid,
        in: 0,
        out: 0,
      };
      skuPoint[side] += value;
      acc.skuPoints.set(skuKey, skuPoint);
    }

    for (const row of monthRows) {
      if (!matchesSku(row)) continue;
      const { group, toDisplay } = getUnitGroup(row.uom);
      const acc = groups.get(group.key);
      if (!acc) continue; // no movement of this unit in the selected range
      const side = row.pickingTypeCode === 'incoming' ? 'in' : 'out';
      const value = Number(row.qty) * toDisplay;
      if (row.period === thisMonthStart) acc.thisMonth[side] += value;
      else if (row.period === lastMonthStart) acc.lastMonth[side] += value;
    }

    const result: FlowTrendGroup[] = Array.from(groups.values())
      .sort((a, b) => compareUnitGroups(a.group, b.group))
      .map((acc) => ({
        ...acc.group,
        points: Array.from(acc.points.entries()).map(([period, f]) => ({
          period,
          ...roundFlow(f),
        })),
        totals: roundFlow(acc.totals),
        thisMonth: roundFlow(acc.thisMonth),
        lastMonth: roundFlow(acc.lastMonth),
        skus: Array.from(acc.skus.values()).sort((a, b) =>
          a.sku.localeCompare(b.sku),
        ),
        skuPoints: Array.from(acc.skuPoints.values()).map((p) => ({
          ...p,
          in: round3(p.in),
          out: round3(p.out),
        })),
      }));

    return {
      granularity: query.granularity,
      groups: result,
      categories,
      programs,
      skuOptions: Array.from(skuOptions.values()).sort((a, b) =>
        a.sku.localeCompare(b.sku),
      ),
    };
  }

  /**
   * Current stock grouped product → sender (partner of the done incoming document that
   * received the lot) → stack → lot. A lot received from several senders is split by
   * the quantity each one delivered.
   */
  async getStockInbound(warehouseId: number): Promise<StockInboundResponse> {
    const quants = await this.prisma.quant.findMany({
      where: { quantity: { gt: 0 }, location: { warehouseId } },
      include: {
        location: { select: { uuid: true, displayName: true } },
        inventory: { select: { uuid: true, sku: true, name: true, uom: true } },
      },
    });

    const originsByLot = await this.getLotOrigins(warehouseId, quants);

    const products = new Map<number, InboundProduct>();
    const productStacks = new Map<number, Set<number>>();
    const totals = new Map<
      string,
      AnalyticsUnitGroup & { displayQty: number }
    >();
    const locationIds = new Set<number>();

    for (const q of quants) {
      const { group, toDisplay } = getUnitGroup(q.inventory.uom);
      locationIds.add(q.locationId);

      const total = totals.get(group.key) || { ...group, displayQty: 0 };
      total.displayQty += q.quantity * toDisplay;
      totals.set(group.key, total);

      let product = products.get(q.inventoryId);
      if (!product) {
        product = {
          productUuid: q.inventory.uuid,
          sku: q.inventory.sku,
          name: q.inventory.name,
          category: getCommodityCategory(q.inventory.name),
          uom: q.inventory.uom || 'Unit',
          unit: group,
          qty: 0,
          displayQty: 0,
          stackCount: 0,
          senders: [],
        };
        products.set(q.inventoryId, product);
        productStacks.set(q.inventoryId, new Set());
      }
      product.qty += q.quantity;
      product.displayQty += q.quantity * toDisplay;
      productStacks.get(q.inventoryId)!.add(q.locationId);

      // Split the stack quantity over the senders of its lot
      const origins = q.lotName
        ? originsByLot.get(`${q.inventoryId}|${q.lotName}`) || []
        : [];
      const receivedTotal = origins.reduce((sum, o) => sum + o.qty, 0);
      const bySender = new Map<
        string,
        {
          originCategory: StockOriginCategory;
          share: number;
          docs: InboundDocument[];
        }
      >();
      if (receivedTotal > 0) {
        for (const o of origins) {
          const entry = bySender.get(o.sender) || {
            originCategory: o.originCategory,
            share: 0,
            docs: [],
          };
          entry.share += o.qty / receivedTotal;
          entry.docs.push(o.document);
          bySender.set(o.sender, entry);
        }
      } else {
        bySender.set(NOT_RECORDED, {
          originCategory: 'Tidak tercatat',
          share: 1,
          docs: [],
        });
      }

      for (const [senderName, entry] of bySender) {
        const qty = q.quantity * entry.share;
        const displayQty = qty * toDisplay;

        let sender = product.senders.find((s) => s.name === senderName);
        if (!sender) {
          sender = {
            name: senderName,
            originCategory: entry.originCategory,
            displayQty: 0,
            stacks: [],
          };
          product.senders.push(sender);
        }
        sender.displayQty += displayQty;

        let stack = sender.stacks.find(
          (s) => s.locationUuid === q.location.uuid,
        );
        if (!stack) {
          stack = {
            locationUuid: q.location.uuid,
            locationName: q.location.displayName,
            displayQty: 0,
            lots: [],
          };
          sender.stacks.push(stack);
        }
        stack.displayQty += displayQty;
        stack.lots.push({
          lotName: q.lotName,
          qty: round3(qty),
          displayQty: round3(displayQty),
          documents: entry.docs.sort((a, b) =>
            (b.dateDone || '').localeCompare(a.dateDone || ''),
          ),
        });
      }
    }

    const sortStacks = (stacks: InboundStack[]) =>
      stacks
        .map((s) => ({
          ...s,
          displayQty: round3(s.displayQty),
          lots: s.lots.sort((a, b) => b.displayQty - a.displayQty),
        }))
        .sort((a, b) => b.displayQty - a.displayQty);
    const sortSenders = (senders: InboundSender[]) =>
      senders
        .map((s) => ({
          ...s,
          displayQty: round3(s.displayQty),
          stacks: sortStacks(s.stacks),
        }))
        // Unrecorded origin always last
        .sort(
          (a, b) =>
            Number(a.name === NOT_RECORDED) - Number(b.name === NOT_RECORDED) ||
            b.displayQty - a.displayQty,
        );

    return {
      totals: Array.from(totals.values())
        .sort(compareUnitGroups)
        .map((t) => ({ ...t, displayQty: round3(t.displayQty) })),
      stackCount: locationIds.size,
      productCount: products.size,
      products: Array.from(products.entries())
        .map(([inventoryId, p]) => ({
          ...p,
          qty: round3(p.qty),
          displayQty: round3(p.displayQty),
          stackCount: productStacks.get(inventoryId)!.size,
          senders: sortSenders(p.senders),
        }))
        .sort(
          (a, b) =>
            compareUnitGroups(a.unit, b.unit) || b.displayQty - a.displayQty,
        ),
    };
  }

  private aggregateFlow(
    warehouseId: number,
    timezone: string,
    granularity: FlowGranularity,
    start: Date,
    end: Date,
    filters: { category?: string; account?: string },
  ): Promise<FlowRow[]> {
    // A program (SPHP, BANTUAN PANGAN) matches whole words anywhere in the product name,
    // a commodity matches the first word
    const categoryFilter = !filters.category
      ? Prisma.empty
      : isProductProgram(filters.category)
        ? Prisma.sql`AND (' ' || regexp_replace(upper(i."productName"), '\\s+', ' ', 'g') || ' ') LIKE ${`% ${filters.category.toUpperCase()} %`}`
        : Prisma.sql`AND ${ITEM_CATEGORY_SQL} = ${filters.category.toUpperCase()}`;
    const accountFilter = filters.account
      ? Prisma.sql`AND i."analyticAccountName" = ${filters.account}`
      : Prisma.empty;

    return this.prisma.$queryRaw<FlowRow[]>`
      SELECT
        to_char(date_trunc(${granularity}, d."dateDone" AT TIME ZONE ${timezone}), 'YYYY-MM-DD') AS "period",
        d."pickingTypeCode" AS "pickingTypeCode",
        inv.uuid AS "productUuid",
        inv.sku AS "sku",
        inv.name AS "name",
        i.uom AS "uom",
        SUM(i."productQty")::float8 AS "qty"
      FROM "DocumentReference" d
      JOIN "DocumentReferenceItem" i ON i."documentReferenceId" = d.id
      JOIN "Inventory" inv ON inv.id = i."inventoryId"
      WHERE d."warehouseId" = ${warehouseId}
        AND d.state = 'done'
        AND d."pickingTypeCode" IN ('incoming', 'outgoing')
        AND d."dateDone" >= ${start}
        AND d."dateDone" <= ${end}
        ${categoryFilter}
        ${accountFilter}
      GROUP BY 1, 2, 3, 4, 5, 6
    `;
  }

  /** Commodity categories (most items first) and programs found in the warehouse's documents */
  private async getFlowCategories(
    warehouseId: number,
  ): Promise<{ categories: string[]; programs: string[] }> {
    const rows = await this.prisma.$queryRaw<{ name: string; n: number }[]>`
      SELECT i."productName" AS "name", COUNT(*)::int AS "n"
      FROM "DocumentReference" d
      JOIN "DocumentReferenceItem" i ON i."documentReferenceId" = d.id
      WHERE d."warehouseId" = ${warehouseId}
        AND d.state = 'done'
        AND d."pickingTypeCode" IN ('incoming', 'outgoing')
      GROUP BY 1
    `;
    const counts = new Map<string, number>();
    const programs = new Set<string>();
    for (const row of rows) {
      const category = getCommodityCategory(row.name);
      counts.set(category, (counts.get(category) || 0) + Number(row.n));
      for (const program of getProductPrograms(row.name)) programs.add(program);
    }
    return {
      categories: Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([category]) => category),
      programs: PRODUCT_PROGRAMS.filter((p) => programs.has(p)),
    };
  }

  /** Done incoming documents per `${inventoryId}|${lotName}` */
  private async getLotOrigins(
    warehouseId: number,
    quants: { inventoryId: number; lotName: string | null }[],
  ): Promise<Map<string, LotOrigin[]>> {
    const lotted = quants.filter((q) => q.lotName);
    const result = new Map<string, LotOrigin[]>();
    if (lotted.length === 0) return result;

    const inventoryIds = Array.from(new Set(lotted.map((q) => q.inventoryId)));
    const lotNames = Array.from(
      new Set(lotted.map((q) => q.lotName as string)),
    );

    const rows = await this.prisma.$queryRaw<OriginRow[]>`
      SELECT
        ml."inventoryId" AS "inventoryId",
        ml."lotName" AS "lotName",
        d.uuid AS "uuid",
        d."documentNumber" AS "documentNumber",
        d."partnerName" AS "partnerName",
        d."purchaseName" AS "purchaseName",
        d.origin AS "origin",
        d."sourceLocationName" AS "sourceLocationName",
        d."dateDone" AS "dateDone",
        SUM(ml.quantity)::float8 AS "qty"
      FROM "DocumentReferenceMoveLine" ml
      JOIN "DocumentReference" d ON d.id = ml."documentReferenceId"
      WHERE d."warehouseId" = ${warehouseId}
        AND d.state = 'done'
        AND d."pickingTypeCode" = 'incoming'
        AND ml."inventoryId" = ANY(${inventoryIds}::int[])
        AND ml."lotName" = ANY(${lotNames}::text[])
      GROUP BY ml."inventoryId", ml."lotName", d.id
    `;

    for (const row of rows) {
      const key = `${row.inventoryId}|${row.lotName}`;
      const list = result.get(key) || [];
      list.push({
        sender: cleanPartnerName(row.partnerName) || 'Lainnya',
        originCategory: classifyOrigin(row),
        qty: Number(row.qty),
        document: {
          documentUuid: row.uuid,
          documentNumber: row.documentNumber,
          dateDone: row.dateDone ? row.dateDone.toISOString() : null,
        },
      });
      result.set(key, list);
    }
    return result;
  }
}

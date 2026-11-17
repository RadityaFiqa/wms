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
  InboundLot,
  InboundProduct,
  InboundSender,
  InboundStack,
  StockInboundResponse,
  StockOriginCategory,
} from '@bulog-wms/schema';
import { PrismaService } from '@/core/prisma/prisma.service';
import { PENDING_GATE_PRODUCT_WHERE } from '@/core/utils/stock-reconciliation';
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
import { StockFolderService } from '@/modules/reports/stock-folder.service';
import {
  groupSendersByFolder,
  NOT_RECORDED_SENDER,
} from '@/modules/reports/stock-folder.utils';

// Commodity category of an ERP item, same rule as getCommodityCategory
const ITEM_CATEGORY_SQL = Prisma.sql`upper(split_part(regexp_replace(i."productName", '^\\s*\\[[^]]*\\]\\s*', ''), ' ', 1))`;

const NOT_RECORDED = NOT_RECORDED_SENDER;

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
  destinationLocationId: number | null;
  qty: number;
};

type LotOrigin = {
  sender: string;
  originCategory: StockOriginCategory;
  /** Stack the lot was received into */
  locationId: number | null;
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
    private readonly folders: StockFolderService,
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
   * the quantity each one delivered into that stack; when the lot never came in directly
   * there (moved internally), by what each one delivered into the warehouse. Senders
   * and lots are then split over the product's manual folders. Totals are in Ton, the
   * product tree in Kg.
   */
  async getStockInbound(warehouseId: number): Promise<StockInboundResponse> {
    const [quants, pendingLines] = await Promise.all([
      this.prisma.quant.findMany({
        where: { quantity: { gt: 0 }, location: { warehouseId } },
        include: {
          location: { select: { uuid: true, displayName: true } },
          inventory: {
            select: { uuid: true, sku: true, name: true, uom: true },
          },
        },
      }),
      this.getPendingGateLines(warehouseId),
    ]);

    const [originsByLot, foldersByProduct] = await Promise.all([
      this.getLotOrigins(warehouseId, [
        ...quants,
        ...pendingLines.filter((l) => l.lotName),
      ]),
      this.folders.getByProduct(warehouseId),
    ]);

    type ProductAccumulator = Omit<InboundProduct, 'groups' | 'senderCount'> & {
      senders: InboundSender[];
    };
    type ProductRef = {
      uuid: string;
      sku: string;
      name: string;
      uom: string | null;
    };
    type LocationRef = { id: number; uuid: string; displayName: string };
    type SenderShare = {
      originCategory: StockOriginCategory;
      share: number;
      docs: InboundDocument[];
    };

    const products = new Map<number, ProductAccumulator>();
    const productStacks = new Map<number, Set<number>>();
    const totals = new Map<
      string,
      AnalyticsUnitGroup & { displayQty: number; pendingDisplayQty: number }
    >();
    const locationIds = new Set<number>();

    /** Adds a quantity (negative for pending OUT) to the totals and the product */
    const addToProduct = (
      inventoryId: number,
      inventory: ProductRef,
      location: LocationRef,
      qty: number,
      pending: boolean,
    ) => {
      const totalUnit = getUnitGroup(inventory.uom);
      const { group, toDisplay } = getUnitGroup(inventory.uom, {
        weightInKg: true,
      });
      locationIds.add(location.id);

      const total = totals.get(totalUnit.group.key) || {
        ...totalUnit.group,
        displayQty: 0,
        pendingDisplayQty: 0,
      };
      total.displayQty += qty * totalUnit.toDisplay;
      if (pending) total.pendingDisplayQty += qty * totalUnit.toDisplay;
      totals.set(totalUnit.group.key, total);

      let product = products.get(inventoryId);
      if (!product) {
        product = {
          productUuid: inventory.uuid,
          sku: inventory.sku,
          name: inventory.name,
          category: getCommodityCategory(inventory.name),
          uom: inventory.uom || 'Unit',
          unit: group,
          qty: 0,
          displayQty: 0,
          pendingQty: 0,
          pendingDisplayQty: 0,
          stackCount: 0,
          senders: [],
        };
        products.set(inventoryId, product);
        productStacks.set(inventoryId, new Set());
      }
      product.qty += qty;
      product.displayQty += qty * toDisplay;
      if (pending) {
        product.pendingQty += qty;
        product.pendingDisplayQty += qty * toDisplay;
      }
      productStacks.get(inventoryId)!.add(location.id);
      return { product, toDisplay };
    };

    /** Senders of a lot in a stack and the share each one delivered */
    const senderShares = (
      inventoryId: number,
      lotName: string | null,
      locationId: number,
    ) => {
      const lotOrigins = lotName
        ? originsByLot.get(`${inventoryId}|${lotName}`) || []
        : [];
      // A lot can come back into a stack later (e.g. returns), so prefer what was
      // received into this stack over the warehouse-wide receipts
      const intoStack = lotOrigins.filter((o) => o.locationId === locationId);
      const origins = intoStack.length > 0 ? intoStack : lotOrigins;
      const receivedTotal = origins.reduce((sum, o) => sum + o.qty, 0);
      const bySender = new Map<string, SenderShare>();
      if (receivedTotal > 0) {
        for (const o of origins) {
          const entry = bySender.get(o.sender) || {
            originCategory: o.originCategory,
            share: 0,
            docs: [],
          };
          entry.share += o.qty / receivedTotal;
          if (
            !entry.docs.some((d) => d.documentUuid === o.document.documentUuid)
          ) {
            entry.docs.push(o.document);
          }
          bySender.set(o.sender, entry);
        }
      } else {
        bySender.set(NOT_RECORDED, {
          originCategory: 'Tidak tercatat',
          share: 1,
          docs: [],
        });
      }
      return bySender;
    };

    const addLot = (
      product: ProductAccumulator,
      senderName: string,
      originCategory: StockOriginCategory,
      location: LocationRef,
      lot: InboundLot,
    ) => {
      let sender = product.senders.find((s) => s.name === senderName);
      if (!sender) {
        sender = {
          name: senderName,
          originCategory,
          displayQty: 0,
          pendingDisplayQty: 0,
          pendingGateCount: 0,
          stacks: [],
        };
        product.senders.push(sender);
      }
      sender.displayQty += lot.displayQty;

      let stack = sender.stacks.find((s) => s.locationUuid === location.uuid);
      if (!stack) {
        stack = {
          locationUuid: location.uuid,
          locationName: location.displayName,
          displayQty: 0,
          lots: [],
        };
        sender.stacks.push(stack);
      }
      stack.displayQty += lot.displayQty;
      stack.lots.push({
        ...lot,
        qty: round3(lot.qty),
        displayQty: round3(lot.displayQty),
      });
    };

    for (const q of quants) {
      const location = { id: q.locationId, ...q.location };
      const { product, toDisplay } = addToProduct(
        q.inventoryId,
        q.inventory,
        location,
        q.quantity,
        false,
      );
      // Split the stack quantity over the senders of its lot
      const shares = senderShares(q.inventoryId, q.lotName, q.locationId);
      for (const [senderName, entry] of shares) {
        const qty = q.quantity * entry.share;
        addLot(product, senderName, entry.originCategory, location, {
          lotName: q.lotName,
          qty,
          displayQty: qty * toDisplay,
          documents: entry.docs.sort((a, b) =>
            (b.dateDone || '').localeCompare(a.dateDone || ''),
          ),
          pendingGate: null,
        });
      }
    }

    // Gate lines not yet administered: IN under the gate's sender, OUT taken off the
    // senders of the lot it left from
    for (const line of pendingLines) {
      const signed =
        line.gate.cardType === 'OUT' ? -line.quantity : line.quantity;
      const { product, toDisplay } = addToProduct(
        line.inventoryId,
        line.inventory,
        line.location,
        signed,
        true,
      );
      const shares: Map<string, SenderShare> =
        line.gate.cardType === 'IN'
          ? new Map([
              [
                line.senderName,
                { originCategory: line.originCategory, share: 1, docs: [] },
              ],
            ])
          : senderShares(line.inventoryId, line.lotName, line.location.id);
      for (const [senderName, entry] of shares) {
        const qty = signed * entry.share;
        addLot(product, senderName, entry.originCategory, line.location, {
          lotName: line.lotName,
          qty,
          displayQty: qty * toDisplay,
          documents: [],
          pendingGate: line.gate,
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
        .map((t) => ({
          ...t,
          displayQty: round3(t.displayQty),
          pendingDisplayQty: round3(t.pendingDisplayQty),
        })),
      stackCount: locationIds.size,
      productCount: products.size,
      products: Array.from(products.entries())
        .map(([inventoryId, { senders, ...p }]): InboundProduct => {
          const productFolders = foldersByProduct.get(inventoryId);
          return {
            ...p,
            qty: round3(p.qty),
            displayQty: round3(p.displayQty),
            pendingQty: round3(p.pendingQty),
            pendingDisplayQty: round3(p.pendingDisplayQty),
            stackCount: productStacks.get(inventoryId)!.size,
            senderCount: senders.length,
            groups: groupSendersByFolder(
              sortSenders(senders),
              productFolders?.folders ?? [],
              productFolders?.placements ?? new Map<string, number | null>(),
              p.displayQty,
            ),
          };
        })
        .sort(
          (a, b) =>
            compareUnitGroups(a.unit, b.unit) || b.displayQty - a.displayQty,
        ),
    };
  }

  /**
   * Gate lines not yet administered in this warehouse (same rule as the reconciliation
   * page), with the stack they went into or out of and, for IN, their sender.
   */
  private async getPendingGateLines(warehouseId: number) {
    const rows = await this.prisma.gateOperationProduct.findMany({
      where: {
        ...PENDING_GATE_PRODUCT_WHERE,
        gateOperation: {
          warehouseId,
          status: { notIn: ['CANCELED', 'REJECTED'] },
        },
      },
      select: {
        inventoryId: true,
        quantity: true,
        inventory: { select: { uuid: true, sku: true, name: true, uom: true } },
        location: {
          select: {
            id: true,
            uuid: true,
            displayName: true,
            warehouseId: true,
          },
        },
        quant: {
          select: {
            lotName: true,
            location: {
              select: {
                id: true,
                uuid: true,
                displayName: true,
                warehouseId: true,
              },
            },
          },
        },
        documentReference: { select: { partnerName: true } },
        gateOperation: {
          select: {
            uuid: true,
            opNumber: true,
            cardType: true,
            clientPartner: true,
            createdAt: true,
            documentReference: { select: { partnerName: true } },
          },
        },
      },
    });

    return rows.flatMap((row) => {
      const location = row.location ?? row.quant?.location;
      // A line without a stack in this warehouse cannot be placed in the tree
      if (
        !location ||
        location.warehouseId !== warehouseId ||
        row.quantity <= 0
      ) {
        return [];
      }
      const gate = row.gateOperation;
      const partnerName =
        gate.clientPartner ||
        row.documentReference?.partnerName ||
        gate.documentReference?.partnerName ||
        null;
      const cardType: 'IN' | 'OUT' = gate.cardType === 'OUT' ? 'OUT' : 'IN';
      return [
        {
          inventoryId: row.inventoryId,
          lotName: row.quant?.lotName ?? null,
          quantity: row.quantity,
          inventory: row.inventory,
          location: {
            id: location.id,
            uuid: location.uuid,
            displayName: location.displayName,
          },
          senderName: cleanPartnerName(partnerName) || 'Lainnya',
          originCategory: classifyOrigin({
            partnerName,
            purchaseName: null,
            origin: null,
            sourceLocationName: null,
          }),
          gate: {
            gateOperationUuid: gate.uuid,
            opNumber: gate.opNumber,
            cardType,
            date: gate.createdAt.toISOString(),
          },
        },
      ];
    });
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
        ml."destinationLocationId" AS "destinationLocationId",
        SUM(ml.quantity)::float8 AS "qty"
      FROM "DocumentReferenceMoveLine" ml
      JOIN "DocumentReference" d ON d.id = ml."documentReferenceId"
      WHERE d."warehouseId" = ${warehouseId}
        AND d.state = 'done'
        AND d."pickingTypeCode" = 'incoming'
        AND ml."inventoryId" = ANY(${inventoryIds}::int[])
        AND ml."lotName" = ANY(${lotNames}::text[])
      GROUP BY ml."inventoryId", ml."lotName", d.id, ml."destinationLocationId"
    `;

    for (const row of rows) {
      const key = `${row.inventoryId}|${row.lotName}`;
      const list = result.get(key) || [];
      list.push({
        sender: cleanPartnerName(row.partnerName) || 'Lainnya',
        originCategory: classifyOrigin(row),
        locationId: row.destinationLocationId,
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

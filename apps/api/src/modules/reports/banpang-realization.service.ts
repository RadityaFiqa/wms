import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  BanpangRealizationQueryInput,
  BanpangRealizationResponse,
} from '@bulog-wms/schema';
import { PrismaService } from '@/core/prisma/prisma.service';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import { getLocalEndOfDay, getLocalStartOfDay } from '@/core/utils/date';
import {
  BANPANG_PARTNER_NAME,
  DONE_STATE,
  EXCLUDED_STATES,
  groupBanpangRealization,
  normalizePickingRef,
} from '@/modules/reports/banpang-realization.utils';
import { BanpangFolderService } from '@/modules/reports/banpang-folder.service';

@Injectable()
export class BanpangRealizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseContext: WarehouseContextService,
    private readonly folders: BanpangFolderService,
  ) {}

  /**
   * Outgoing ERP documents of Badan Pangan Nasional in the date range, except
   * cancelled and draft ones, grouped by sales order and destination (picking_ref).
   * Documents not done yet are placed on their scheduled date with their demand.
   * Returns are left out.
   */
  async getRealization(
    warehouseId: number,
    query: BanpangRealizationQueryInput,
  ): Promise<BanpangRealizationResponse> {
    const timezone = this.warehouseContext.getTimezone();
    const range = {
      gte: getLocalStartOfDay(query.startDate, timezone),
      lte: getLocalEndOfDay(query.endDate, timezone),
    };
    const [folders, documents] = await Promise.all([
      this.folders.getFolders(warehouseId),
      this.prisma.documentReference.findMany({
        where: {
          warehouseId,
          pickingTypeCode: 'outgoing',
          state: { notIn: EXCLUDED_STATES },
          partnerName: { contains: BANPANG_PARTNER_NAME, mode: 'insensitive' },
          OR: [{ dateDone: range }, { dateDone: null, scheduledDate: range }],
        },
        select: {
          id: true,
          uuid: true,
          documentNumber: true,
          state: true,
          origin: true,
          dateDone: true,
          scheduledDate: true,
          items: {
            select: {
              inventoryId: true,
              productName: true,
              uom: true,
              quantity: true,
              productQty: true,
            },
          },
        },
      }),
    ]);

    if (documents.length === 0) return groupBanpangRealization([], folders);

    const ids = documents.map((d) => d.id);
    const inventoryIds = [
      ...new Set(documents.flatMap((d) => d.items.map((i) => i.inventoryId))),
    ];
    const [pickingRefs, inventories] = await Promise.all([
      // picking_ref only lives in the raw ERP payload
      this.prisma.$queryRaw<{ id: number; picking_ref: unknown }[]>`
        SELECT id, "rawPayload"->'picking_ref' AS picking_ref
        FROM "DocumentReference"
        WHERE id IN (${Prisma.join(ids)})`,
      this.prisma.inventory.findMany({
        where: { id: { in: inventoryIds } },
        select: { id: true, uuid: true, sku: true, name: true },
      }),
    ]);
    const refById = new Map(
      pickingRefs.map((r) => [r.id, normalizePickingRef(r.picking_ref)]),
    );
    const inventoryById = new Map(inventories.map((i) => [i.id, i]));

    return groupBanpangRealization(
      documents.map((d) => ({
        uuid: d.uuid,
        documentNumber: d.documentNumber,
        state: d.state,
        origin: d.origin,
        pickingRef: refById.get(d.id) ?? null,
        date: d.dateDone ?? d.scheduledDate,
        items: d.items.map((item) => {
          const inventory = inventoryById.get(item.inventoryId);
          return {
            // Products without a catalog row are kept apart by name, never by id
            productUuid: inventory?.uuid ?? `name:${item.productName}`,
            sku: inventory?.sku ?? '-',
            name: inventory?.name ?? item.productName,
            uom: item.uom,
            // Not done yet: the done quantity is still 0, so count the demand
            qty: d.state === DONE_STATE ? item.quantity : item.productQty,
          };
        }),
      })),
      folders,
    );
  }
}

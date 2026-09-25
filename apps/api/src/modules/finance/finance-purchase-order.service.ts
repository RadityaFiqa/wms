import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { OdooNonCommoditySyncService } from '@/modules/odoo/odoo-non-commodity-sync.service';
import { OdooRepository } from '@/modules/odoo/odoo.repository';
import { getLocalStartOfDay, getLocalEndOfDay } from '@/core/utils/date';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import type { PurchaseOrderQueryInput } from '@bulog-wms/schema';

@Injectable()
export class FinancePurchaseOrderService {
  private readonly logger = new Logger(FinancePurchaseOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nonCommoditySyncService: OdooNonCommoditySyncService,
    private readonly odooRepository: OdooRepository,
    private readonly warehouseContext: WarehouseContextService,
  ) { }

  /**
   * List Non Commodity Purchase Orders with filtering, search, sorting, and pagination.
   */
  async findAll(warehouseId: number, query: PurchaseOrderQueryInput) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (warehouseId) {
      where.OR = [{ warehouseId }, { warehouseId: null }];
    }

    const andConditions: any[] = [];

    if (query.search) {
      andConditions.push({
        OR: [
          { documentNumber: { contains: query.search, mode: 'insensitive' } },
          { partner: { contains: query.search, mode: 'insensitive' } },
          { partnerRef: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    if (query.state) {
      andConditions.push({ state: query.state });
    }

    const timezone = this.warehouseContext.getTimezone();
    if (query.startDate || query.endDate) {
      const dateCondition: any = {};
      if (query.startDate) {
        dateCondition.gte = getLocalStartOfDay(query.startDate, timezone);
      }
      if (query.endDate) {
        dateCondition.lte = getLocalEndOfDay(query.endDate, timezone);
      }
      andConditions.push({ dateOrder: dateCondition });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Determine sorting
    let orderBy: any = [{ dateOrder: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }];
    if (query.sortBy) {
      const direction = query.sortOrder === 'asc' ? 'asc' : 'desc';
      if (['dateOrder', 'dateApprove', 'documentNumber', 'amountTotal', 'state'].includes(query.sortBy)) {
        orderBy = [{ [query.sortBy]: direction }, { id: 'desc' }];
      }
    }

    const [total, data, totalAmountAgg, doneCount, waitingCount, draftCount, account] =
      await Promise.all([
        this.prisma.documentPurchaseOrder.count({ where }),
        this.prisma.documentPurchaseOrder.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            products: {
              select: {
                id: true,
                uuid: true,
                productName: true,
                productUom: true,
                productQty: true,
                priceUnit: true,
                priceTotal: true,
                budgetActivityName: true,
              },
            },
          },
        }),
        this.prisma.documentPurchaseOrder.aggregate({
          where,
          _sum: {
            amountTotal: true,
          },
        }),
        this.prisma.documentPurchaseOrder.count({
          where: { ...where, state: { in: ['purchase', 'done'] } },
        }),
        this.prisma.documentPurchaseOrder.count({
          where: { ...where, state: 'to approve' },
        }),
        this.prisma.documentPurchaseOrder.count({
          where: { ...where, state: 'draft' },
        }),
        this.odooRepository.findByWarehouseId(warehouseId, true),
      ]);

    const sanitizedData = data.map((item) => this.sanitize(item));

    return {
      data: sanitizedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalDocuments: total,
        totalAmount: totalAmountAgg._sum.amountTotal || 0,
        countApproved: doneCount,
        countWaiting: waitingCount,
        countDraft: draftCount,
        lastSyncAt: account?.lastSyncDocumentsAt || null,
        lastOffset: account?.lastDocumentsOffset ?? 0,
      },
    };
  }

  /**
   * Find single PO by UUID with products and raw JSON for audit/debugging.
   */
  async findOne(warehouseId: number, uuid: string) {
    const where: any = { uuid };
    if (warehouseId) {
      where.OR = [{ warehouseId }, { warehouseId: null }];
    }

    const doc = await this.prisma.documentPurchaseOrder.findFirst({
      where,
      include: {
        products: {
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException('Dokumen Purchase Order tidak ditemukan.');
    }

    return this.sanitize(doc, true);
  }

  /**
   * Trigger force sync for Non Commodity Purchase Orders.
   */
  async forceSync(warehouseId: number, triggeredBy: string) {
    return this.nonCommoditySyncService.triggerSync(warehouseId, triggeredBy);
  }

  /**
   * Get sync status for Non Commodity POs.
   */
  async getSyncStatus(warehouseId: number) {
    const account = await this.odooRepository.findByWarehouseId(
      warehouseId,
      true,
    );

    return {
      status: account?.lastSyncDocumentsStatus || null,
      lastSyncAt: account?.lastSyncDocumentsAt || null,
      lastSyncBy: account?.lastSyncDocumentsBy || null,
      lastSyncCount: account?.lastSyncDocumentsCount ?? 0,
      lastSyncError: account?.lastSyncDocumentsError || null,
      lastOffset: account?.lastDocumentsOffset ?? 0,
    };
  }

  /**
   * Sanitizes Purchase Order to never expose database numerical IDs.
   */
  private sanitize(po: any, includeRawJson = false) {
    if (!po) return null;
    const { id, warehouseId, rawJson, products, ...safePo } = po;

    const safeProducts = Array.isArray(products)
      ? products.map((p) => {
        const { id: pId, documentPurchaseOrderId, ...safeProduct } = p;
        return safeProduct;
      })
      : [];

    return {
      ...safePo,
      products: safeProducts,
      ...(includeRawJson ? { rawJson } : {}),
    };
  }
}

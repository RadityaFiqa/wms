import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { OdooClient } from '@/modules/odoo/odoo-client';
import { OdooSessionManager } from '@/modules/odoo/odoo-session.manager';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import { getLocalStartOfDay, getLocalEndOfDay } from '@/core/utils/date';

@Injectable()
export class ErpDocumentReferenceService {
  private readonly logger = new Logger(ErpDocumentReferenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooClient: OdooClient,
    private readonly odooSessionManager: OdooSessionManager,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  /**
   * Safe helper to parse relational array [id, name] or relational object { id, display_name }
   */
  private getRelationalName(fieldVal: any): string | null {
    if (!fieldVal) return null;
    if (Array.isArray(fieldVal)) {
      return fieldVal.length > 1 ? String(fieldVal[1]) : null;
    }
    if (typeof fieldVal === 'object') {
      return fieldVal.display_name || null;
    }
    return String(fieldVal);
  }

  /**
   * Safe helper to parse relational array ID [id, name] or relational object ID { id, display_name }
   */
  private getRelationalId(fieldVal: any): number | null {
    if (!fieldVal) return null;
    if (Array.isArray(fieldVal)) {
      return fieldVal.length > 0 ? Number(fieldVal[0]) : null;
    }
    if (typeof fieldVal === 'object') {
      return fieldVal.id ? Number(fieldVal.id) : null;
    }
    return Number(fieldVal);
  }

  /**
   * Trigger the ERP Document Sync directly (no BullMQ queue).
   * Runs in the background without locking.
   */
  async triggerSync(
    warehouseId: number,
    createdBy: string,
  ): Promise<{ message: string }> {
    this.logger.log(
      `[SYNC-TRIGGER] Warehouse ${warehouseId} — triggered by ${createdBy}`,
    );

    // Check if there is already a running/pending sync for this warehouse
    const activeSync = await this.prisma.odooSyncLog.findFirst({
      where: {
        warehouseId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    if (activeSync) {
      // Check if it has been running for more than 15 minutes (stuck sync)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (activeSync.createdAt < fifteenMinutesAgo) {
        this.logger.warn(
          `[SYNC-TRIGGER] Found stuck sync log ID ${activeSync.id} (started at ${activeSync.createdAt}). Marking as FAILED.`,
        );
        await this.prisma.odooSyncLog.update({
          where: { id: activeSync.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Sync timed out / server restarted.',
            finishedAt: new Date(),
          },
        });
      } else {
        return { message: 'Sync already in progress' };
      }
    }

    // Validate that OdooAccount exists and is active BEFORE starting the background job
    const account = await this.prisma.odooAccount.findUnique({
      where: { warehouseId },
    });

    if (!account) {
      throw new NotFoundException(
        'Akun Odoo untuk gudang aktif ini belum dikonfigurasi.',
      );
    }

    if (!account.isActive) {
      throw new BadRequestException('Akun Odoo untuk gudang ini tidak aktif.');
    }

    // 1. Create the sync log entry in DB
    const log = await this.prisma.odooSyncLog.create({
      data: {
        warehouseId,
        status: 'PENDING',
        createdBy,
      },
    });
    this.logger.log(`[SYNC-TRIGGER] Created sync log entry ID: ${log.id}`);

    // 2. Fire-and-forget: run the sync in the background (no await)
    this.executeSyncJob(warehouseId, log.id, createdBy)
      .then((result) => {
        this.logger.log(
          `[SYNC-COMPLETE] Warehouse ${warehouseId}, log ${log.id} — synced ${result.syncedCount} documents`,
        );
      })
      .catch((err) => {
        this.logger.error(
          `[SYNC-FAILED] Warehouse ${warehouseId}, log ${log.id} — ${err.message}`,
          err.stack,
        );
      });

    return { message: 'Sync started' };
  }

  /**
   * Fetch current sync status and progress metrics.
   */
  async getSyncStatus(warehouseId: number) {
    const lastSync = await this.prisma.odooSyncLog.findFirst({
      where: { warehouseId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      status: lastSync?.status || null,
      processedDocuments: lastSync?.processedDocuments ?? 0,
      totalDocuments: lastSync?.totalDocuments ?? 0,
      startedAt: lastSync?.createdAt || null,
      lastSyncAt: lastSync?.updatedAt || null,
    };
  }

  /**
   * Background task to perform document synchronization from Odoo to local DB.
   * No BullMQ locking — runs directly.
   */
  async executeSyncJob(
    warehouseId: number,
    logId: number,
    triggeredBy: string,
  ): Promise<{ success: boolean; syncedCount: number }> {
    this.logger.log(
      `[SYNC-JOB] Starting sync for warehouse ${warehouseId}, log ${logId}`,
    );

    // Update log status to RUNNING
    await this.prisma.odooSyncLog.update({
      where: { id: logId },
      data: { status: 'RUNNING' },
    });
    this.logger.log(`[SYNC-JOB] Log ${logId} status set to RUNNING`);

    // 1. Get active OdooAccount configuration for this warehouse
    this.logger.log(
      `[SYNC-JOB] Fetching OdooAccount for warehouse ${warehouseId}...`,
    );
    const account = await this.prisma.odooAccount.findUnique({
      where: { warehouseId },
      include: { warehouse: true },
    });

    if (!account) {
      const errorMsg = 'Akun Odoo untuk gudang aktif ini belum dikonfigurasi.';
      this.logger.error(`[SYNC-JOB] ${errorMsg}`);
      await this.prisma.odooSyncLog.update({
        where: { id: logId },
        data: {
          status: 'FAILED',
          errorMessage: errorMsg,
          finishedAt: new Date(),
        },
      });
      throw new NotFoundException(errorMsg);
    }

    if (!account.isActive) {
      const errorMsg = 'Akun Odoo untuk gudang ini tidak aktif.';
      this.logger.error(`[SYNC-JOB] ${errorMsg}`);
      await this.prisma.odooSyncLog.update({
        where: { id: logId },
        data: {
          status: 'FAILED',
          errorMessage: errorMsg,
          finishedAt: new Date(),
        },
      });
      throw new BadRequestException(errorMsg);
    }

    const odooReference = account.warehouse?.odooReference;
    if (!odooReference) {
      const errorMsg = 'Referensi Odoo untuk gudang ini belum dikonfigurasi.';
      this.logger.error(`[SYNC-JOB] ${errorMsg}`);
      await this.prisma.odooSyncLog.update({
        where: { id: logId },
        data: {
          status: 'FAILED',
          errorMessage: errorMsg,
          finishedAt: new Date(),
        },
      });
      throw new BadRequestException(errorMsg);
    }

    const domain = [['picking_type_id.warehouse_id.code', '=', odooReference]];

    this.logger.log(
      `[SYNC-JOB] OdooAccount found: ID=${account.id}, baseUrl=${account.baseUrl}, lastOffset=${account.lastDocumentsOffset}, odooReference=${odooReference}`,
    );

    // 2. Fetch PO & SO documents in Odoo using pagination
    const limit = 100;

    // Best-effort: Get total count matching domain for progress bar calculation
    let totalDocuments = 0;
    try {
      const totalCount = await this.safeOdooCall(
        warehouseId,
        'stock.picking',
        'search_count',
        [],
        {
          domain,
        },
      );

      totalDocuments = totalCount;

      this.logger.log(
        `[SYNC-JOB] Total matching documents in Odoo for warehouse ${odooReference}: ${totalCount}`,
      );
    } catch (err: any) {
      this.logger.warn(
        `[SYNC-JOB] Failed to fetch total document count: ${err.message}`,
      );
    }

    let offset = account.lastDocumentsOffset ?? 0;
    // Reset offset if it exceeds totalDocuments to prevent syncing nothing
    if (offset > totalDocuments) {
      this.logger.log(
        `[SYNC-JOB] Offset ${offset} exceeds total documents ${totalDocuments}. Resetting offset to 0.`,
      );
      offset = 0;
    }

    // Update log total count
    await this.prisma.odooSyncLog.update({
      where: { id: logId },
      data: { totalDocuments },
    });

    try {
      let syncedCount = 0;
      while (true) {
        this.logger.log(
          `[SYNC-JOB] Fetching PO documents: offset=${offset}, limit=${limit}`,
        );

        const poRes = await this.safeOdooCall(
          warehouseId,
          'stock.picking',
          'web_search_read',
          [],
          {
            domain,
            specification: {
              id: {},
              name: {},
              state: {},
              picking_type_code: {},
              partner_id: { fields: { display_name: {} } },
              purchase_id: { fields: { display_name: {} } },
              origin: {},
              ref_fax: {},
              location_id: { fields: { display_name: {} } },
              location_dest_id: { fields: { display_name: {} } },
              scheduled_date: {},
              date_done: {},
              driver: {},
              plat_number: {},
              move_ids_without_package: {
                fields: {
                  id: {},
                  product_id: { fields: { display_name: {} } },
                  product_uom: { fields: { display_name: {} } },
                  analytic_account_id: { fields: { display_name: {} } },
                  quantity: {},
                  product_qty: {},
                  sh_sec_qty: {},
                  sh_sec_uom_id: { fields: { display_name: {} } },
                },
              },
            },
            offset,
            limit,
            order: 'scheduled_date asc',
            count_limit: 999_999,
          },
        );

        const records = poRes?.records || [];
        this.logger.log(
          `[SYNC-JOB] Offset ${offset} fetched ${records.length} records`,
        );
        if (records.length === 0) break;

        // Upsert documents in DB transaction
        await this.prisma.$transaction(
          async (tx) => {
            for (const record of records) {
              await this.upsertDocumentRecord(tx, record, warehouseId);
            }
          },
          {
            timeout: 600000,
          },
        );

        syncedCount += records.length;
        offset += records.length;

        console.log(`offset`, offset)

        // Update OdooAccount offset
        await this.prisma.odooAccount.update({
          where: { id: account.id },
          data: { lastDocumentsOffset: offset },
        });

        // Update processedDocuments in sync log
        await this.prisma.odooSyncLog.update({
          where: { id: logId },
          data: { processedDocuments: offset },
        });

        this.logger.log(`[SYNC-JOB] Progress offset updated to ${offset}`);

        if (records.length < limit) break;
      }

      // 3. Refresh Open/Active Documents
      this.logger.log(
        `[SYNC-JOB] Starting refresh of open/active documents...`,
      );
      const activeDocuments = await this.prisma.documentReference.findMany({
        where: {
          warehouseId,
          state: {
            notIn: ['done', 'cancel'],
          },
        },
        select: { id: true, documentNumber: true },
      });

      this.logger.log(
        `[SYNC-JOB] Found ${activeDocuments.length} active documents to refresh`,
      );

      for (const doc of activeDocuments) {
        try {
          this.logger.log(
            `[SYNC-JOB] Refreshing active document ID=${doc.id}, Number=${doc.documentNumber} from Odoo...`,
          );
          const res = await this.safeOdooCall(
            warehouseId,
            'stock.picking',
            'web_read',
            [[doc.id]],
            {
              specification: {
                id: {},
                name: {},
                state: {},
                picking_type_code: {},
                partner_id: { fields: { display_name: {} } },
                purchase_id: { fields: { display_name: {} } },
                origin: {},
                ref_fax: {},
                location_id: { fields: { display_name: {} } },
                location_dest_id: { fields: { display_name: {} } },
                scheduled_date: {},
                date_done: {},
                driver: {},
                plat_number: {},
                move_ids_without_package: {
                  fields: {
                    id: {},
                    product_id: { fields: { display_name: {} } },
                    product_uom: { fields: { display_name: {} } },
                    analytic_account_id: { fields: { display_name: {} } },
                    quantity: {},
                    product_qty: {},
                    sh_sec_qty: {},
                    sh_sec_uom_id: { fields: { display_name: {} } },
                  },
                },
              },
            },
          );

          if (res && Array.isArray(res) && res.length > 0) {
            const record = res[0];
            await this.prisma.$transaction(
              async (tx) => {
                await this.upsertDocumentRecord(tx, record, warehouseId);
              },
              {
                timeout: 60000,
              },
            );
            this.logger.log(
              `[SYNC-JOB] Successfully refreshed active document ID=${doc.id}`,
            );
          } else {
            this.logger.warn(
              `[SYNC-JOB] Document ID=${doc.id} not found in Odoo during refresh. Skipping.`,
            );
          }
        } catch (err: any) {
          this.logger.error(
            `[SYNC-JOB] Failed to refresh active document ID=${doc.id}: ${err.message}`,
          );
        }
      }

      const finishedAt = new Date();
      await this.prisma.odooSyncLog.update({
        where: { id: logId },
        data: { status: 'SUCCESS', finishedAt, processedDocuments: offset },
      });

      // Update OdooAccount status on success
      await this.prisma.odooAccount.update({
        where: { id: account.id },
        data: {
          lastSyncDocumentsAt: finishedAt,
          lastSyncDocumentsStatus: 'SUCCESS',
          lastSyncDocumentsError: null,
          lastSyncDocumentsBy: triggeredBy,
          lastSyncDocumentsCount: syncedCount,
        },
      });

      this.logger.log(
        `[SYNC-JOB] ✅ Sync completed successfully for warehouse ${warehouseId}. Total synced: ${syncedCount}`,
      );

      return {
        success: true,
        syncedCount,
      };
    } catch (err: any) {
      const finishedAt = new Date();
      this.logger.error(
        `[SYNC-JOB] ❌ Sync failed for warehouse ${warehouseId}: ${err.message}`,
        err.stack,
      );
      await this.prisma.odooSyncLog.update({
        where: { id: logId },
        data: { status: 'FAILED', errorMessage: err.message, finishedAt },
      });

      await this.prisma.odooAccount
        .update({
          where: { id: account.id },
          data: {
            lastSyncDocumentsAt: finishedAt,
            lastSyncDocumentsStatus: 'FAILED',
            lastSyncDocumentsError: `Gagal menyimpan data ke database: ${err.message}`,
            lastSyncDocumentsBy: triggeredBy,
          },
        })
        .catch((e) =>
          this.logger.error(
            '[SYNC-JOB] Failed to update OdooAccount sync status',
            e,
          ),
        );
      throw err;
    }
  }

  /**
   * Find paginated local ERP document references with search filters, type filters, and summary stats.
   */
  async findAll(
    warehouseId: number,
    query: {
      search?: string;
      page?: number;
      limit?: number;
      type?: 'IN' | 'OUT';
      state?: string;
      startDate?: string;
      endDate?: string;
      refFax?: string;
      gateOperationUuid?: string;
    },
  ) {
    this.logger.log(
      `[findAll] Fetching documents for warehouseId=${warehouseId}, search="${query.search || ''}", type="${query.type || ''}", page=${query.page || 1}, limit=${query.limit || 10}, gateOperationUuid="${query.gateOperationUuid || ''}"`,
    );
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      warehouseId,
    };

    const andConditions: any[] = [];

    // if (query.gateOperationUuid) {
    //   const gateOp = await this.prisma.gateOperation.findUnique({
    //     where: { uuid: query.gateOperationUuid },
    //     include: { products: true },
    //   });
    //   const inventoryIds = gateOp ? gateOp.products.map((p) => p.inventoryId) : [];
    //   if (inventoryIds.length > 0) {
    //     andConditions.push({
    //       items: {
    //         some: {
    //           inventoryId: { in: inventoryIds },
    //         },
    //       },
    //     });
    //   } else {
    //     andConditions.push({ id: -1 }); // return no results if gate operation has no products
    //   }
    // }

    console.log(`product`, JSON.stringify(andConditions, null, 2))

    if (query.search) {
      andConditions.push({
        OR: [
          { documentNumber: { contains: query.search, mode: 'insensitive' } },
          { origin: { contains: query.search, mode: 'insensitive' } },
          { partnerName: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    if (query.type) {
      if (query.type === 'IN') {
        andConditions.push({
          pickingTypeCode: 'incoming',
        });
      } else {
        andConditions.push({
          OR: [
            { pickingTypeCode: 'outgoing' },
            {
              pickingTypeCode: 'internal',
              origin: {
                startsWith: 'CT',
              },
            },
          ],
        });
      }
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    if (query.refFax) {
      where.refFax = { contains: query.refFax, mode: 'insensitive' };
    }

    if (query.state) {
      where.state = query.state;
    }

    const timezone = this.warehouseContext.getTimezone();
    if (query.startDate || query.endDate) {
      where.scheduledDate = {};
      if (query.startDate) {
        where.scheduledDate.gte = getLocalStartOfDay(query.startDate, timezone);
      }
      if (query.endDate) {
        where.scheduledDate.lte = getLocalEndOfDay(query.endDate, timezone);
      }
    }

    // 1. Fetch paginated documents
    const [total, data] = await Promise.all([
      this.prisma.documentReference.count({ where }),
      this.prisma.documentReference.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { scheduledDate: { sort: 'desc', nulls: 'last' } },
          { id: 'desc' },
        ],
        include: {
          items: true,
        },
      }),
    ]);

    // 2. Fetch overall summary stats for active warehouse context
    const [totalCount, incomingCount, outgoingCount, odooAccount] =
      await Promise.all([
        this.prisma.documentReference.count({ where: { warehouseId } }),
        this.prisma.documentReference.count({
          where: { warehouseId, pickingTypeCode: 'incoming' },
        }),
        this.prisma.documentReference.count({
          where: { warehouseId, pickingTypeCode: 'outgoing' },
        }),
        this.prisma.odooAccount.findUnique({ where: { warehouseId } }),
      ]);

    const summary = {
      totalDocuments: totalCount,
      totalIncoming: incomingCount,
      totalOutgoing: outgoingCount,
      lastSyncTime: odooAccount?.lastSyncDocumentsAt || null,
    };

    const sanitizedData = await this.sanitizeDocReferences(data);
    this.logger.log(
      `[findAll] Found total=${total} matching documents, returning ${sanitizedData.length} documents for current page`,
    );

    return {
      data: sanitizedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    };
  }

  async getPendingPickups(
    warehouseId: number,
    query: {
      search?: string;
      partner?: string;
      scheduledDate?: string;
      state?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      warehouseId,
      state: query.state
        ? query.state.toLowerCase()
        : { in: ['assigned', 'confirmed'] },
      OR: [
        { partnerName: null },
        { partnerName: { not: '4755 - Manager Pengolahan Kalsel' } },
      ],
    };

    if (query.search) {
      where.AND = where.AND || [];
      where.AND.push({
        items: {
          some: {
            productName: { contains: query.search, mode: 'insensitive' },
          },
        },
      });
    }

    if (query.partner) {
      where.AND = where.AND || [];
      where.AND.push({
        partnerName: { contains: query.partner, mode: 'insensitive' },
      });
    }

    if (query.scheduledDate) {
      const start = new Date(query.scheduledDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(query.scheduledDate);
      end.setHours(23, 59, 59, 999);
      where.scheduledDate = {
        gte: start,
        lte: end,
      };
    }

    // Fetch candidate document references
    const dbDocs = await this.prisma.documentReference.findMany({
      where,
      include: {
        items: true,
        gateOperations: {
          where: {
            status: { not: 'CANCELED' },
          },
          include: {
            products: true,
          },
        },
      },
    });

    // Get all unique inventoryIds
    const inventoryIds = Array.from(
      new Set(
        dbDocs.flatMap((doc) => doc.items.map((item) => item.inventoryId)),
      ),
    );

    // Fetch SKUs from Inventory
    const inventories = await this.prisma.inventory.findMany({
      where: { id: { in: inventoryIds } },
      select: { id: true, sku: true },
    });
    const skuMap = new Map(inventories.map((inv) => [inv.id, inv.sku]));

    // Grouping by Product
    const productMap = new Map<number, any>();

    for (const doc of dbDocs) {
      // Picked quantities map for this document
      const pickedMap = new Map<number, number>();
      for (const op of doc.gateOperations) {
        for (const prod of op.products) {
          pickedMap.set(
            prod.inventoryId,
            (pickedMap.get(prod.inventoryId) || 0) + prod.quantity,
          );
        }
      }

      for (const item of doc.items) {
        const erpPrimaryQty = item.productQty;
        const erpSecondaryQty = item.secondaryQuantity;
        const ratio =
          erpSecondaryQty !== null && erpPrimaryQty > 0
            ? erpSecondaryQty / erpPrimaryQty
            : 0;

        const pickedPrimaryQty = pickedMap.get(item.inventoryId) || 0;
        const remainingPrimaryQty = Math.max(0, erpPrimaryQty - pickedPrimaryQty);

        // A document item is pending only if remaining primary quantity > 0
        if (remainingPrimaryQty <= 0) continue;

        // Apply status filter to the document item
        const itemStatus =
          pickedPrimaryQty === 0 ? 'Not Picked' : 'Partially Picked';
        if (query.status) {
          const filterStatus = query.status.toLowerCase();
          if (filterStatus === 'not_picked' && itemStatus !== 'Not Picked') {
            continue;
          }
          if (
            filterStatus === 'partially_picked' &&
            itemStatus !== 'Partially Picked'
          ) {
            continue;
          }
        }

        // Initialize or update product group
        let prodGroup = productMap.get(item.inventoryId);
        if (!prodGroup) {
          prodGroup = {
            productId: item.inventoryId,
            productName: item.productName,
            sku: skuMap.get(item.inventoryId) || '-',
            uom: item.uom,
            secondaryUom: item.secondaryUom,
            ratio,
            pendingDocumentsCount: 0,
            erpQuantityPrimary: 0,
            pickedQuantityPrimary: 0,
            remainingQuantityPrimary: 0,
            erpQuantitySecondary: null,
            pickedQuantitySecondary: null,
            remainingQuantitySecondary: null,
            documents: [],
          };
          productMap.set(item.inventoryId, prodGroup);
        }

        // Aggregate product quantities
        prodGroup.erpQuantityPrimary += erpPrimaryQty;
        prodGroup.pickedQuantityPrimary += pickedPrimaryQty;
        prodGroup.remainingQuantityPrimary += remainingPrimaryQty;

        // Collect relevant gate operations for this document item
        const relevantGateOps = doc.gateOperations
          .filter((op) => op.products.some((p) => p.inventoryId === item.inventoryId))
          .map((op) => {
            const prodOp = op.products.find((p) => p.inventoryId === item.inventoryId);
            return {
              id: op.id,
              uuid: op.uuid,
              opNumber: op.opNumber,
              createdAt: op.createdAt,
              status: op.status,
              quantity: prodOp?.quantity || 0,
              secondaryQuantity:
                erpSecondaryQty !== null && prodOp
                  ? prodOp.quantity * ratio
                  : null,
            };
          });

        // Add document detail to this product group
        prodGroup.documents.push({
          uuid: doc.uuid,
          documentNumber: doc.documentNumber,
          partnerName: doc.partnerName,
          scheduledDate: doc.scheduledDate,
          origin: doc.origin,
          driver: doc.driver,
          plateNumber: doc.plateNumber,
          state: doc.state,
          status: itemStatus,
          erpQuantityPrimary: erpPrimaryQty,
          erpQuantitySecondary: erpSecondaryQty,
          pickedQuantityPrimary: pickedPrimaryQty,
          pickedQuantitySecondary:
            erpSecondaryQty !== null ? pickedPrimaryQty * ratio : null,
          remainingQuantityPrimary: remainingPrimaryQty,
          remainingQuantitySecondary:
            erpSecondaryQty !== null ? remainingPrimaryQty * ratio : null,
          progress:
            erpPrimaryQty > 0 ? (pickedPrimaryQty / erpPrimaryQty) * 105 : 0, // Wait: let's cap at 100% just in case
          gateOperations: relevantGateOps,
        });

        // Cap progress at 100%
        const lastDoc = prodGroup.documents[prodGroup.documents.length - 1];
        lastDoc.progress = Math.min(100, lastDoc.progress);

        prodGroup.pendingDocumentsCount = prodGroup.documents.length;
      }
    }

    // Convert productMap to list
    let productList = Array.from(productMap.values());

    // Filter products list by search query if provided (in memory)
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      productList = productList.filter(
        (prod) =>
          prod.productName.toLowerCase().includes(searchLower) ||
          prod.sku.toLowerCase().includes(searchLower),
      );
    }

    // Calculate secondary quantities on product level based on totals
    for (const prod of productList) {
      if (prod.secondaryUom) {
        prod.erpQuantitySecondary = prod.erpQuantityPrimary * prod.ratio;
        prod.pickedQuantitySecondary = prod.pickedQuantityPrimary * prod.ratio;
        prod.remainingQuantitySecondary =
          prod.remainingQuantityPrimary * prod.ratio;
      }
    }

    // Sort products: "Urutan default berdasarkan Remaining Qty terbesar, kemudian Scheduled Date paling lama."
    productList.sort((a, b) => {
      // 1. Remaining Quantity (descending)
      if (b.remainingQuantityPrimary !== a.remainingQuantityPrimary) {
        return b.remainingQuantityPrimary - a.remainingQuantityPrimary;
      }

      // 2. Earliest Scheduled Date (ascending)
      const aEarliest = a.documents.reduce((earliest: Date | null, doc: any) => {
        if (!doc.scheduledDate) return earliest;
        const d = new Date(doc.scheduledDate);
        return earliest === null || d < earliest ? d : earliest;
      }, null);

      const bEarliest = b.documents.reduce((earliest: Date | null, doc: any) => {
        if (!doc.scheduledDate) return earliest;
        const d = new Date(doc.scheduledDate);
        return earliest === null || d < earliest ? d : earliest;
      }, null);

      if (aEarliest && bEarliest) {
        return aEarliest.getTime() - bEarliest.getTime();
      }
      if (aEarliest) return -1;
      if (bEarliest) return 1;
      return 0;
    });

    // Global Summary Stats Calculations
    const uniqueDocs = new Set<string>();
    let grandTotalErpPrimary = 0;
    let grandTotalPickedPrimary = 0;

    const primaryGroups: { [uom: string]: number } = {};
    const secondaryGroups: { [uom: string]: number } = {};

    for (const prod of productList) {
      grandTotalErpPrimary += prod.erpQuantityPrimary;
      grandTotalPickedPrimary += prod.pickedQuantityPrimary;

      // Group by primary UoM
      const uom = prod.uom || 'Unit';
      primaryGroups[uom] =
        (primaryGroups[uom] || 0) + prod.remainingQuantityPrimary;

      // Group by secondary UoM
      if (prod.secondaryUom && prod.remainingQuantitySecondary !== null) {
        const secUom = prod.secondaryUom;
        secondaryGroups[secUom] =
          (secondaryGroups[secUom] || 0) + prod.remainingQuantitySecondary;
      }

      for (const doc of prod.documents) {
        uniqueDocs.add(doc.uuid);
      }
    }

    const totalPendingDocuments = uniqueDocs.size;
    const totalPendingProducts = productList.length;

    const totalPendingPrimaryQty = Object.entries(primaryGroups).map(
      ([uom, quantity]) => ({ uom, quantity }),
    );
    const totalPendingSecondaryQty = Object.entries(secondaryGroups).map(
      ([uom, quantity]) => ({ uom, quantity }),
    );

    const completionRate =
      grandTotalErpPrimary > 0
        ? (grandTotalPickedPrimary / grandTotalErpPrimary) * 100
        : 0;

    const summary = {
      totalPendingDocuments,
      totalPendingProducts,
      totalPendingPrimaryQty,
      totalPendingSecondaryQty,
      completionRate,
    };

    // Paginate product list
    const total = productList.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedProducts = productList.slice(skip, skip + limit);

    return {
      products: paginatedProducts,
      summary,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Find detailed document reference and its item lines
   */
  async findOne(warehouseId: number, uuid: string) {
    const item = await this.prisma.documentReference.findFirst({
      where: {
        warehouseId,
        uuid,
      },
      include: {
        items: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Dokumen ERP tidak ditemukan di gudang ini.');
    }

    return this.sanitizeDocReference(item);
  }

  /**
   * Synchronously force refresh a single ERP Document by fetching it from Odoo.
   */
  async forceSyncDocument(
    warehouseId: number,
    idOrUuid: string,
    triggeredBy: string,
  ): Promise<any> {
    this.logger.log(
      `[FORCE-SYNC] Document ${idOrUuid} for warehouse ${warehouseId}, triggered by ${triggeredBy}`,
    );

    // Find local document reference only by uuid to keep API purely UUID-based
    const doc = await this.prisma.documentReference.findFirst({
      where: {
        warehouseId,
        uuid: idOrUuid,
      },
    });

    if (!doc) {
      this.logger.error(`[FORCE-SYNC] Document not found: ${idOrUuid}`);
      throw new NotFoundException('Dokumen ERP tidak ditemukan.');
    }

    this.logger.log(
      `[FORCE-SYNC] Found local document: id=${doc.id}, number=${doc.documentNumber}`,
    );

    // 2. Get active OdooAccount configuration
    const account = await this.prisma.odooAccount.findUnique({
      where: { warehouseId },
    });

    if (!account) {
      throw new NotFoundException(
        'Akun Odoo untuk gudang aktif ini belum dikonfigurasi.',
      );
    }

    if (!account.isActive) {
      throw new BadRequestException('Akun Odoo untuk gudang ini tidak aktif.');
    }

    // 4. Fetch the specific document detail using web_read
    const specification = {
      id: {},
      name: {},
      state: {},
      picking_type_code: {},
      partner_id: { fields: { display_name: {} } },
      purchase_id: { fields: { display_name: {} } },
      origin: {},
      ref_fax: {},
      location_id: { fields: { display_name: {} } },
      location_dest_id: { fields: { display_name: {} } },
      scheduled_date: {},
      date_done: {},
      driver: {},
      plat_number: {},
      move_ids_without_package: {
        fields: {
          id: {}, // Fetch Odoo move ID
          product_id: { fields: { display_name: {} } },
          product_uom: { fields: { display_name: {} } },
          analytic_account_id: { fields: { display_name: {} } },
          quantity: {},
          product_qty: {},
          sh_sec_qty: {},
          sh_sec_uom_id: { fields: { display_name: {} } },
        },
      },
    };

    let record: any;
    try {
      this.logger.log(
        `[FORCE-SYNC] Fetching document id=${doc.id} from Odoo...`,
      );
      const res = await this.safeOdooCall(
        warehouseId,
        'stock.picking',
        'web_read',
        [[doc.id]],
        {
          specification,
        },
      );

      if (!res || !Array.isArray(res) || res.length === 0) {
        throw new NotFoundException('Dokumen tidak ditemukan di Odoo.');
      }
      record = res[0];
      this.logger.log(
        `[FORCE-SYNC] Fetched document from Odoo: name=${record.name}, state=${record.state}`,
      );
    } catch (err: any) {
      this.logger.error(
        `[FORCE-SYNC] Failed to fetch from Odoo: ${err.message}`,
        err.stack,
      );
      throw new BadRequestException(
        `Gagal mengambil detail dokumen dari Odoo: ${err.message}`,
      );
    }

    // 5. Update the local database inside transaction
    this.logger.log(
      `[FORCE-SYNC] Updating local DB for document id=${doc.id}...`,
    );
    const updatedDoc = await this.prisma.$transaction(
      async (tx) => {
        const docRef = await this.upsertDocumentRecord(tx, record, warehouseId);
        return tx.documentReference.findUnique({
          where: { id: docRef.id },
          include: { items: true },
        });
      },
      {
        timeout: 60000,
      },
    );

    this.logger.log(
      `[FORCE-SYNC] ✅ Document ${doc.documentNumber} force-synced successfully`,
    );
    return this.sanitizeDocReference(updatedDoc);
  }

  public async upsertDocumentRecord(
    tx: any,
    record: any,
    warehouseId: number,
  ) {
    const erpId = record.id;
    const documentNumber = record.name || `DOC-${erpId}`;
    const state = record.state || 'draft';
    const pickingTypeCode = record.picking_type_code || 'internal';
    const partnerName = this.getRelationalName(record.partner_id);
    const purchaseName = this.getRelationalName(record.purchase_id);
    const origin = record.origin || null;
    const ref_fax = record.ref_fax || null;
    const sourceLocationName = this.getRelationalName(record.location_id);
    const destinationLocationName = this.getRelationalName(
      record.location_dest_id,
    );
    const scheduledDate = record.scheduled_date
      ? new Date(record.scheduled_date)
      : null;
    const dateDone = record.date_done ? new Date(record.date_done) : null;
    const driver = record.driver || null;
    const plateNumber = record.plat_number || null;

    const rawItems = record.move_ids_without_package || [];

    // Pre-calculate sums
    const totalItems = rawItems.length;
    const totalQuantity = rawItems.reduce(
      (sum: number, item: any) => sum + (Number(item.quantity) || 0.0),
      0.0,
    );

    this.logger.log(
      `[SYNC-JOB] Upserting document: erpId=${erpId}, number=${documentNumber}, ` +
        `state=${state}, type=${pickingTypeCode}, items=${totalItems}, ref_fax=${ref_fax}`,
    );

    // Upsert Document Header using Odoo ID directly as id
    const docRef = await tx.documentReference.upsert({
      where: {
        id: erpId,
      },
      update: {
        documentNumber,
        state,
        pickingTypeCode,
        partnerName,
        purchaseName,
        origin,
        refFax: ref_fax,
        sourceLocationName,
        destinationLocationName,
        scheduledDate,
        dateDone,
        driver,
        plateNumber,
        totalItems,
        totalQuantity,
        rawPayload: record,
        lastSyncedAt: new Date(),
      },
      create: {
        id: erpId,
        warehouseId,
        documentNumber,
        state,
        pickingTypeCode,
        partnerName,
        purchaseName,
        origin,
        refFax: ref_fax,
        sourceLocationName,
        destinationLocationName,
        scheduledDate,
        dateDone,
        driver,
        plateNumber,
        totalItems,
        totalQuantity,
        rawPayload: record,
      },
    });

    // Upsert document items to maintain integrity and prevent cascade delete of references
    if (rawItems.length > 0) {
      const itemsData = rawItems.map((item: any) => {
        const moveId = item.id; // Odoo move ID
        const inventoryId = this.getRelationalId(item.product_id) || 0;
        const productName =
          this.getRelationalName(item.product_id) || 'Unnamed Product';
        const uom = this.getRelationalName(item.product_uom) || 'Unit';
        const analyticAccountName = this.getRelationalName(
          item.analytic_account_id,
        );
        const quantity = Number(item.quantity) || 0.0;
        const productQty = Number(item.product_qty) || 0.0;
        const secondaryQuantity =
          item.sh_sec_qty !== undefined ? Number(item.sh_sec_qty) : null;
        const secondaryUom = this.getRelationalName(item.sh_sec_uom_id);

        return {
          id: moveId,
          documentReferenceId: docRef.id,
          inventoryId,
          productName,
          uom,
          analyticAccountName,
          quantity,
          productQty,
          secondaryQuantity,
          secondaryUom,
        };
      });

      // Upsert each item
      for (const item of itemsData) {
        await tx.documentReferenceItem.upsert({
          where: { id: item.id },
          update: {
            productName: item.productName,
            uom: item.uom,
            analyticAccountName: item.analyticAccountName,
            quantity: item.quantity,
            productQty: item.productQty,
            secondaryQuantity: item.secondaryQuantity,
            secondaryUom: item.secondaryUom,
          },
          create: item,
        });
      }

      // Delete items no longer in Odoo picking
      const odooItemIds = itemsData.map((i) => i.id);
      await tx.documentReferenceItem.deleteMany({
        where: {
          documentReferenceId: docRef.id,
          id: { notIn: odooItemIds },
        },
      });

      this.logger.log(
        `[SYNC-JOB] Upserted ${itemsData.length} items for document id=${docRef.id}`,
      );
    } else {
      await tx.documentReferenceItem.deleteMany({
        where: { documentReferenceId: docRef.id },
      });
    }

    return docRef;
  }

  async findUniquePartners(warehouseId: number): Promise<string[]> {
    const results = await this.prisma.documentReference.findMany({
      where: {
        warehouseId,
        partnerName: {
          not: '',
        },
        NOT: {
          partnerName: null,
        },
      },
      select: {
        partnerName: true,
      },
      distinct: ['partnerName'],
    });
    return results
      .map((r) => r.partnerName)
      .filter((name): name is string => name !== null && name !== '');
  }

  private async sanitizeDocReferences(
    docs: any[],
    includeRawPayload = false,
  ): Promise<any[]> {
    if (!docs || docs.length === 0) return [];

    // Collect all inventoryIds across all items in all docs
    const inventoryIds: number[] = [];
    const docIds: number[] = [];
    for (const doc of docs) {
      docIds.push(doc.id);
      if (doc.items) {
        for (const item of doc.items) {
          if (item.inventoryId) {
            inventoryIds.push(item.inventoryId);
          }
        }
      }
    }

    // Lookup inventory details
    const inventoryMap = new Map<number, any>();
    if (inventoryIds.length > 0) {
      const inventories = await this.prisma.inventory.findMany({
        where: { id: { in: inventoryIds } },
        select: { id: true, uuid: true, sku: true, name: true, uom: true },
      });
      for (const inv of inventories) {
        inventoryMap.set(inv.id, inv);
      }
    }

    // Lookup signature details
    const signedDocs = await this.prisma.signedDocument.findMany({
      where: {
        sourceType: 'ERP',
        sourceDocumentId: { in: docIds },
        status: 'VALID',
        deletedAt: null,
      },
      select: {
        id: true,
        sourceDocumentId: true,
        signedAt: true,
        verificationToken: true,
        signedBy: true,
      },
    });

    const signedMap = new Map<number, any>();
    for (const s of signedDocs) {
      if (s.sourceDocumentId !== null) {
        signedMap.set(s.sourceDocumentId, s);
      }
    }

    return docs.map((doc) => {
      const { warehouseId, rawPayload, items, ...restDoc } = doc;
      const sanitizedItems = items
        ? items.map((item: any) => {
            const {
              id: itemId,
              documentReferenceId,
              inventoryId,
              ...restItem
            } = item;
            const inv = inventoryMap.get(inventoryId);
            return {
              ...restItem,
              inventoryId,
              inventoryUuid: inv?.uuid || null,
              inventorySku: inv?.sku || null,
              inventoryName: inv?.name || null,
              inventoryUom: inv?.uom || null,
            };
          })
        : [];

      const isSigned = signedMap.has(doc.id);
      const signatureInfo = signedMap.get(doc.id) || null;

      return {
        ...restDoc,
        items: sanitizedItems,
        isSigned,
        signatureInfo,
        ...(includeRawPayload ? { rawPayload } : {}),
      };
    });
  }

  private async sanitizeDocReference(doc: any): Promise<any> {
    if (!doc) return null;
    const sanitized = await this.sanitizeDocReferences([doc], true);
    return sanitized[0];
  }

  /**
   * Safe helper to execute Odoo RPC calls.
   * If session expires, invalidates, refreshes session and retries.
   * Prevents session storm under restrict_concurrent_login by validating against DB.
   */
  private async safeOdooCall(
    warehouseId: number,
    model: string,
    method: string,
    args: any[] = [],
    kwargs: any = {},
  ): Promise<any> {
    const account = await this.prisma.odooAccount.findUnique({
      where: { warehouseId },
    });

    if (!account) {
      throw new NotFoundException(
        'Akun Odoo untuk gudang aktif ini belum dikonfigurasi.',
      );
    }

    // 1. Validate session initially
    await this.odooSessionManager.validateAndRefreshSession(account.id);

    // Fetch the account again to get the fresh sessionId
    let refreshedAccount = await this.prisma.odooAccount.findUnique({
      where: { id: account.id },
    });

    if (!refreshedAccount?.sessionId || !refreshedAccount?.baseUrl) {
      throw new BadRequestException('Session ID Odoo kosong setelah refresh.');
    }

    const triedSessionId = refreshedAccount.sessionId;

    try {
      return await this.odooClient.call(
        refreshedAccount.baseUrl,
        triedSessionId,
        {
          model,
          method,
          args,
          kwargs,
        },
      );
    } catch (err: any) {
      const isSessionExpired =
        err.message.includes('Session expired') ||
        err.message.includes('Session Expired') ||
        err.message.includes('SessionExpiredException') ||
        err.message.includes('session expired');

      if (isSessionExpired) {
        // Query database again to see if session has changed in the meantime
        const currentAccount = await this.prisma.odooAccount.findUnique({
          where: { id: account.id },
        });

        const latestSessionId = currentAccount?.sessionId;
        if (latestSessionId && latestSessionId !== triedSessionId) {
          this.logger.log(
            `Session Odoo untuk gudang ${account.warehouseId} telah diperbarui oleh proses lain. Mencoba ulang dengan session baru...`,
          );
          return await this.odooClient.call(
            currentAccount.baseUrl,
            latestSessionId,
            {
              model,
              method,
              args,
              kwargs,
            },
          );
        }

        this.logger.log(
          `Session Odoo untuk gudang ${account.warehouseId} kedaluwarsa. Melakukan refresh session...`,
        );
        // Force refresh session
        await this.odooSessionManager.invalidateSession(account.id);
        await this.odooSessionManager.validateAndRefreshSession(account.id);

        refreshedAccount = await this.prisma.odooAccount.findUnique({
          where: { id: account.id },
        });

        if (refreshedAccount?.sessionId) {
          // Retry call once
          return await this.odooClient.call(
            refreshedAccount.baseUrl,
            refreshedAccount.sessionId,
            {
              model,
              method,
              args,
              kwargs,
            },
          );
        }
      }

      throw err;
    }
  }

  private stripIdField(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) {
      return obj.map((item) => this.stripIdField(item));
    }
    if (typeof obj === 'object') {
      const isProduct = 'sku' in obj && 'name' in obj;
      const isGateOpProduct = 'gateOperationId' in obj && 'inventoryId' in obj;

      const newObj: any = {};
      for (const key of Object.keys(obj)) {
        if (
          key === 'id' &&
          !isProduct &&
          !isGateOpProduct
        )
          continue;
        newObj[key] = this.stripIdField(obj[key]);
      }
      return newObj;
    }
    return obj;
  }

  async getRealizationHistory(warehouseId: number, uuid: string) {
    const doc = await this.prisma.documentReference.findFirst({
      where: { warehouseId, uuid },
      include: { items: true },
    });

    if (!doc) {
      throw new NotFoundException('Dokumen ERP tidak ditemukan.');
    }

    const otherOps = await this.prisma.gateOperation.findMany({
      where: {
        documentReferenceId: doc.id,
      },
      include: {
        products: {
          include: { inventory: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const docItemsSummary = await Promise.all(
      doc.items.map(async (docItem) => {
        const aggregate = await this.prisma.gateOperationProduct.aggregate({
          where: {
            inventoryId: docItem.inventoryId,
            gateOperation: {
              documentReferenceId: doc.id,
              status: { notIn: ['CANCELED', 'REJECTED'] },
            },
          },
          _sum: { quantity: true },
        });

        const erpQty = docItem.productQty || 0;
        const totalRealized = aggregate._sum.quantity || 0;
        const remainingQty = Math.max(0, erpQty - totalRealized);

        const inventory = await this.prisma.inventory.findUnique({
          where: { id: docItem.inventoryId },
          select: { sku: true },
        });

        let status = 'PENDING';
        if (totalRealized >= erpQty) {
          status = 'COMPLETED';
        } else if (totalRealized > 0) {
          status = 'PARTIAL';
        }

        return {
          productId: docItem.inventoryId,
          productName: docItem.productName,
          sku: inventory?.sku || docItem.analyticAccountName || '',
          uom: docItem.uom,
          erpQty,
          realizedQty: totalRealized,
          remainingQty,
          status,
        };
      }),
    );

    return this.stripIdField({
      otherOperations: otherOps,
      summary: docItemsSummary,
    });
  }
}

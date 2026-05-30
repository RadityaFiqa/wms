import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { OdooClient } from '../odoo/odoo-client';
import { OdooSessionManager } from '../odoo/odoo-session.manager';

@Injectable()
export class ErpDocumentReferenceService {
  private readonly logger = new Logger(ErpDocumentReferenceService.name);
  private readonly PO_PICKING_TYPE = 11852;
  private readonly SO_PICKING_TYPE = 11849;

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooClient: OdooClient,
    private readonly odooSessionManager: OdooSessionManager,
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
  async triggerSync(warehouseId: number, createdBy: string): Promise<{ message: string }> {
    this.logger.log(`[SYNC-TRIGGER] Warehouse ${warehouseId} — triggered by ${createdBy}`);

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
        this.logger.log(`[SYNC-COMPLETE] Warehouse ${warehouseId}, log ${log.id} — synced ${result.syncedCount} documents`);
      })
      .catch((err) => {
        this.logger.error(`[SYNC-FAILED] Warehouse ${warehouseId}, log ${log.id} — ${err.message}`, err.stack);
      });

    return { message: 'Sync started' };
  }

  /**
   * Fetch current sync status and progress metrics.
   */
  async getSyncStatus(warehouseId: number) {
    const latestLog = await this.prisma.odooSyncLog.findFirst({
      where: { warehouseId },
      orderBy: { startedAt: 'desc' },
    });

    if (!latestLog) {
      return {
        status: 'SUCCESS',
        processedDocuments: 0,
        totalDocuments: 0,
        startedAt: null,
        lastSyncAt: null,
      };
    }

    const lastSuccess = await this.prisma.odooSyncLog.findFirst({
      where: { warehouseId, status: 'SUCCESS' },
      orderBy: { finishedAt: 'desc' },
    });

    return {
      status: latestLog.status,
      processedDocuments: latestLog.processedDocuments,
      totalDocuments: latestLog.totalDocuments,
      startedAt: latestLog.startedAt,
      lastSyncAt: lastSuccess?.finishedAt || null,
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
    this.logger.log(`[SYNC-JOB] Starting sync for warehouse ${warehouseId}, log ${logId}`);

    // Update log status to RUNNING
    await this.prisma.odooSyncLog.update({
      where: { id: logId },
      data: { status: 'RUNNING' },
    });
    this.logger.log(`[SYNC-JOB] Log ${logId} status set to RUNNING`);

    // 1. Get active OdooAccount configuration for this warehouse
    this.logger.log(`[SYNC-JOB] Fetching OdooAccount for warehouse ${warehouseId}...`);
    const account = await this.prisma.odooAccount.findUnique({
      where: { warehouseId },
      include: { warehouse: true },
    });

    if (!account) {
      const errorMsg = 'Akun Odoo untuk gudang aktif ini belum dikonfigurasi.';
      this.logger.error(`[SYNC-JOB] ${errorMsg}`);
      await this.prisma.odooSyncLog.update({
        where: { id: logId },
        data: { status: 'FAILED', errorMessage: errorMsg, finishedAt: new Date() },
      });
      throw new NotFoundException(errorMsg);
    }

    if (!account.isActive) {
      const errorMsg = 'Akun Odoo untuk gudang ini tidak aktif.';
      this.logger.error(`[SYNC-JOB] ${errorMsg}`);
      await this.prisma.odooSyncLog.update({
        where: { id: logId },
        data: { status: 'FAILED', errorMessage: errorMsg, finishedAt: new Date() },
      });
      throw new BadRequestException(errorMsg);
    }

    this.logger.log(`[SYNC-JOB] OdooAccount found: ID=${account.id}, baseUrl=${account.baseUrl}`);

    // 3. List PO & SO documents in Odoo using pagination
    const odooDocs: { id: number; state: string }[] = [];
    const limit = 100;

    try {
      // PO Incoming list using pagination
      const fetchedIds = new Set<number>();
      let offset = 0;
      let iterations = 0;

      this.logger.log(`[SYNC-JOB] Fetching PO (incoming) documents from Odoo (picking_type=${this.PO_PICKING_TYPE})...`);
      while (iterations < 100) {
        iterations++;
        this.logger.log(`[SYNC-JOB] PO fetch iteration ${iterations}, offset=${offset}`);
        const poRes = await this.safeOdooCall(warehouseId, 'stock.picking', 'web_search_read', [], {
          domain: [['picking_type_id', '=', this.PO_PICKING_TYPE]],
          specification: { id: {}, state: {} },
          limit,
          offset,
        });
        const records = poRes?.records || [];
        this.logger.log(`[SYNC-JOB] PO iteration ${iterations}: fetched ${records.length} records`);
        if (records.length === 0) break;

        let hasNew = false;
        for (const r of records) {
          if (!fetchedIds.has(r.id)) {
            fetchedIds.add(r.id);
            odooDocs.push({ id: r.id, state: r.state || 'draft' });
            hasNew = true;
          }
        }
        if (!hasNew || records.length < limit) break;
        offset += limit;
      }
      this.logger.log(`[SYNC-JOB] Total PO documents fetched: ${odooDocs.length}`);

      // SO Outgoing list using pagination
      const soStartCount = odooDocs.length;
      offset = 0;
      iterations = 0;
      this.logger.log(`[SYNC-JOB] Fetching SO (outgoing) documents from Odoo (picking_type=${this.SO_PICKING_TYPE})...`);
      while (iterations < 100) {
        iterations++;
        this.logger.log(`[SYNC-JOB] SO fetch iteration ${iterations}, offset=${offset}`);
        const soRes = await this.safeOdooCall(warehouseId, 'stock.picking', 'web_search_read', [], {
          domain: [['picking_type_id', '=', this.SO_PICKING_TYPE]],
          specification: { id: {}, state: {} },
          limit,
          offset,
        });
        const records = soRes?.records || [];
        this.logger.log(`[SYNC-JOB] SO iteration ${iterations}: fetched ${records.length} records`);
        if (records.length === 0) break;

        let hasNew = false;
        for (const r of records) {
          if (!fetchedIds.has(r.id)) {
            fetchedIds.add(r.id);
            odooDocs.push({ id: r.id, state: r.state || 'draft' });
            hasNew = true;
          }
        }
        if (!hasNew || records.length < limit) break;
        offset += limit;
      }
      this.logger.log(`[SYNC-JOB] Total SO documents fetched: ${odooDocs.length - soStartCount}`);
    } catch (err: any) {
      const errorMsg = `Gagal list dokumen dari Odoo: ${err.message}`;
      this.logger.error(`[SYNC-JOB] ${errorMsg}`, err.stack);
      await this.prisma.odooSyncLog.update({
        where: { id: logId },
        data: { status: 'FAILED', errorMessage: errorMsg, finishedAt: new Date() },
      });
      await this.prisma.odooAccount.update({
        where: { id: account.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: 'FAILED',
          lastSyncError: errorMsg,
          lastSyncBy: triggeredBy,
        },
      }).catch((e) => this.logger.error('[SYNC-JOB] Failed to update OdooAccount sync status', e));
      throw new BadRequestException(errorMsg);
    }

    // Deduplicate
    const uniqueDocsMap = new Map<number, string>();
    for (const doc of odooDocs) {
      uniqueDocsMap.set(doc.id, doc.state);
    }
    const allOdooDocs = Array.from(uniqueDocsMap.entries()).map(([id, state]) => ({ id, state }));
    const totalDocuments = allOdooDocs.length;
    this.logger.log(`[SYNC-JOB] Total unique documents after dedup: ${totalDocuments}`);

    // Update log total count
    await this.prisma.odooSyncLog.update({
      where: { id: logId },
      data: { totalDocuments },
    });

    if (totalDocuments === 0) {
      this.logger.log(`[SYNC-JOB] No documents to sync — marking SUCCESS`);
      const finishedAt = new Date();
      await this.prisma.odooSyncLog.update({
        where: { id: logId },
        data: { status: 'SUCCESS', finishedAt, processedDocuments: 0 },
      });
      // Sync complete but 0 records
      await this.prisma.odooAccount.update({
        where: { id: account.id },
        data: {
          lastSyncAt: finishedAt,
          lastSyncStatus: 'SUCCESS',
          lastSyncError: null,
          lastSyncBy: triggeredBy,
          lastSyncCount: 0,
        },
      });
      return { success: true, syncedCount: 0 };
    }

    // Retrieve existing local documents for status checks
    this.logger.log(`[SYNC-JOB] Fetching existing local documents for comparison...`);
    const localDocs = await this.prisma.documentReference.findMany({
      where: { warehouseId },
      select: { id: true, state: true },
    });
    const localDocsMap = new Map<number, string>();
    for (const doc of localDocs) {
      localDocsMap.set(doc.id, doc.state);
    }
    this.logger.log(`[SYNC-JOB] Found ${localDocs.length} existing local documents`);

    // 4. Batch Fetch document details using web_read for new and uncompleted documents
    const specification = {
      id: {},
      name: {},
      state: {},
      picking_type_code: {},
      partner_id: { fields: { display_name: {} } },
      purchase_id: { fields: { display_name: {} } },
      origin: {},
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

    let processedDocuments = 0;
    const batchSize = 100;

    try {
      for (let i = 0; i < totalDocuments; i += batchSize) {
        const batchDocs = allOdooDocs.slice(i, i + batchSize);
        const batchIdsToFetch: number[] = [];
        let skippedDone = 0;

        for (const doc of batchDocs) {
          const erpId = doc.id;
          const localState = localDocsMap.get(erpId);
          if (localState === undefined || localState !== 'done') {
            batchIdsToFetch.push(erpId);
          } else {
            skippedDone++;
          }
        }

        this.logger.log(
          `[SYNC-JOB] Batch ${Math.floor(i / batchSize) + 1}: ${batchDocs.length} docs, ` +
          `${batchIdsToFetch.length} to fetch, ${skippedDone} skipped (already done)`
        );

        if (batchIdsToFetch.length > 0) {
          this.logger.log(`[SYNC-JOB] Fetching details for ${batchIdsToFetch.length} documents from Odoo...`);
          const batchDetails = await this.safeOdooCall(warehouseId, 'stock.picking', 'web_read', [batchIdsToFetch], {
            specification,
          });

          if (batchDetails && Array.isArray(batchDetails)) {
            this.logger.log(`[SYNC-JOB] Received ${batchDetails.length} document details, upserting to DB...`);

            // Save/Upsert documents in local DB inside transactions
            await this.prisma.$transaction(async (tx) => {
              for (const record of batchDetails) {
                const erpId = record.id;
                const documentNumber = record.name || `DOC-${erpId}`;
                const state = record.state || 'draft';
                const pickingTypeCode = record.picking_type_code || 'internal';
                const partnerName = this.getRelationalName(record.partner_id);
                const purchaseName = this.getRelationalName(record.purchase_id);
                const origin = record.origin || null;
                const sourceLocationName = this.getRelationalName(record.location_id);
                const destinationLocationName = this.getRelationalName(record.location_dest_id);
                const scheduledDate = record.scheduled_date ? new Date(record.scheduled_date) : null;
                const dateDone = record.date_done ? new Date(record.date_done) : null;
                const driver = record.driver || null;
                const plateNumber = record.plat_number || null;

                const rawItems = record.move_ids_without_package || [];

                // Pre-calculate sums
                const totalItems = rawItems.length;
                const totalQuantity = rawItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0.0), 0.0);

                this.logger.log(
                  `[SYNC-JOB] Upserting document: erpId=${erpId}, number=${documentNumber}, ` +
                  `state=${state}, type=${pickingTypeCode}, items=${totalItems}`
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
                    const productId = this.getRelationalId(item.product_id) || 0;
                    const productName = this.getRelationalName(item.product_id) || 'Unnamed Product';
                    const uom = this.getRelationalName(item.product_uom) || 'Unit';
                    const analyticAccountName = this.getRelationalName(item.analytic_account_id);
                    const quantity = Number(item.quantity) || 0.0;
                    const productQty = Number(item.product_qty) || 0.0;
                    const secondaryQuantity = item.sh_sec_qty !== undefined ? Number(item.sh_sec_qty) : null;
                    const secondaryUom = this.getRelationalName(item.sh_sec_uom_id);

                    return {
                      id: moveId,
                      documentReferenceId: docRef.id,
                      productId,
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

                  this.logger.log(`[SYNC-JOB] Upserted ${itemsData.length} items for document id=${docRef.id}`);
                } else {
                  await tx.documentReferenceItem.deleteMany({
                    where: { documentReferenceId: docRef.id },
                  });
                }
              }
            });
          }
        }

        processedDocuments += batchDocs.length;
        const progressPct = Math.floor((processedDocuments / totalDocuments) * 100);

        // Update progress metrics in sync log
        await this.prisma.odooSyncLog.update({
          where: { id: logId },
          data: { processedDocuments },
        });

        this.logger.log(`[SYNC-JOB] Progress: ${processedDocuments}/${totalDocuments} (${progressPct}%)`);
      }

      const finishedAt = new Date();
      await this.prisma.odooSyncLog.update({
        where: { id: logId },
        data: { status: 'SUCCESS', finishedAt, processedDocuments: totalDocuments },
      });

      // Update OdooAccount status on success
      await this.prisma.odooAccount.update({
        where: { id: account.id },
        data: {
          lastSyncAt: finishedAt,
          lastSyncStatus: 'SUCCESS',
          lastSyncError: null,
          lastSyncBy: triggeredBy,
          lastSyncCount: totalDocuments,
        },
      });

      this.logger.log(`[SYNC-JOB] ✅ Sync completed successfully for warehouse ${warehouseId}. Total synced: ${totalDocuments}`);

      return {
        success: true,
        syncedCount: totalDocuments,
      };
    } catch (err: any) {
      const finishedAt = new Date();
      this.logger.error(`[SYNC-JOB] ❌ Sync failed for warehouse ${warehouseId}: ${err.message}`, err.stack);
      await this.prisma.odooSyncLog.update({
        where: { id: logId },
        data: { status: 'FAILED', errorMessage: err.message, finishedAt },
      });

      await this.prisma.odooAccount.update({
        where: { id: account.id },
        data: {
          lastSyncAt: finishedAt,
          lastSyncStatus: 'FAILED',
          lastSyncError: `Gagal menyimpan data ke database: ${err.message}`,
          lastSyncBy: triggeredBy,
        },
      }).catch((e) => this.logger.error('[SYNC-JOB] Failed to update OdooAccount sync status', e));
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
    },
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      warehouseId,
    };

    if (query.search) {
      where.documentNumber = { contains: query.search, mode: 'insensitive' };
    }

    if (query.type) {
      where.pickingTypeCode = query.type === 'IN' ? 'incoming' : 'outgoing';
    }

    if (query.state) {
      where.state = query.state;
    }

    if (query.startDate || query.endDate) {
      where.scheduledDate = {};
      if (query.startDate) {
        where.scheduledDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.scheduledDate.lte = end;
      }
    }

    // 1. Fetch paginated documents
    const [total, data] = await Promise.all([
      this.prisma.documentReference.count({ where }),
      this.prisma.documentReference.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledDate: 'desc' },
        include: {
          items: true,
        },
      }),
    ]);

    // 2. Fetch overall summary stats for active warehouse context
    const [totalCount, incomingCount, outgoingCount, odooAccount] = await Promise.all([
      this.prisma.documentReference.count({ where: { warehouseId } }),
      this.prisma.documentReference.count({ where: { warehouseId, pickingTypeCode: 'incoming' } }),
      this.prisma.documentReference.count({ where: { warehouseId, pickingTypeCode: 'outgoing' } }),
      this.prisma.odooAccount.findUnique({ where: { warehouseId } }),
    ]);

    const summary = {
      totalDocuments: totalCount,
      totalIncoming: incomingCount,
      totalOutgoing: outgoingCount,
      lastSyncTime: odooAccount?.lastSyncAt || null,
    };

    return {
      data: await this.sanitizeDocReferences(data),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary,
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
    this.logger.log(`[FORCE-SYNC] Document ${idOrUuid} for warehouse ${warehouseId}, triggered by ${triggeredBy}`);

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

    this.logger.log(`[FORCE-SYNC] Found local document: id=${doc.id}, number=${doc.documentNumber}`);

    // 2. Get active OdooAccount configuration
    const account = await this.prisma.odooAccount.findUnique({
      where: { warehouseId },
    });

    if (!account) {
      throw new NotFoundException('Akun Odoo untuk gudang aktif ini belum dikonfigurasi.');
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
      this.logger.log(`[FORCE-SYNC] Fetching document id=${doc.id} from Odoo...`);
      const res = await this.safeOdooCall(warehouseId, 'stock.picking', 'web_read', [[doc.id]], {
        specification,
      });

      if (!res || !Array.isArray(res) || res.length === 0) {
        throw new NotFoundException('Dokumen tidak ditemukan di Odoo.');
      }
      record = res[0];
      this.logger.log(`[FORCE-SYNC] Fetched document from Odoo: name=${record.name}, state=${record.state}`);
    } catch (err: any) {
      this.logger.error(`[FORCE-SYNC] Failed to fetch from Odoo: ${err.message}`, err.stack);
      throw new BadRequestException(`Gagal mengambil detail dokumen dari Odoo: ${err.message}`);
    }

    // 5. Update the local database inside transaction
    this.logger.log(`[FORCE-SYNC] Updating local DB for document id=${doc.id}...`);
    const updatedDoc = await this.prisma.$transaction(async (tx) => {
      const erpId = record.id;
      const documentNumber = record.name || `DOC-${erpId}`;
      const state = record.state || 'draft';
      const pickingTypeCode = record.picking_type_code || 'internal';
      const partnerName = this.getRelationalName(record.partner_id);
      const purchaseName = this.getRelationalName(record.purchase_id);
      const origin = record.origin || null;
      const sourceLocationName = this.getRelationalName(record.location_id);
      const destinationLocationName = this.getRelationalName(record.location_dest_id);
      const scheduledDate = record.scheduled_date ? new Date(record.scheduled_date) : null;
      const dateDone = record.date_done ? new Date(record.date_done) : null;
      const driver = record.driver || null;
      const plateNumber = record.plat_number || null;

      const rawItems = record.move_ids_without_package || [];
      const totalItems = rawItems.length;
      const totalQuantity = rawItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0.0), 0.0);

      const docRef = await tx.documentReference.update({
        where: { id: doc.id },
        data: {
          documentNumber,
          state,
          pickingTypeCode,
          partnerName,
          purchaseName,
          origin,
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
      });

      // Upsert document items to maintain integrity and prevent cascade delete of references
      if (rawItems.length > 0) {
        const itemsData = rawItems.map((item: any) => {
          const moveId = item.id; // Odoo move ID
          const productId = this.getRelationalId(item.product_id) || 0;
          const productName = this.getRelationalName(item.product_id) || 'Unnamed Product';
          const uom = this.getRelationalName(item.product_uom) || 'Unit';
          const analyticAccountName = this.getRelationalName(item.analytic_account_id);
          const quantity = Number(item.quantity) || 0.0;
          const productQty = Number(item.product_qty) || 0.0;
          const secondaryQuantity = item.sh_sec_qty !== undefined ? Number(item.sh_sec_qty) : null;
          const secondaryUom = this.getRelationalName(item.sh_sec_uom_id);

          return {
            id: moveId,
            documentReferenceId: docRef.id,
            productId,
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
      } else {
        await tx.documentReferenceItem.deleteMany({
          where: { documentReferenceId: docRef.id },
        });
      }

      return tx.documentReference.findUnique({
        where: { id: docRef.id },
        include: { items: true },
      });
    });

    this.logger.log(`[FORCE-SYNC] ✅ Document ${doc.documentNumber} force-synced successfully`);
    return this.sanitizeDocReference(updatedDoc);
  }

  private async sanitizeDocReferences(docs: any[]): Promise<any[]> {
    if (!docs || docs.length === 0) return [];

    // Collect all productIds across all items in all docs
    const productIds: number[] = [];
    for (const doc of docs) {
      if (doc.items) {
        for (const item of doc.items) {
          if (item.productId) {
            productIds.push(item.productId);
          }
        }
      }
    }

    // Lookup product UUIDs
    const productMap = new Map<number, string>();
    if (productIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, uuid: true },
      });
      for (const p of products) {
        productMap.set(p.id, p.uuid);
      }
    }

    return docs.map((doc) => {
      const { id, warehouseId, rawPayload, items, ...restDoc } = doc;
      const sanitizedItems = items ? items.map((item: any) => {
        const { id: itemId, documentReferenceId, productId, ...restItem } = item;
        return {
          ...restItem,
          productUuid: productMap.get(productId) || null,
        };
      }) : [];

      return {
        ...restDoc,
        items: sanitizedItems,
      };
    });
  }

  private async sanitizeDocReference(doc: any): Promise<any> {
    if (!doc) return null;
    const sanitized = await this.sanitizeDocReferences([doc]);
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
      throw new NotFoundException('Akun Odoo untuk gudang aktif ini belum dikonfigurasi.');
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
      return await this.odooClient.call(refreshedAccount.baseUrl, triedSessionId, {
        model,
        method,
        args,
        kwargs,
      });
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
          return await this.odooClient.call(currentAccount.baseUrl, latestSessionId, {
            model,
            method,
            args,
            kwargs,
          });
        }

        this.logger.log(`Session Odoo untuk gudang ${account.warehouseId} kedaluwarsa. Melakukan refresh session...`);
        // Force refresh session
        await this.odooSessionManager.invalidateSession(account.id);
        await this.odooSessionManager.validateAndRefreshSession(account.id);

        refreshedAccount = await this.prisma.odooAccount.findUnique({
          where: { id: account.id },
        });

        if (refreshedAccount?.sessionId) {
          // Retry call once
          return await this.odooClient.call(refreshedAccount.baseUrl, refreshedAccount.sessionId, {
            model,
            method,
            args,
            kwargs,
          });
        }
      }

      throw err;
    }
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { OdooClient } from './odoo-client';
import { OdooSessionManager } from './odoo-session.manager';
import { ErpDocumentReferenceService } from '../erp-document-reference/erp-document-reference.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class OdooSyncService {
  private readonly logger = new Logger(OdooSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooClient: OdooClient,
    private readonly odooSessionManager: OdooSessionManager,
    @Inject(forwardRef(() => ErpDocumentReferenceService))
    private readonly erpDocService: ErpDocumentReferenceService,
    @Inject(forwardRef(() => InventoryService))
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Safe helper to parse relational array [id, name] or relational object { id, display_name }
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
   * Trigger the unified Odoo Sync.
   * Runs in the background (fire-and-forget) to prevent blocking HTTP request.
   */
  async triggerSyncAll(
    warehouseId: number,
    createdBy: string,
  ): Promise<{ message: string }> {
    this.logger.log(
      `[UNIFIED-SYNC-TRIGGER] Warehouse ${warehouseId} — triggered by ${createdBy}`,
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
          `[UNIFIED-SYNC-TRIGGER] Found stuck sync log ID ${activeSync.id} (started at ${activeSync.createdAt}). Marking as FAILED.`,
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

    // Validate OdooAccount exists and is active before launching bg job
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
    this.logger.log(`[UNIFIED-SYNC-TRIGGER] Created sync log entry ID: ${log.id}`);

    // 2. Fire-and-forget background execution
    this.executeSyncAllJob(warehouseId, log.id, createdBy)
      .then((res) => {
        this.logger.log(
          `[UNIFIED-SYNC-COMPLETE] Warehouse ${warehouseId}, log ${log.id} — success. Documents: ${res.documentsCount}, Inventory Quants: ${res.inventoryCount}`,
        );
      })
      .catch((err) => {
        this.logger.error(
          `[UNIFIED-SYNC-FAILED] Warehouse ${warehouseId}, log ${log.id} — failure: ${err.message}`,
          err.stack,
        );
      });

    return { message: 'Sync started' };
  }

  /**
   * Orchestrates fetching all data from Odoo, then updating the database inside a single transaction.
   */
  async executeSyncAllJob(
    warehouseId: number,
    logId: number,
    triggeredBy: string,
  ): Promise<{ success: boolean; documentsCount: number; inventoryCount: number }> {
    this.logger.log(
      `[UNIFIED-SYNC-JOB] Starting unified sync for warehouse ${warehouseId}, log ${logId}`,
    );

    // Update log status to RUNNING
    await this.prisma.odooSyncLog.update({
      where: { id: logId },
      data: { status: 'RUNNING' },
    });

    // 1. Fetch Odoo Account details
    const account = await this.prisma.odooAccount.findUnique({
      where: { warehouseId },
      include: { warehouse: true },
    });

    if (!account || !account.isActive) {
      const errorMsg = 'Akun Odoo untuk gudang ini tidak aktif atau belum dikonfigurasi.';
      await this.updateStatusOnFailure(warehouseId, logId, triggeredBy, errorMsg);
      throw new BadRequestException(errorMsg);
    }

    const odooReference = account.warehouse?.odooReference;
    if (!odooReference) {
      const errorMsg = 'Referensi Odoo untuk gudang ini belum dikonfigurasi.';
      await this.updateStatusOnFailure(warehouseId, logId, triggeredBy, errorMsg);
      throw new BadRequestException(errorMsg);
    }

    // 2. Refresh session dynamically to ensure validity
    await this.odooSessionManager.validateAndRefreshSession(account.id);

    try {
      // SECTION A: Fetch ERP Documents from Odoo
      const {
        allFetchedDocRecords,
        allActiveFetchedDocRecords,
        docOffset,
      } = await this.fetchErpDocuments(
        warehouseId,
        logId,
        account.lastDocumentsOffset ?? 0,
      );

      // SECTION B: Fetch Inventory details from Odoo
      const {
        fetchedProducts,
        fetchedLocations,
        fetchedQuants,
      } = await this.fetchInventoryData(warehouseId, account.username);

      // SECTION C: DB Transaction (atomic commit / rollback)
      this.logger.log(`[UNIFIED-SYNC-JOB] Initiating database transaction...`);
      await this.prisma.$transaction(
        async (tx) => {
          // 1. Write ERP Documents
          this.logger.log(`[UNIFIED-SYNC-JOB] Writing ERP documents to DB...`);
          for (const record of allFetchedDocRecords) {
            await this.erpDocService.upsertDocumentRecord(tx, record, warehouseId);
          }
          for (const record of allActiveFetchedDocRecords) {
            await this.erpDocService.upsertDocumentRecord(tx, record, warehouseId);
          }

          // 2. Write Inventory Data
          this.logger.log(`[UNIFIED-SYNC-JOB] Writing inventory quants to DB...`);
          await this.inventoryService.saveInventorySyncData(
            tx,
            warehouseId,
            fetchedProducts,
            fetchedLocations,
            fetchedQuants,
          );

          // 3. Update Sync Logs & Stats
          const finishedAt = new Date();
          await this.prisma.odooSyncLog.update({
            where: { id: logId },
            data: {
              status: 'SUCCESS',
              finishedAt,
              processedDocuments: docOffset,
            },
          });

          await this.prisma.odooAccount.update({
            where: { id: account.id },
            data: {
              // Documents Sync Status
              lastSyncDocumentsAt: finishedAt,
              lastSyncDocumentsStatus: 'SUCCESS',
              lastSyncDocumentsError: null,
              lastSyncDocumentsBy: triggeredBy,
              lastSyncDocumentsCount: allFetchedDocRecords.length,
              lastDocumentsOffset: Number(docOffset) - 1,

              // Inventory Sync Status
              lastSyncInventoryAt: finishedAt,
              lastSyncInventoryStatus: 'SUCCESS',
              lastSyncInventoryError: null,
              lastSyncInventoryBy: triggeredBy,
              lastSyncInventoryCount: fetchedQuants.length,
            },
          });
        },
        { timeout: 900_000 },
      );

      this.logger.log(`[UNIFIED-SYNC-JOB] Transaction committed successfully for warehouse ${warehouseId}`);
      return {
        success: true,
        documentsCount: allFetchedDocRecords.length,
        inventoryCount: fetchedQuants.length,
      };
    } catch (err: any) {
      this.logger.error(
        `[UNIFIED-SYNC-JOB] Sync failed, reverting database changes: ${err.message}`,
        err.stack,
      );
      await this.updateStatusOnFailure(warehouseId, logId, triggeredBy, err.message);
      throw err;
    }
  }

  /**
   * Helper to fetch ERP documents from Odoo.
   */
  private async fetchErpDocuments(
    warehouseId: number,
    logId: number,
    lastDocumentsOffset: number,
  ): Promise<{
    allFetchedDocRecords: any[];
    allActiveFetchedDocRecords: any[];
    docOffset: number;
  }> {
    this.logger.log(`[UNIFIED-SYNC-JOB] Fetching ERP documents...`);
    const docLimit = 100;
    let docOffset = lastDocumentsOffset;
    let totalDocuments = 0;

    try {
      totalDocuments = await this.safeOdooCall(
        warehouseId,
        'stock.picking',
        'search_count',
        [],
        { domain: [] },
      );
      this.logger.log(`[UNIFIED-SYNC-JOB] Total ERP documents matching domain: ${totalDocuments}`);
    } catch (err: any) {
      this.logger.warn(`[UNIFIED-SYNC-JOB] Failed to fetch total document count: ${err.message}`);
    }

    if (docOffset > totalDocuments) {
      docOffset = 0;
    }

    // Update log total count
    await this.prisma.odooSyncLog.update({
      where: { id: logId },
      data: { totalDocuments },
    });

    const allFetchedDocRecords: any[] = [];
    while (true) {
      this.logger.log(`[UNIFIED-SYNC-JOB] Fetching stock.picking: offset=${docOffset}, limit=${docLimit}`);
      const poRes = await this.safeOdooCall(
        warehouseId,
        'stock.picking',
        'web_search_read',
        [],
        {
          domain: [],
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
          offset: docOffset,
          limit: docLimit,
          order: 'id asc',
          count_limit: 999_999,
        },
      );

      const records = poRes?.records || [];
      this.logger.log(`[UNIFIED-SYNC-JOB] Fetched ${records.length} documents`);
      if (records.length === 0) break;

      allFetchedDocRecords.push(...records);
      docOffset += records.length;

      // Update processedDocuments in sync log to track progress in real-time
      await this.prisma.odooSyncLog.update({
        where: { id: logId },
        data: { processedDocuments: docOffset },
      });

      if (records.length < docLimit) break;
    }

    // Refresh Active/Open Documents details from Odoo
    const activeDocuments = await this.prisma.documentReference.findMany({
      where: {
        warehouseId,
        state: { notIn: ['done', 'cancel'] },
      },
      select: { id: true },
    });

    this.logger.log(`[UNIFIED-SYNC-JOB] Refreshing ${activeDocuments.length} active documents...`);
    const allActiveFetchedDocRecords: any[] = [];
    for (const doc of activeDocuments) {
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
        allActiveFetchedDocRecords.push(res[0]);
      }
    }

    return {
      allFetchedDocRecords,
      allActiveFetchedDocRecords,
      docOffset,
    };
  }

  /**
   * Helper to fetch inventory data from Odoo.
   */
  private async fetchInventoryData(
    warehouseId: number,
    username: string,
  ): Promise<{
    fetchedProducts: any[];
    fetchedLocations: any[];
    fetchedQuants: any[];
  }> {
    this.logger.log(
      `[UNIFIED-SYNC-JOB] Fetching inventory info (res.users context, product.product, stock.location, stock.quant)...`,
    );
    let uid = 6900;
    let allowed_company_ids = [122];
    let current_company_id = 122;

    try {
      const userRes = await this.safeOdooCall(
        warehouseId,
        'res.users',
        'web_search_read',
        [],
        {
          domain: [['login', '=', username]],
          specification: {
            id: {},
            company_id: { fields: { display_name: {} } },
            company_ids: { fields: { display_name: {} } },
          },
          limit: 1,
        },
      );
      const userRecord = userRes?.records?.[0];
      if (userRecord) {
        uid = userRecord.id;
        current_company_id = userRecord.company_id?.id || 122;
        allowed_company_ids = Array.isArray(userRecord.company_ids)
          ? userRecord.company_ids.map((c: any) => c.id).filter(Boolean)
          : [current_company_id];
      }
    } catch (err: any) {
      this.logger.warn(`[UNIFIED-SYNC-JOB] Failed to fetch res.users context: ${err.message}. Using defaults.`);
    }

    const context = {
      lang: 'id_ID',
      tz: 'Asia/Makassar',
      uid,
      allowed_company_ids,
      bin_size: true,
      current_company_id,
    };

    const productResponse = await this.safeOdooCall(
      warehouseId,
      'product.product',
      'web_search_read',
      [],
      {
        specification: {
          priority: {},
          default_code: {},
          barcode: {},
          name: {},
          is_published: {},
          product_template_variant_value_ids: { fields: { display_name: {} } },
          company_id: { fields: { display_name: {} } },
          lst_price: {},
          standard_price: {},
          categ_id: { fields: { display_name: {} } },
          product_tag_ids: { fields: { display_name: {} } },
          additional_product_tag_ids: { fields: { display_name: {} } },
          ribbon_id: { fields: { display_name: {} } },
          type: {},
          uom_id: { fields: { display_name: {} } },
          sh_secondary_uom_onhand: {},
          sh_secondary_uom_forecasted: {},
          sh_secondary_uom_id: { fields: { display_name: {} } },
          product_tmpl_id: { fields: {} },
          active: {},
        },
        offset: 0,
        order: '',
        limit: 5000,
        context,
        count_limit: 10001,
        domain: [],
      },
    );
    const fetchedProducts = productResponse?.records || [];

    const locationResponse = await this.safeOdooCall(
      warehouseId,
      'stock.location',
      'web_search_read',
      [],
      {
        specification: {
          company_id: { fields: { display_name: {} } },
          triger_compute: {},
          branch_id: { fields: { display_name: {} } },
          warehouse_id: { fields: { display_name: {} } },
          active: {},
          complete_name: {},
          qty_on_hand: {},
          usage: {},
          barcode: {},
          posx: {},
          posy: {},
          posz: {},
          sizex: {},
          sizey: {},
          sizez: {},
          tag_ids: { fields: { display_name: {}, color: {} } },
        },
        offset: 0,
        order: '',
        limit: 5000,
        context: {
          ...context,
          params: {
            action: 2693,
            model: 'stock.location',
            view_type: 'list',
            cids: current_company_id,
            menu_id: 2090,
          },
          create: false,
          delete: false,
          edit: false,
        },
        count_limit: 10001,
        domain: [
          '&',
          '&',
          ['usage', '=', 'internal'],
          ['access_user_ids', 'in', [uid]],
          ['usage', '=', 'internal'],
        ],
      },
    );
    const fetchedLocations = locationResponse?.records || [];

    const quantDomain = [
      ['quantity', '>=', 0.01],
      ['product_id.type', '=', 'product'],
      ['location_id.usage', '=', 'internal'],
    ];
    const quantSpecification = {
      id: {},
      product_id: {
        fields: {
          display_name: {},
          default_code: {},
          uom_id: { fields: { display_name: {} } },
        },
      },
      location_id: { fields: { display_name: {} } },
      lot_id: { fields: { display_name: {} } },
      quantity: {},
      reserved_quantity: {},
      available_quantity: {},
      sh_secondary_unit_qty: {},
    };

    const quantResponse = await this.safeOdooCall(
      warehouseId,
      'stock.quant',
      'web_search_read',
      [],
      {
        domain: quantDomain,
        specification: quantSpecification,
        limit: 5000,
      },
    );
    const fetchedQuants = quantResponse?.records || [];

    return {
      fetchedProducts,
      fetchedLocations,
      fetchedQuants,
    };
  }

  private async updateStatusOnFailure(
    warehouseId: number,
    logId: number,
    triggeredBy: string,
    errorMessage: string,
  ) {
    const finishedAt = new Date();
    try {
      await this.prisma.odooSyncLog.update({
        where: { id: logId },
        data: {
          status: 'FAILED',
          errorMessage,
          finishedAt,
        },
      });

      const account = await this.prisma.odooAccount.findUnique({
        where: { warehouseId },
      });

      if (account) {
        await this.prisma.odooAccount.update({
          where: { id: account.id },
          data: {
            // Set failure details on both sync aspects
            lastSyncDocumentsAt: finishedAt,
            lastSyncDocumentsStatus: 'FAILED',
            lastSyncDocumentsError: errorMessage,
            lastSyncDocumentsBy: triggeredBy,

            lastSyncInventoryAt: finishedAt,
            lastSyncInventoryStatus: 'FAILED',
            lastSyncInventoryError: errorMessage,
            lastSyncInventoryBy: triggeredBy,
          },
        });
      }
    } catch (e: any) {
      this.logger.error(`Failed to record sync failure status in DB: ${e.message}`);
    }
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

    // Validate session initially
    await this.odooSessionManager.validateAndRefreshSession(account.id);

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
        const currentAccount = await this.prisma.odooAccount.findUnique({
          where: { id: account.id },
        });

        const latestSessionId = currentAccount?.sessionId;
        if (latestSessionId && latestSessionId !== triedSessionId) {
          this.logger.log(
            `Session Odoo untuk gudang ${account.warehouseId} telah diperbarui oleh proses lain. Mencoba ulang...`,
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
        await this.odooSessionManager.invalidateSession(account.id);
        await this.odooSessionManager.validateAndRefreshSession(account.id);

        refreshedAccount = await this.prisma.odooAccount.findUnique({
          where: { id: account.id },
        });

        if (refreshedAccount?.sessionId) {
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
}

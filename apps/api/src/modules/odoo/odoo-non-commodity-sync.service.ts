import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { OdooClient } from './odoo-client';
import { OdooSessionManager } from './odoo-session.manager';
import { OdooRepository } from './odoo.repository';

interface PoFieldSpecs {
  poModelFields: Record<string, any>;
  lineModelFields: Record<string, any>;
  poFieldsToFetch: string[];
  lineFieldsToFetch: string[];
}

@Injectable()
export class OdooNonCommoditySyncService {
  private readonly logger = new Logger(OdooNonCommoditySyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooClient: OdooClient,
    private readonly odooSessionManager: OdooSessionManager,
    private readonly odooRepository: OdooRepository,
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
   * Resolves Budget Activity Name for an order line without assuming array index matching.
   */
  private resolveBudgetActivityName(
    orderLine: any,
    budgetActivityLines: any[],
  ): string | null {
    // 1. Direct budget_activity_id on the order line
    if (orderLine.budget_activity_id) {
      const directName = this.getRelationalName(orderLine.budget_activity_id);
      if (directName) return directName;
    }

    // 2. Reference to budget_activity_line_id on order line matching budget_activity_lines
    if (
      orderLine.budget_activity_line_id &&
      Array.isArray(budgetActivityLines)
    ) {
      const refId = this.getRelationalId(orderLine.budget_activity_line_id);
      if (refId) {
        const matchedLine = budgetActivityLines.find(
          (b) => b.id === refId || Number(b.id) === refId,
        );
        if (matchedLine) {
          const matchedName = this.getRelationalName(
            matchedLine.budget_activity_id,
          );
          if (matchedName) return matchedName;
        }
      }
    }

    // 3. If there is exactly ONE budget activity line on the PO, map all lines to it
    if (
      Array.isArray(budgetActivityLines) &&
      budgetActivityLines.length === 1
    ) {
      return this.getRelationalName(budgetActivityLines[0].budget_activity_id);
    }

    return null;
  }

  // In-memory active sync locks by warehouseId to prevent concurrent executions
  private readonly activeSyncWarehouses = new Set<number>();
  private readonly fieldsCache = new Map<string, Record<string, any>>();

  /**
   * Safe helper to fetch model fields from Odoo with in-memory caching.
   */
  private async getModelFields(
    accountId: number,
    model: string,
  ): Promise<Record<string, any>> {
    const cacheKey = `${accountId}:${model}`;
    if (this.fieldsCache.has(cacheKey)) {
      return this.fieldsCache.get(cacheKey)!;
    }

    try {
      const fields = await this.safeOdooCall(
        accountId,
        model,
        'fields_get',
        [],
        { attributes: ['type', 'string', 'relation'] },
      );
      if (fields && typeof fields === 'object') {
        this.fieldsCache.set(cacheKey, fields);
        return fields;
      }
    } catch (err: any) {
      this.logger.warn(
        `[NON-COMMODITY-SYNC] Failed to fetch fields_get for model ${model}: ${err.message}`,
      );
    }
    return {};
  }

  /**
   * Trigger Non Commodity Purchase Order synchronization.
   * Runs in the background (fire-and-forget).
   */
  async triggerSync(
    warehouseId: number,
    createdBy: string,
  ): Promise<{ message: string; alreadyInProgress?: boolean }> {
    this.logger.log(
      `[NON-COMMODITY-SYNC-TRIGGER] Warehouse ${warehouseId} — triggered by ${createdBy}`,
    );

    // Check in-memory lock first
    if (this.activeSyncWarehouses.has(warehouseId)) {
      this.logger.warn(
        `[NON-COMMODITY-SYNC-TRIGGER] Sync already active in-memory for warehouse ${warehouseId}`,
      );
      return { message: 'Sync already in progress', alreadyInProgress: true };
    }

    const account = await this.odooRepository.findByWarehouseId(
      warehouseId,
      true,
    );

    if (!account) {
      throw new NotFoundException(
        'Akun Odoo Non Commodity untuk gudang ini belum dikonfigurasi.',
      );
    }

    if (!account.isActive) {
      throw new BadRequestException(
        'Akun Odoo Non Commodity untuk gudang ini tidak aktif.',
      );
    }

    // Check DB status
    if (
      account.lastSyncDocumentsStatus === 'SYNCING' ||
      account.lastSyncDocumentsStatus === 'RUNNING'
    ) {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (
        account.lastSyncDocumentsAt &&
        account.lastSyncDocumentsAt > fifteenMinutesAgo
      ) {
        return { message: 'Sync already in progress', alreadyInProgress: true };
      }
      this.logger.warn(
        `[NON-COMMODITY-SYNC-TRIGGER] Previous sync timed out (>15m) for warehouse ${warehouseId}. Overriding.`,
      );
    }

    // Acquire lock immediately
    this.activeSyncWarehouses.add(warehouseId);

    // Mark as SYNCING immediately so any concurrent call sees active state
    await this.prisma.odooAccount.update({
      where: { id: account.id },
      data: {
        lastSyncDocumentsStatus: 'SYNCING',
        lastSyncDocumentsAt: new Date(),
        lastSyncDocumentsBy: createdBy,
        lastSyncDocumentsError: null,
      },
    });

    // Fire-and-forget background execution
    this.executeSyncJob(warehouseId, createdBy)
      .then((res) => {
        this.logger.log(
          `[NON-COMMODITY-SYNC-COMPLETE] Warehouse ${warehouseId} — success. Synced: ${res.syncedCount}, Total Offset: ${res.newOffset}`,
        );
      })
      .catch((err) => {
        this.logger.error(
          `[NON-COMMODITY-SYNC-FAILED] Warehouse ${warehouseId} — ${err.message}`,
          err.stack,
        );
      })
      .finally(() => {
        this.activeSyncWarehouses.delete(warehouseId);
      });

    return { message: 'Sync started' };
  }

  /**
   * Resets only lastDocumentsOffset to 0 for starting sync from beginning.
   * Does NOT delete any documents or alter credentials/configurations.
   */
  async resetOffset(
    warehouseId: number,
  ): Promise<{ message: string; lastOffset: number }> {
    const account = await this.odooRepository.findByWarehouseId(
      warehouseId,
      true,
    );

    if (!account) {
      throw new NotFoundException(
        'Akun Odoo Non Commodity untuk gudang ini belum dikonfigurasi.',
      );
    }

    if (
      this.activeSyncWarehouses.has(warehouseId) ||
      account.lastSyncDocumentsStatus === 'SYNCING' ||
      account.lastSyncDocumentsStatus === 'RUNNING'
    ) {
      throw new BadRequestException(
        'Tidak dapat mereset offset saat proses sinkronisasi sedang berjalan.',
      );
    }

    await this.prisma.odooAccount.update({
      where: { id: account.id },
      data: {
        lastDocumentsOffset: 0,
        lastSyncDocumentsStatus: 'IDLE',
        lastSyncDocumentsError: null,
      },
    });

    this.logger.log(
      `[NON-COMMODITY-SYNC] Offset reset to 0 for warehouse ${warehouseId}`,
    );

    return {
      message: 'Offset sinkronisasi berhasil direset ke 0.',
      lastOffset: 0,
    };
  }

  /**
   * Force re-sync a single Non Commodity PO document from Odoo, regardless of the sync offset.
   */
  async forceSyncDocument(
    warehouseId: number,
    uuid: string,
    triggeredBy: string,
  ): Promise<{ message: string; state: string | null }> {
    const doc = await this.prisma.documentPurchaseOrder.findFirst({
      where: { uuid, OR: [{ warehouseId }, { warehouseId: null }] },
      select: { id: true, documentNumber: true },
    });

    if (!doc) {
      throw new NotFoundException('Dokumen Purchase Order tidak ditemukan.');
    }

    const account = await this.odooRepository.findByWarehouseId(
      warehouseId,
      true,
    );

    if (!account) {
      throw new NotFoundException(
        'Akun Odoo Non Commodity untuk gudang ini belum dikonfigurasi.',
      );
    }

    if (!account.isActive) {
      throw new BadRequestException(
        'Akun Odoo Non Commodity untuk gudang ini tidak aktif.',
      );
    }

    this.logger.log(
      `[NON-COMMODITY-FORCE-SYNC] Document ${doc.documentNumber} (warehouse ${warehouseId}) — triggered by ${triggeredBy}`,
    );

    await this.odooSessionManager.validateAndRefreshSession(account.id);
    const specs = await this.getPoFieldSpecs(account.id);

    const poRecords = await this.fetchPurchaseOrders(
      account.id,
      [['id', '=', doc.id]],
      specs,
      0,
      1,
    );

    if (poRecords.length === 0) {
      throw new NotFoundException(
        `Dokumen ${doc.documentNumber} tidak ditemukan di Odoo.`,
      );
    }

    await this.processPurchaseOrderBatch(
      account.id,
      poRecords,
      specs,
      warehouseId,
      true,
    );

    const updated = await this.prisma.documentPurchaseOrder.findUnique({
      where: { id: doc.id },
      select: { state: true },
    });

    return {
      message: `Dokumen ${doc.documentNumber} berhasil disinkronisasi ulang.`,
      state: updated?.state ?? null,
    };
  }

  /**
   * Background task to perform Non Commodity PO synchronization.
   */
  async executeSyncJob(
    warehouseId: number,
    triggeredBy: string,
  ): Promise<{ success: boolean; syncedCount: number; newOffset: number }> {
    this.logger.log(
      `[NON-COMMODITY-SYNC-JOB] Starting PO sync for warehouse ${warehouseId}`,
    );

    const account = await this.odooRepository.findByWarehouseId(
      warehouseId,
      true,
    );

    if (!account || !account.isActive) {
      const errorMsg =
        'Akun Odoo Non Commodity untuk gudang ini tidak aktif atau belum dikonfigurasi.';
      this.logger.error(`[NON-COMMODITY-SYNC-JOB] ${errorMsg}`);
      throw new BadRequestException(errorMsg);
    }

    // Ensure status is marked as SYNCING
    await this.prisma.odooAccount.update({
      where: { id: account.id },
      data: {
        lastSyncDocumentsStatus: 'SYNCING',
        lastSyncDocumentsAt: new Date(),
        lastSyncDocumentsBy: triggeredBy,
        lastSyncDocumentsError: null,
      },
    });

    let offset = account.lastDocumentsOffset ?? 0;
    let totalSyncedInThisRun = 0;

    try {
      // Validate & refresh session
      await this.odooSessionManager.validateAndRefreshSession(account.id);

      const specs = await this.getPoFieldSpecs(account.id);
      const syncedPoIds = new Set<number>();

      const limit = 80;
      const domain = [
        '&',
        ['is_non_commodity', '=', true],
        ['company_id', 'in', [122]],
      ];

      while (true) {
        this.logger.log(
          `[NON-COMMODITY-SYNC-JOB] Fetching purchase.order: offset=${offset}, limit=${limit}`,
        );

        const poRecords = await this.fetchPurchaseOrders(
          account.id,
          domain,
          specs,
          offset,
          limit,
        );

        this.logger.log(
          `[NON-COMMODITY-SYNC-JOB] Fetched ${poRecords.length} purchase orders at offset ${offset}`,
        );

        if (poRecords.length === 0) {
          break;
        }

        const batchSyncedIds = await this.processPurchaseOrderBatch(
          account.id,
          poRecords,
          specs,
          warehouseId,
        );
        batchSyncedIds.forEach((id) => syncedPoIds.add(id));
        totalSyncedInThisRun += batchSyncedIds.length;

        offset += poRecords.length;

        // Persist progress offset to DB after each batch
        await this.prisma.odooAccount.update({
          where: { id: account.id },
          data: {
            lastDocumentsOffset: offset,
          },
        });

        if (poRecords.length < limit) {
          break;
        }
      }

      // Documents behind the offset are never fetched again, so re-sync those not yet done or cancelled
      totalSyncedInThisRun += await this.resyncOpenPurchaseOrders(
        account.id,
        specs,
        warehouseId,
        syncedPoIds,
      );

      const finishedAt = new Date();
      await this.prisma.odooAccount.update({
        where: { id: account.id },
        data: {
          lastSyncDocumentsAt: finishedAt,
          lastSyncDocumentsStatus: 'SUCCESS',
          lastSyncDocumentsError: null,
          lastSyncDocumentsBy: triggeredBy,
          lastSyncDocumentsCount: totalSyncedInThisRun,
          lastDocumentsOffset: offset,
        },
      });

      this.logger.log(
        `[NON-COMMODITY-SYNC-JOB] ✅ Non Commodity PO sync completed successfully for warehouse ${warehouseId}. Synced: ${totalSyncedInThisRun}, Final Offset: ${offset}`,
      );

      return {
        success: true,
        syncedCount: totalSyncedInThisRun,
        newOffset: offset,
      };
    } catch (err: any) {
      const finishedAt = new Date();
      this.logger.error(
        `[NON-COMMODITY-SYNC-JOB] ❌ Sync failed for warehouse ${warehouseId}: ${err.message}`,
        err.stack,
      );

      await this.prisma.odooAccount.update({
        where: { id: account.id },
        data: {
          lastSyncDocumentsAt: finishedAt,
          lastSyncDocumentsStatus: 'FAILED',
          lastSyncDocumentsError: err.message,
          lastSyncDocumentsBy: triggeredBy,
          lastDocumentsOffset: offset,
        },
      });

      throw err;
    } finally {
      this.activeSyncWarehouses.delete(warehouseId);
    }
  }

  /**
   * Inspect PO and PO line model fields so only supported fields are requested.
   */
  private async getPoFieldSpecs(accountId: number): Promise<PoFieldSpecs> {
    const poModelFields = await this.getModelFields(
      accountId,
      'purchase.order',
    );
    const lineModelFields = await this.getModelFields(
      accountId,
      'purchase.order.line',
    );
    const candidatePoFields = [
      'id',
      'name',
      'partner_ref',
      'partner_id',
      'company_id',
      'date_order',
      'date_approve',
      'amount_untaxed',
      'amount_total',
      'currency_id',
      'state',
      'date_planned',
      'invoice_status',
      'order_line',
      'budget_activity_lines',
    ];

    const poFieldsToFetch =
      Object.keys(poModelFields).length > 0
        ? candidatePoFields.filter((f) => f in poModelFields)
        : candidatePoFields.filter((f) => f !== 'budget_activity_lines');

    const candidateLineFields = [
      'id',
      'product_id',
      'name',
      'product_uom',
      'product_qty',
      'price_unit',
      'price_total',
      'price_subtotal',
      'budget_activity_id',
    ];

    // CRITICAL: NEVER include budget_activity_line_id; only query supported line fields
    const lineFieldsToFetch =
      Object.keys(lineModelFields).length > 0
        ? candidateLineFields.filter((f) => f in lineModelFields)
        : candidateLineFields.filter((f) => f !== 'budget_activity_id');

    return {
      poModelFields,
      lineModelFields,
      poFieldsToFetch,
      lineFieldsToFetch,
    };
  }

  /**
   * Fetch purchase.order headers matching a domain, falling back to web_search_read.
   */
  private async fetchPurchaseOrders(
    accountId: number,
    domain: any[],
    specs: PoFieldSpecs,
    offset: number,
    limit: number,
  ): Promise<any[]> {
    const { poFieldsToFetch } = specs;
    let poRecords: any[] = [];
    try {
      const searchRes = await this.safeOdooCall(
        accountId,
        'purchase.order',
        'search_read',
        [],
        {
          domain,
          fields: poFieldsToFetch,
          offset,
          limit,
          order: 'id asc',
        },
      );
      poRecords = Array.isArray(searchRes)
        ? searchRes
        : searchRes?.records || [];
    } catch (searchErr: any) {
      this.logger.warn(
        `[NON-COMMODITY-SYNC-JOB] search_read failed (${searchErr.message}), trying web_search_read fallback...`,
      );
      const spec: Record<string, any> = {};
      for (const f of poFieldsToFetch) {
        if (['partner_id', 'company_id', 'currency_id'].includes(f)) {
          spec[f] = { fields: { display_name: {} } };
        } else {
          spec[f] = {};
        }
      }
      const webRes = await this.safeOdooCall(
        accountId,
        'purchase.order',
        'web_search_read',
        [],
        {
          domain,
          specification: spec,
          offset,
          limit,
          order: 'id asc',
          count_limit: 999_999,
        },
      );
      poRecords = webRes?.records || [];
    }
    return poRecords;
  }

  /**
   * Re-fetch local documents that are not 'done' or 'cancel' and update them from Odoo.
   */
  private async resyncOpenPurchaseOrders(
    accountId: number,
    specs: PoFieldSpecs,
    warehouseId: number,
    excludeIds: Set<number>,
  ): Promise<number> {
    const openDocs = await this.prisma.documentPurchaseOrder.findMany({
      where: {
        state: { notIn: ['done', 'cancel'] },
        OR: [{ warehouseId }, { warehouseId: null }],
      },
      select: { id: true },
    });
    const openIds = openDocs
      .map((d) => d.id)
      .filter((id) => !excludeIds.has(id));

    if (openIds.length === 0) {
      return 0;
    }

    this.logger.log(
      `[NON-COMMODITY-SYNC-JOB] Re-syncing ${openIds.length} open (not done/cancel) purchase orders for warehouse ${warehouseId}`,
    );

    const chunkSize = 80;
    let syncedCount = 0;
    for (let i = 0; i < openIds.length; i += chunkSize) {
      const chunk = openIds.slice(i, i + chunkSize);
      const poRecords = await this.fetchPurchaseOrders(
        accountId,
        [['id', 'in', chunk]],
        specs,
        0,
        chunk.length,
      );
      if (poRecords.length === 0) continue;

      const syncedIds = await this.processPurchaseOrderBatch(
        accountId,
        poRecords,
        specs,
        warehouseId,
      );
      syncedCount += syncedIds.length;
    }

    return syncedCount;
  }

  /**
   * Resolve order lines and budget lines for a batch of PO headers, then upsert each PO.
   * Returns the Odoo IDs that were upserted. Errors are isolated per PO unless throwOnError is set.
   */
  private async processPurchaseOrderBatch(
    accountId: number,
    poRecords: any[],
    specs: PoFieldSpecs,
    warehouseId: number,
    throwOnError = false,
  ): Promise<number[]> {
    const { poModelFields, lineModelFields, lineFieldsToFetch } = specs;
    const syncedIds: number[] = [];

    // Fetch lines for POs
    // We collect all line IDs to fetch in batch for high performance and reliability
    const allLineIds: number[] = [];
    for (const po of poRecords) {
      if (Array.isArray(po.order_line)) {
        for (const item of po.order_line) {
          const numId =
            typeof item === 'object' ? Number(item.id) : Number(item);
          if (numId && !isNaN(numId)) {
            allLineIds.push(numId);
          }
        }
      }
    }

    const linesByPoId = new Map<number, any[]>();
    const linesById = new Map<number, any>();

    if (allLineIds.length > 0) {
      try {
        const fieldsToRead = [...lineFieldsToFetch];
        if (
          'order_id' in lineModelFields &&
          !fieldsToRead.includes('order_id')
        ) {
          fieldsToRead.push('order_id');
        }

        const rawLines = await this.safeOdooCall(
          accountId,
          'purchase.order.line',
          'read',
          [allLineIds],
          { fields: fieldsToRead },
        );

        if (Array.isArray(rawLines)) {
          for (const line of rawLines) {
            linesById.set(Number(line.id), line);
            const poId = this.getRelationalId(line.order_id);
            if (poId) {
              if (!linesByPoId.has(poId)) linesByPoId.set(poId, []);
              linesByPoId.get(poId)!.push(line);
            }
          }
        }
      } catch (batchLineErr: any) {
        this.logger.warn(
          `[NON-COMMODITY-SYNC-JOB] Batch read for purchase.order.line failed (${batchLineErr.message}), will read per PO if needed`,
        );
      }
    }

    // Process each PO with error isolation
    for (const poHeader of poRecords) {
      try {
        const poDetail: any = { ...poHeader };

        // Resolve lines for this PO
        if (linesByPoId.has(poHeader.id)) {
          poDetail.order_line = linesByPoId.get(poHeader.id);
        } else if (
          Array.isArray(poHeader.order_line) &&
          poHeader.order_line.length > 0
        ) {
          const poLineIds = poHeader.order_line
            .map((item: any) =>
              typeof item === 'object' ? Number(item.id) : Number(item),
            )
            .filter((id: number) => id && !isNaN(id));

          // If lines were found in linesById map
          const foundLines = poLineIds
            .map((id: number) => linesById.get(id))
            .filter(Boolean);
          if (foundLines.length === poLineIds.length) {
            poDetail.order_line = foundLines;
          } else {
            // Read individually for this PO
            try {
              const indLines = await this.safeOdooCall(
                accountId,
                'purchase.order.line',
                'read',
                [poLineIds],
                { fields: lineFieldsToFetch },
              );
              poDetail.order_line = Array.isArray(indLines) ? indLines : [];
            } catch (indErr: any) {
              this.logger.warn(
                `[NON-COMMODITY-SYNC-JOB] Failed to read lines for PO ${poHeader.id}: ${indErr.message}`,
              );
              poDetail.order_line = [];
            }
          }
        } else {
          poDetail.order_line = [];
        }

        // Resolve budget_activity_lines if present
        if (
          Array.isArray(poHeader.budget_activity_lines) &&
          poHeader.budget_activity_lines.length > 0
        ) {
          const budgetRelation =
            poModelFields['budget_activity_lines']?.relation;
          const budgetIds = poHeader.budget_activity_lines
            .map((b: any) => (typeof b === 'object' ? Number(b.id) : Number(b)))
            .filter((id: number) => id && !isNaN(id));

          if (budgetRelation && budgetIds.length > 0) {
            try {
              const bFields = await this.getModelFields(
                accountId,
                budgetRelation,
              );
              const bFieldsToRead = ['id', 'budget_activity_id'].filter(
                (f) => Object.keys(bFields).length === 0 || f in bFields,
              );
              const bRecords = await this.safeOdooCall(
                accountId,
                budgetRelation,
                'read',
                [budgetIds],
                { fields: bFieldsToRead },
              );
              poDetail.budget_activity_lines = Array.isArray(bRecords)
                ? bRecords
                : [];
            } catch (bErr: any) {
              this.logger.warn(
                `[NON-COMMODITY-SYNC-JOB] Failed to read budget lines for PO ${poHeader.id}: ${bErr.message}`,
              );
              poDetail.budget_activity_lines = [];
            }
          }
        }

        await this.upsertPurchaseOrderRecord(poDetail, warehouseId);
        syncedIds.push(Number(poHeader.id));
      } catch (poErr: any) {
        if (throwOnError) throw poErr;
        this.logger.error(
          `[NON-COMMODITY-SYNC-JOB] Failed to process/upsert PO ${poHeader.id} (${poHeader.name || 'unnamed'}): ${poErr.message}`,
          poErr.stack,
        );
        // Continue processing remaining POs in the batch without halting
      }
    }

    return syncedIds;
  }

  /**
   * Upsert single Purchase Order and its order lines in an atomic transaction.
   */
  private async upsertPurchaseOrderRecord(record: any, warehouseId: number) {
    const odooId = Number(record.id);
    const documentNumber = record.name || `PO-${odooId}`;
    const partner = this.getRelationalName(record.partner_id);
    const partnerRef = record.partner_ref || null;
    const amountTotal = Number(record.amount_total) || 0.0;
    const amountUntaxed = Number(record.amount_untaxed) || 0.0;
    const currencyName = this.getRelationalName(record.currency_id) || 'IDR';
    const state = record.state || 'draft';
    const dateOrder = record.date_order ? new Date(record.date_order) : null;
    const dateApprove = record.date_approve
      ? new Date(record.date_approve)
      : null;
    const datePlanned = record.date_planned
      ? new Date(record.date_planned)
      : null;
    const invoiceStatus = record.invoice_status || null;
    const companyName = this.getRelationalName(record.company_id);

    const rawOrderLines = record.order_line || [];
    const rawBudgetLines = record.budget_activity_lines || [];

    await this.prisma.$transaction(
      async (tx) => {
        // 1. Upsert Purchase Order Header using Odoo ID directly as id
        const po = await tx.documentPurchaseOrder.upsert({
          where: { id: odooId },
          update: {
            documentNumber,
            partner,
            partnerRef,
            amountTotal,
            amountUntaxed,
            currencyName,
            state,
            dateOrder,
            dateApprove,
            datePlanned,
            invoiceStatus,
            companyName,
            rawJson: record,
            lastSyncedAt: new Date(),
          },
          create: {
            id: odooId,
            warehouseId,
            documentNumber,
            partner,
            partnerRef,
            amountTotal,
            amountUntaxed,
            currencyName,
            state,
            dateOrder,
            dateApprove,
            datePlanned,
            invoiceStatus,
            companyName,
            rawJson: record,
            lastSyncedAt: new Date(),
          },
        });

        // 2. Upsert Order Lines
        if (Array.isArray(rawOrderLines) && rawOrderLines.length > 0) {
          const currentLineIds: number[] = [];

          for (const line of rawOrderLines) {
            const lineId = Number(line.id);
            if (!lineId) continue;
            currentLineIds.push(lineId);

            const productName =
              this.getRelationalName(line.product_id) || 'Produk';
            const productUom = this.getRelationalName(line.product_uom);
            const productQty = Number(line.product_qty) || 0.0;
            const priceUnit = Number(line.price_unit) || 0.0;
            const priceTotal =
              Number(line.price_total ?? line.price_subtotal) || 0.0;

            const budgetActivityName = this.resolveBudgetActivityName(
              line,
              rawBudgetLines,
            );

            await tx.documentProductPurchaseOrder.upsert({
              where: { id: lineId },
              update: {
                productName,
                productUom,
                productQty,
                priceUnit,
                priceTotal,
                budgetActivityName,
              },
              create: {
                id: lineId,
                documentPurchaseOrderId: po.id,
                productName,
                productUom,
                productQty,
                priceUnit,
                priceTotal,
                budgetActivityName,
              },
            });
          }

          // Remove lines deleted from Odoo PO
          if (currentLineIds.length > 0) {
            await tx.documentProductPurchaseOrder.deleteMany({
              where: {
                documentPurchaseOrderId: po.id,
                id: { notIn: currentLineIds },
              },
            });
          }
        } else if (
          Array.isArray(rawOrderLines) &&
          rawOrderLines.length === 0 &&
          Array.isArray(record.order_line) &&
          record.order_line.length === 0
        ) {
          await tx.documentProductPurchaseOrder.deleteMany({
            where: { documentPurchaseOrderId: po.id },
          });
        }
      },
      { timeout: 60000 },
    );
  }

  /**
   * Helper to execute Odoo RPC calls using the Non Commodity account with auto-relogin.
   */
  private async safeOdooCall(
    accountId: number,
    model: string,
    method: string,
    args: any[] = [],
    kwargs: any = {},
  ): Promise<any> {
    const account = await this.odooRepository.findById(accountId);
    if (!account || !account.isActive) {
      throw new NotFoundException(
        'Akun Odoo tidak ditemukan atau tidak aktif.',
      );
    }

    await this.odooSessionManager.validateAndRefreshSession(account.id);

    const refreshedAccount = await this.odooRepository.findById(account.id);
    if (!refreshedAccount?.sessionId || !refreshedAccount?.baseUrl) {
      throw new BadRequestException('Session ID Odoo kosong setelah refresh.');
    }

    try {
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
    } catch (err: any) {
      const isSessionExpired =
        err.message.includes('Session expired') ||
        err.message.includes('Session Expired') ||
        err.message.includes('SessionExpiredException') ||
        err.message.includes('session expired');

      if (isSessionExpired) {
        this.logger.log(
          `Session Odoo untuk akun ${account.id} kedaluwarsa. Melakukan refresh session...`,
        );
        await this.odooSessionManager.invalidateSession(account.id);
        await this.odooSessionManager.validateAndRefreshSession(account.id);

        const retryAccount = await this.odooRepository.findById(account.id);
        if (retryAccount?.sessionId) {
          return await this.odooClient.call(
            retryAccount.baseUrl,
            retryAccount.sessionId,
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

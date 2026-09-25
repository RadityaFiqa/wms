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
    if (orderLine.budget_activity_line_id && Array.isArray(budgetActivityLines)) {
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
    if (Array.isArray(budgetActivityLines) && budgetActivityLines.length === 1) {
      return this.getRelationalName(
        budgetActivityLines[0].budget_activity_id,
      );
    }

    return null;
  }

  /**
   * Trigger Non Commodity Purchase Order synchronization.
   * Runs in the background (fire-and-forget).
   */
  async triggerSync(
    warehouseId: number,
    createdBy: string,
  ): Promise<{ message: string }> {
    this.logger.log(
      `[NON-COMMODITY-SYNC-TRIGGER] Warehouse ${warehouseId} — triggered by ${createdBy}`,
    );

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

    // Check if sync is already running
    if (account.lastSyncDocumentsStatus === 'RUNNING') {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      if (
        account.lastSyncDocumentsAt &&
        account.lastSyncDocumentsAt > tenMinutesAgo
      ) {
        return { message: 'Sync already in progress' };
      }
    }

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
      });

    return { message: 'Sync started' };
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

    // Mark as running
    await this.prisma.odooAccount.update({
      where: { id: account.id },
      data: {
        lastSyncDocumentsStatus: 'RUNNING',
        lastSyncDocumentsAt: new Date(),
        lastSyncDocumentsBy: triggeredBy,
      },
    });

    // Validate & refresh session
    await this.odooSessionManager.validateAndRefreshSession(account.id);

    const limit = 80;
    let offset = account.lastDocumentsOffset ?? 0;
    let totalSyncedInThisRun = 0;

    const domain = [
      '&',
      ['is_non_commodity', '=', true],
      ['company_id', 'in', [122]],
    ];

    const listSpecification = {
      id: {},
      name: {},
      partner_ref: {},
      partner_id: { fields: { display_name: {} } },
      company_id: { fields: { display_name: {} } },
      date_order: {},
      date_approve: {},
      amount_untaxed: {},
      amount_total: {},
      currency_id: { fields: { display_name: {} } },
      state: {},
      date_planned: {},
      invoice_status: {},
    };

    const detailSpecification = {
      id: {},
      name: {},
      partner_ref: {},
      partner_id: { fields: { display_name: {} } },
      company_id: { fields: { display_name: {} } },
      date_order: {},
      date_approve: {},
      amount_untaxed: {},
      amount_total: {},
      currency_id: { fields: { display_name: {} } },
      state: {},
      date_planned: {},
      invoice_status: {},
      budget_activity_lines: {
        fields: {
          id: {},
          budget_activity_id: { fields: { display_name: {} } },
        },
      },
      order_line: {
        fields: {
          id: {},
          product_id: { fields: { display_name: {} } },
          product_uom: { fields: { display_name: {} } },
          product_qty: {},
          price_unit: {},
          price_total: {},
          price_subtotal: {},
          budget_activity_id: { fields: { display_name: {} } },
          budget_activity_line_id: { fields: { display_name: {} } },
        },
      },
    };

    try {
      while (true) {
        this.logger.log(
          `[NON-COMMODITY-SYNC-JOB] Fetching purchase.order: offset=${offset}, limit=${limit}`,
        );

        const listRes = await this.safeOdooCall(
          account.id,
          'purchase.order',
          'web_search_read',
          [],
          {
            domain,
            specification: listSpecification,
            offset,
            limit,
            order: 'id asc',
            count_limit: 999_999,
          },
        );

        const poRecords = listRes?.records || [];
        this.logger.log(
          `[NON-COMMODITY-SYNC-JOB] Fetched ${poRecords.length} purchase orders at offset ${offset}`,
        );

        if (poRecords.length === 0) {
          break;
        }

        // Process each PO with error isolation
        for (const poHeader of poRecords) {
          try {
            // Fetch detailed PO including lines and budget activities
            let poDetail: any = poHeader;
            try {
              const detailRes = await this.safeOdooCall(
                account.id,
                'purchase.order',
                'web_read',
                [[poHeader.id]],
                {
                  specification: detailSpecification,
                },
              );
              if (
                detailRes &&
                Array.isArray(detailRes) &&
                detailRes.length > 0
              ) {
                poDetail = detailRes[0];
              }
            } catch (detailErr: any) {
              this.logger.warn(
                `[NON-COMMODITY-SYNC-JOB] Failed to web_read PO ${poHeader.id}, using header data: ${detailErr.message}`,
              );
            }

            await this.upsertPurchaseOrderRecord(
              poDetail,
              warehouseId,
            );
            totalSyncedInThisRun++;
          } catch (poErr: any) {
            this.logger.error(
              `[NON-COMMODITY-SYNC-JOB] Failed to upsert PO ${poHeader.id}: ${poErr.message}`,
              poErr.stack,
            );
            // Continue processing remaining POs in the batch
          }
        }

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
        },
      });

      throw err;
    }
  }

  /**
   * Upsert single Purchase Order and its order lines in an atomic transaction.
   */
  private async upsertPurchaseOrderRecord(
    record: any,
    warehouseId: number,
  ) {
    const odooId = Number(record.id);
    const documentNumber = record.name || `PO-${odooId}`;
    const partner = this.getRelationalName(record.partner_id);
    const partnerRef = record.partner_ref || null;
    const amountTotal = Number(record.amount_total) || 0.0;
    const amountUntaxed = Number(record.amount_untaxed) || 0.0;
    const currencyName =
      this.getRelationalName(record.currency_id) || 'IDR';
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
        } else {
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
      throw new NotFoundException('Akun Odoo tidak ditemukan atau tidak aktif.');
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

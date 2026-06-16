import { Injectable, Logger } from '@nestjs/common';
import { OdooRepository } from './odoo.repository';
import { OdooAuthService } from './odoo-auth.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class OdooSessionManager {
  private readonly logger = new Logger(OdooSessionManager.name);

  constructor(
    private readonly repository: OdooRepository,
    private readonly authService: OdooAuthService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Validate session status for an account. If expired or missing, trigger relogin.
   */
  async validateAndRefreshSession(accountId: number): Promise<boolean> {
    const account = await this.repository.findById(accountId);
    if (!account || !account.isActive) {
      return false;
    }

    const now = new Date();
    const isExpired =
      !account.sessionExpiredAt || account.sessionExpiredAt <= now;

    // Refresh session if missing, expired, or expiring in less than 6 hours
    const bufferTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const isNearExpiry =
      account.sessionExpiredAt && account.sessionExpiredAt <= bufferTime;

    if (isExpired || isNearExpiry || !account.sessionId) {
      this.logger.log(
        `Session Odoo untuk gudang ${account.warehouse.name} kedaluwarsa atau kosong. Memulai relogin...`,
      );

      try {
        // Invalidate old session in database first
        await this.invalidateSession(account.id);

        // Perform login & establish new session
        await this.authService.establishSession(account.id);

        this.logger.log(
          `Session Odoo berhasil diperbarui untuk gudang ${account.warehouse.name}`,
        );

        await this.auditLogService
          .log({
            action: 'ODOO_SESSION_REFRESH_SUCCESS',
            details: {
              odooAccountUuid: account.uuid,
              warehouseName: account.warehouse.name,
              message: 'Session Odoo berhasil diperbarui secara otomatis',
            },
          })
          .catch((e) => console.error('Failed to write audit log:', e));

        return true;
      } catch (err: any) {
        this.logger.error(
          `Gagal memperbarui session Odoo untuk gudang ${account.warehouse.name}: ${err.message}`,
        );

        // Log refresh failure to audit log
        await this.auditLogService
          .log({
            action: 'ODOO_SESSION_REFRESH_FAILED',
            details: {
              odooAccountUuid: account.uuid,
              warehouseName: account.warehouse.name,
              error: err.message,
            },
          })
          .catch((e) => console.error('Failed to write audit log:', e));

        // Mark account session as null if credentials fail
        if (err.message.includes('Kredensial Odoo')) {
          await this.repository.updateSessionData(account.id, {
            sessionId: null,
            csrfToken: null,
            sessionExpiredAt: null,
          });
        }

        throw err;
      }
    }

    return false; // Session is still valid, no refresh needed
  }

  /**
   * Invalidate Odoo session in database.
   */
  async invalidateSession(accountId: number): Promise<void> {
    await this.repository.updateSessionData(accountId, {
      sessionId: null,
      csrfToken: null,
      sessionExpiredAt: null,
    });
  }

  /**
   * Run refresh cycle on all active accounts.
   */
  async refreshAllActiveSessions(): Promise<Record<string, string>> {
    const activeAccounts = await this.repository.findActiveAccounts();
    const results: Record<string, string> = {};

    for (const account of activeAccounts) {
      try {
        // Run refresh validation directly
        await this.validateAndRefreshSession(account.id);
        results[account.uuid] = 'SUCCESS';
      } catch (err: any) {
        results[account.uuid] = `FAILED: ${err.message}`;
      }
    }

    return results;
  }
}

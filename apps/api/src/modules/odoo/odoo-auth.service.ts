import { Injectable, BadRequestException } from '@nestjs/common';
import { OdooRepository } from './odoo.repository';
import { OdooClient } from './odoo-client';
import { encrypt, decrypt } from '../../core/utils/encryption.util';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class OdooAuthService {
  constructor(
    private readonly repository: OdooRepository,
    private readonly client: OdooClient,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Test Odoo credentials without saving them to the database (for front-end connection testing).
   */
  async testConnectionRaw(
    baseUrl: string,
    username: string,
    pass: string,
  ): Promise<any> {
    try {
      const { sessionId, csrfToken } = await this.client.authenticate(
        baseUrl,
        username,
        pass,
      );
      return { success: true, sessionId, csrfToken };
    } catch (err: any) {
      throw new BadRequestException(`Test koneksi gagal: ${err.message}`);
    }
  }

  /**
   * Test connection for an existing configuration in database by UUID.
   */
  async testConnectionByUuid(
    uuid: string,
    actorId?: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<any> {
    const account = await this.repository.findByUuid(uuid);
    if (!account) {
      throw new BadRequestException('Konfigurasi akun Odoo tidak ditemukan');
    }

    try {
      const decryptedPassword = decrypt(account.encryptedPassword);
      const { sessionId, csrfToken } = await this.client.authenticate(
        account.baseUrl,
        account.username,
        decryptedPassword,
      );

      // Log success audit
      await this.auditLogService
        .log({
          actorId,
          action: 'ODOO_LOGIN_SUCCESS',
          ipAddress,
          userAgent,
          details: {
            odooAccountUuid: account.uuid,
            warehouseName: account.warehouse.name,
            message: 'Koneksi Odoo berhasil diuji',
          },
        })
        .catch((e) => console.error('Failed to write Odoo audit log:', e));

      return { success: true, sessionId, csrfToken };
    } catch (err: any) {
      // Log failed audit
      await this.auditLogService
        .log({
          actorId,
          action: 'ODOO_LOGIN_FAILED',
          ipAddress,
          userAgent,
          details: {
            odooAccountUuid: account.uuid,
            warehouseName: account.warehouse.name,
            error: err.message,
          },
        })
        .catch((e) => console.error('Failed to write Odoo audit log:', e));

      throw new BadRequestException(`Test koneksi Odoo gagal: ${err.message}`);
    }
  }

  /**
   * Log in to Odoo for an active account configuration and save new session ID to DB.
   */
  async establishSession(accountId: number): Promise<any> {
    const account = await this.prismaFindAccountById(accountId);
    if (!account) {
      throw new Error(`Akun Odoo dengan ID ${accountId} tidak ditemukan`);
    }

    if (!account.isActive) {
      throw new Error(
        `Akun Odoo untuk gudang ${account.warehouseId} tidak aktif`,
      );
    }

    const decryptedPassword = decrypt(account.encryptedPassword);
    const { sessionId, csrfToken } = await this.client.authenticate(
      account.baseUrl,
      account.username,
      decryptedPassword,
    );

    // Odoo session duration: 7 days (604800 seconds)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Save session in DB
    const updated = await this.repository.updateSessionData(account.id, {
      sessionId,
      csrfToken,
      sessionExpiredAt: expiresAt,
      lastLoginAt: new Date(),
      lastRefreshAt: new Date(),
    });

    return updated;
  }

  // Private helper to query account details directly using prisma client
  private async prismaFindAccountById(id: number) {
    return this.repository.findById(id);
  }
}

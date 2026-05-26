import { OdooRepository } from './odoo.repository';
import { OdooAuthService } from './odoo-auth.service';
import { AuditLogService } from '../audit-log/audit-log.service';
export declare class OdooSessionManager {
    private readonly repository;
    private readonly authService;
    private readonly auditLogService;
    private readonly logger;
    constructor(repository: OdooRepository, authService: OdooAuthService, auditLogService: AuditLogService);
    validateAndRefreshSession(accountId: number): Promise<boolean>;
    invalidateSession(accountId: number): Promise<void>;
    refreshAllActiveSessions(): Promise<Record<string, string>>;
}

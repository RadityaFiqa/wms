import { OdooRepository } from './odoo.repository';
import { OdooClient } from './odoo-client';
import { AuditLogService } from '../audit-log/audit-log.service';
export declare class OdooAuthService {
    private readonly repository;
    private readonly client;
    private readonly auditLogService;
    constructor(repository: OdooRepository, client: OdooClient, auditLogService: AuditLogService);
    testConnectionRaw(baseUrl: string, username: string, pass: string): Promise<any>;
    testConnectionByUuid(uuid: string, actorId?: number, ipAddress?: string, userAgent?: string): Promise<any>;
    establishSession(accountId: number): Promise<any>;
    private prismaFindAccountById;
}

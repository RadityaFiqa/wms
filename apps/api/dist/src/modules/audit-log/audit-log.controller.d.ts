import { AuditLogService } from './audit-log.service';
export declare class AuditLogController {
    private readonly auditLogService;
    constructor(auditLogService: AuditLogService);
    findAll(search?: string, action?: string, page?: number, limit?: number): Promise<{
        data: ({
            target: {
                uuid: string;
                id: number;
                name: string;
                email: string;
            } | null;
            actor: {
                uuid: string;
                id: number;
                name: string;
                email: string;
            } | null;
        } & {
            uuid: string;
            id: number;
            action: string;
            userAgent: string | null;
            ipAddress: string | null;
            details: string | null;
            timestamp: Date;
            actorId: number | null;
            targetId: number | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
}

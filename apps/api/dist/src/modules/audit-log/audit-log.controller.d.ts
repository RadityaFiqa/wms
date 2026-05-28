import { AuditLogService } from './audit-log.service';
export declare class AuditLogController {
    private readonly auditLogService;
    constructor(auditLogService: AuditLogService);
    findAll(search?: string, action?: string, page?: number, limit?: number): Promise<{
        data: ({
            actor: {
                uuid: string;
                id: number;
                name: string;
                email: string;
            } | null;
            target: {
                uuid: string;
                id: number;
                name: string;
                email: string;
            } | null;
        } & {
            uuid: string;
            id: number;
            action: string;
            actorId: number | null;
            targetId: number | null;
            ipAddress: string | null;
            userAgent: string | null;
            details: string | null;
            timestamp: Date;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
}

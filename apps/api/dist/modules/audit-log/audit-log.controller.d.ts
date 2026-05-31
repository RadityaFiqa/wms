import { AuditLogService } from './audit-log.service';
export declare class AuditLogController {
    private readonly auditLogService;
    constructor(auditLogService: AuditLogService);
    findAll(req: any, search?: string, action?: string, page?: number, limit?: number): Promise<{
        data: ({
            actor: {
                uuid: string;
                id: number;
                email: string;
                name: string;
            } | null;
            target: {
                uuid: string;
                id: number;
                email: string;
                name: string;
            } | null;
        } & {
            uuid: string;
            id: number;
            action: string;
            userAgent: string | null;
            ipAddress: string | null;
            actorId: number | null;
            targetId: number | null;
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

import { PrismaService } from '../../core/prisma/prisma.service';
export declare class AuditLogService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    log(data: {
        actorId?: number;
        targetId?: number;
        action: string;
        ipAddress?: string;
        userAgent?: string;
        details?: any;
    }): Promise<{
        uuid: string;
        id: number;
        action: string;
        userAgent: string | null;
        ipAddress: string | null;
        details: string | null;
        timestamp: Date;
        actorId: number | null;
        targetId: number | null;
    }>;
    findAll(query: {
        search?: string;
        action?: string;
        page?: number;
        limit?: number;
    }): Promise<{
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

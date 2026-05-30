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
        actorId: number | null;
        targetId: number | null;
        ipAddress: string | null;
        userAgent: string | null;
        details: string | null;
        timestamp: Date;
    }>;
    findAll(query: {
        search?: string;
        action?: string;
        page?: number;
        limit?: number;
    }, currentUser: any): Promise<{
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

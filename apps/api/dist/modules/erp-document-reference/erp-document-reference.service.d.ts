import { PrismaService } from '../../core/prisma/prisma.service';
import { OdooClient } from '../odoo/odoo-client';
import { OdooSessionManager } from '../odoo/odoo-session.manager';
export declare class ErpDocumentReferenceService {
    private readonly prisma;
    private readonly odooClient;
    private readonly odooSessionManager;
    private readonly logger;
    constructor(prisma: PrismaService, odooClient: OdooClient, odooSessionManager: OdooSessionManager);
    private getRelationalName;
    private getRelationalId;
    triggerSync(warehouseId: number, createdBy: string): Promise<{
        message: string;
    }>;
    getSyncStatus(warehouseId: number): Promise<{
        status: string;
        processedDocuments: number;
        totalDocuments: number;
        startedAt: null;
        lastSyncAt: null;
    } | {
        status: import("@prisma/client").$Enums.OdooSyncStatus;
        processedDocuments: number;
        totalDocuments: number;
        startedAt: Date;
        lastSyncAt: Date | null;
    }>;
    executeSyncJob(warehouseId: number, logId: number, triggeredBy: string): Promise<{
        success: boolean;
        syncedCount: number;
    }>;
    findAll(warehouseId: number, query: {
        search?: string;
        page?: number;
        limit?: number;
        type?: 'IN' | 'OUT';
        state?: string;
        startDate?: string;
        endDate?: string;
        refFax?: string;
        gateOperationUuid?: string;
    }): Promise<{
        data: any[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
        summary: {
            totalDocuments: number;
            totalIncoming: number;
            totalOutgoing: number;
            lastSyncTime: Date | null;
        };
    }>;
    findOne(warehouseId: number, uuid: string): Promise<any>;
    forceSyncDocument(warehouseId: number, idOrUuid: string, triggeredBy: string): Promise<any>;
    private upsertDocumentRecord;
    findUniquePartners(warehouseId: number): Promise<string[]>;
    private sanitizeDocReferences;
    private sanitizeDocReference;
    private safeOdooCall;
}

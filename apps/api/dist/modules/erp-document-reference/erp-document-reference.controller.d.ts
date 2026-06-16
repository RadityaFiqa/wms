import { ErpDocumentReferenceService } from './erp-document-reference.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
export declare class ErpDocumentReferenceController {
    private readonly service;
    private readonly warehouseContext;
    constructor(service: ErpDocumentReferenceService, warehouseContext: WarehouseContextService);
    findAll(search?: string, page?: string, limit?: string, type?: 'IN' | 'OUT', state?: string, startDate?: string, endDate?: string, refFax?: string, gateOperationUuid?: string): Promise<{
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
    findUniquePartners(): Promise<string[]>;
    findOne(uuid: string): Promise<any>;
    getSyncStatus(): Promise<{
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
    sync(req: any): Promise<{
        message: string;
    }>;
    forceSync(idOrUuid: string, req: any): Promise<any>;
}

import { PrismaService } from '../../core/prisma/prisma.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import { StorageService } from '../storage/storage.service';
import type { CreateGateOperationInput, CreateGateVerificationInput } from '@bulog-wms/schema';
export declare class GateService {
    private readonly prisma;
    private readonly warehouseContext;
    private readonly storageService;
    constructor(prisma: PrismaService, warehouseContext: WarehouseContextService, storageService: StorageService);
    private getStartAndEndOfToday;
    private generateOpNumber;
    createGateOperation(createdByUserId: number, body: CreateGateOperationInput): Promise<any>;
    getGateOperations(query: {
        search?: string;
        cardType?: string;
        status?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        items: any[];
    }>;
    getGateOperationByUuid(uuid: string): Promise<any>;
    verifyGateOperation(uuid: string, verifiedById: number, body: CreateGateVerificationInput): Promise<({
        products: ({
            product: {
                uuid: string;
                id: number;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                sku: string;
                category: string;
                price: number;
                uom: string | null;
            };
        } & {
            uuid: string;
            id: number;
            productId: number;
            quantity: number;
            gateVerificationId: number;
        })[];
        attachment: {
            uuid: string;
            id: number;
            filePath: string;
            fileName: string;
            mimeType: string;
            sizeBytes: number;
            uploadedById: number;
            uploadedAt: Date;
        } | null;
    } & {
        uuid: string;
        id: number;
        status: import("@prisma/client").$Enums.VerificationStatus;
        notes: string | null;
        gateOperationId: number;
        verifiedById: number;
        verifiedAt: Date;
        attachmentId: number | null;
    }) | null>;
    private mapOperationUrls;
}

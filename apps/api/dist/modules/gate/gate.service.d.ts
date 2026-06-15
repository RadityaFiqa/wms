import { PrismaService } from '../../core/prisma/prisma.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import { StorageService } from '../storage/storage.service';
import type { CreateGateOperationInput, CreateGateVerificationInput, AssignReferencesInput } from '@bulog-wms/schema';
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
        startDate?: string;
        endDate?: string;
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
    getClientHistory(warehouseId: number, clientPartner: string): Promise<{
        licensePlate: string;
        driverName: string;
        driverPhone: string;
    }[]>;
    getAvailableReferences(operationUuid: string, productId: number, gateItemId?: number, search?: string): Promise<any[]>;
    assignReferences(operationUuid: string, userId: number, userName: string, body: AssignReferencesInput): Promise<any>;
    unassignReference(referenceUuid: string, userId: number, userName: string): Promise<{
        success: boolean;
        message: string;
        auditDetails: {
            previousReference: string;
            unassignedBy: string;
            timestamp: string;
        };
    }>;
    private updateGateStatusAndRealisasi;
    verifyGateOperation(uuid: string, verifiedById: number, body: CreateGateVerificationInput): Promise<any>;
    cancelGateVerification(uuid: string, verifiedById: number): Promise<any>;
    confirmGateVerification(uuid: string, verifiedById: number): Promise<any>;
    private mapOperationUrls;
    private stripIdField;
    private validateDocumentReferenceLimits;
    addCargoItem(operationUuid: string, body: {
        productId: number;
        quantity: number;
        notes?: string;
        quantId?: number | null;
        locationId?: number | null;
    }): Promise<any>;
    deleteCargoItem(gateOperationProductUuid: string): Promise<{
        success: boolean;
        message: string;
        deletedItem: any;
    }>;
    updateCargoItem(cargoItemUuid: string, body: {
        quantId?: number | null;
        locationId?: number | null;
        quantity?: number;
    }): Promise<any>;
    private validateStackQuantity;
    private reserveQuantStock;
    private releaseQuantStock;
    private processStockReductionOnCompletion;
    generateDeliveryOrderPdf(idOrUuid: string): Promise<Buffer>;
    generateDeliveryOrderHtml(idOrUuid: string): Promise<string>;
    private sanitizeVerification;
}

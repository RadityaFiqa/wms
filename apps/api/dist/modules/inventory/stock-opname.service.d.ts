import { PrismaService } from '../../core/prisma/prisma.service';
import { ReconciliationService } from './reconciliation.service';
export declare class StockOpnameService {
    private readonly prisma;
    private readonly reconciliationService;
    constructor(prisma: PrismaService, reconciliationService: ReconciliationService);
    private generateOpnameNumber;
    getList(warehouseId: number, query: {
        search?: string;
        status?: string;
        createdById?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        items: {
            uuid: string;
            opnameNumber: string;
            status: import("@prisma/client").$Enums.StockOpnameStatus;
            notes: string | null;
            createdAt: Date;
            updatedAt: Date;
            completionDate: Date | null;
            createdBy: string;
            totalProducts: number;
            totalVariance: number;
            attachments: {
                uuid: string;
                fileName: string;
                filePath: string;
                mimeType: string;
                sizeBytes: number;
            }[];
        }[];
    }>;
    getDetail(warehouseId: number, uuid: string): Promise<{
        uuid: string;
        opnameNumber: string;
        status: import("@prisma/client").$Enums.StockOpnameStatus;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
        completionDate: Date | null;
        createdBy: string;
        totalProducts: number;
        totalVariance: number;
        warehouseName: string;
        warehouseCode: string;
        attachments: {
            id: number;
            uuid: string;
            fileName: string;
            filePath: string;
            mimeType: string;
            sizeBytes: number;
        }[];
        items: {
            uuid: string;
            productId: number;
            productSku: string;
            productName: string;
            productUom: string | null;
            erpStock: number;
            realtimeStock: number;
            difference: number | null;
            stacks: {
                uuid: string;
                locationId: number;
                locationName: string;
                erpQty: number;
                actualQty: number | null;
                variance: number | null;
            }[];
        }[];
    }>;
    createStockOpname(warehouseId: number, createdById: number, notes?: string): Promise<{
        uuid: string;
        id: number;
        warehouseId: number;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.StockOpnameStatus;
        notes: string | null;
        opnameNumber: string;
        completionDate: Date | null;
        createdById: number;
    }>;
    updateStockOpname(warehouseId: number, uuid: string, body: {
        notes?: string;
        stacks?: Array<{
            uuid: string;
            actualQty: number | null;
        }>;
        attachmentPaths?: string[];
    }): Promise<({
        attachments: {
            uuid: string;
            id: number;
            filePath: string;
            fileName: string;
            mimeType: string;
            sizeBytes: number;
            uploadedById: number;
            uploadedAt: Date;
            gateOperationId: number | null;
            gateVerificationId: number | null;
            stockOpnameId: number | null;
        }[];
    } & {
        uuid: string;
        id: number;
        warehouseId: number;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.StockOpnameStatus;
        notes: string | null;
        opnameNumber: string;
        completionDate: Date | null;
        createdById: number;
    }) | null>;
    submitStockOpname(warehouseId: number, uuid: string): Promise<{
        uuid: string;
        id: number;
        warehouseId: number;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.StockOpnameStatus;
        notes: string | null;
        opnameNumber: string;
        completionDate: Date | null;
        createdById: number;
    }>;
    generateCountingSheetPdf(warehouseId: number, uuid: string): Promise<Buffer>;
    generateResultPdf(warehouseId: number, uuid: string): Promise<Buffer>;
}

import { StockOpnameService } from './stock-opname.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
export declare class StockOpnameController {
    private readonly service;
    private readonly warehouseContext;
    constructor(service: StockOpnameService, warehouseContext: WarehouseContextService);
    getList(search?: string, status?: string, createdById?: string, startDate?: string, endDate?: string, page?: string, limit?: string): Promise<{
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
    getDetail(uuid: string): Promise<{
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
    create(req: any, notes?: string): Promise<{
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
    update(uuid: string, body: {
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
    submit(uuid: string): Promise<{
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
    exportCountingSheet(uuid: string, res: any): Promise<void>;
    exportResultPdf(uuid: string, res: any): Promise<void>;
}

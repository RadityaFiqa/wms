import { InventoryService } from './inventory.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import { PrismaService } from '../../core/prisma/prisma.service';
export declare class InventoryController {
    private readonly service;
    private readonly warehouseContext;
    private readonly prisma;
    constructor(service: InventoryService, warehouseContext: WarehouseContextService, prisma: PrismaService);
    findAll(search?: string, page?: string, limit?: string): Promise<{
        data: {
            uuid: string;
            sku: string;
            name: string;
            uom: string;
            totalQuantity: number;
            totalAvailable: number;
            locationCount: number;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
        summary: {
            totalProducts: number;
            totalLocations: number;
            totalQuantity: number;
            totalReserved: number;
            totalAvailable: number;
        };
    }>;
    findAllProducts(search?: string): Promise<{
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
    }[]>;
    getSyncStatus(): Promise<{
        lastSyncAt: Date | null;
        lastSyncStatus: string | null;
        lastSyncError: string | null;
        lastSyncBy: string | null;
        lastSyncCount: number | null;
    }>;
    exportPdf(res: any, search?: string): Promise<void>;
    findDetail(uuid: string): Promise<{
        product: {
            uuid: string;
            sku: string;
            name: string;
            uom: string;
            description: string | null;
            category: string;
        };
        locations: {
            locationUuid: string;
            locationDisplayName: string;
            quants: any[];
        }[];
    }>;
    sync(req: any): Promise<{
        success: boolean;
        syncedCount: number;
    }>;
    private prismaFindAccountByWarehouseId;
}

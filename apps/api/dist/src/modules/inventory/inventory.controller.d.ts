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
            id: number;
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
        id: number;
        uuid: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        sku: string;
        description: string | null;
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
            id: number;
            uuid: string;
            sku: string;
            name: string;
            uom: string;
            description: string | null;
            category: string;
        };
        locations: {
            location_id: number;
            location_display_name: string;
            quants: any[];
        }[];
    }>;
    sync(req: any): Promise<{
        success: boolean;
        syncedCount: number;
    }>;
    private prismaFindAccountByWarehouseId;
}

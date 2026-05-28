import { PrismaService } from '../../core/prisma/prisma.service';
import { OdooClient } from '../odoo/odoo-client';
import { OdooSessionManager } from '../odoo/odoo-session.manager';
export declare class InventoryService {
    private readonly prisma;
    private readonly odooClient;
    private readonly odooSessionManager;
    constructor(prisma: PrismaService, odooClient: OdooClient, odooSessionManager: OdooSessionManager);
    syncOdooInventory(warehouseId: number, triggeredBy: string): Promise<{
        success: boolean;
        syncedCount: number;
    }>;
    findAll(warehouseId: number, query: {
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{
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
    findDetail(warehouseId: number, productUuid: string): Promise<{
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
    generatePdfReport(warehouseId: number, query: {
        search?: string;
    }): Promise<Buffer>;
}

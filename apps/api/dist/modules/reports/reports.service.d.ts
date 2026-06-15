import { PrismaService } from '../../core/prisma/prisma.service';
export declare class ReportsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getDailyStockMovementReport(warehouseId: number, query: {
        startDate: string;
        endDate: string;
        productId?: string;
    }): Promise<any[]>;
    getDailyStockMovementDetail(warehouseId: number, query: {
        date: string;
        productUuid: string;
    }): Promise<{
        product: {
            sku: string;
            name: string;
            uom: string;
        };
        date: string;
        incoming: {
            documentNumber: string;
            partnerName: string;
            pickingTypeCode: string;
            quantity: number;
            scheduledDate: Date | null;
            type: string;
        }[];
        outgoing: {
            documentNumber: string;
            partnerName: string;
            pickingTypeCode: string;
            quantity: number;
            scheduledDate: Date | null;
            type: string;
        }[];
    }>;
    private formatDateString;
    private generateDatesList;
    generatePdfReport(warehouseId: number, query: {
        startDate: string;
        endDate: string;
        productId?: string;
    }): Promise<Buffer>;
    generateCsvReport(warehouseId: number, query: {
        startDate: string;
        endDate: string;
        productId?: string;
    }): Promise<string>;
}

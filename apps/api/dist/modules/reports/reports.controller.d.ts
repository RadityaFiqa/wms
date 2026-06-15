import { ReportsService } from './reports.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
export declare class ReportsController {
    private readonly service;
    private readonly warehouseContext;
    constructor(service: ReportsService, warehouseContext: WarehouseContextService);
    getReport(startDate: string, endDate: string, productId?: string): Promise<any[]>;
    getDetail(date: string, productUuid: string): Promise<{
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
    exportPdf(startDate: string, endDate: string, productId: string, res: any): Promise<void>;
    exportCsv(startDate: string, endDate: string, productId: string, res: any): Promise<void>;
}

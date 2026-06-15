import { ReconciliationService } from './reconciliation.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
export declare class ReconciliationController {
    private readonly service;
    private readonly warehouseContext;
    constructor(service: ReconciliationService, warehouseContext: WarehouseContextService);
    getList(): Promise<{
        product: {
            uuid: string;
            sku: string;
            name: string;
            uom: string;
        };
        erpStock: number;
        pendingGateQty: number;
        pendingIncoming: number;
        pendingOutgoing: number;
        expectedStock: number;
    }[]>;
    getDetail(uuid: string): Promise<{
        product: {
            uuid: string;
            sku: string;
            name: string;
            uom: string;
        };
        erpStock: number;
        erpStockSource: {
            locationName: string;
            lotName: string;
            quantity: number;
            reservedQuantity: number;
            availableQuantity: number;
        }[];
        pendingGateOperations: {
            uuid: string;
            opNumber: string;
            cardType: import("@prisma/client").$Enums.CardType;
            driverName: string;
            licensePlate: string;
            createdAt: Date;
            quantity: number;
        }[];
        pendingIncoming: number;
        pendingOutgoing: number;
        pendingGateQty: number;
        expectedStock: number;
    }>;
}

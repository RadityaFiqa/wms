import { PrismaService } from '../../core/prisma/prisma.service';
export declare class ReconciliationService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getReconciliationList(warehouseId: number): Promise<{
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
    getReconciliationDetail(warehouseId: number, inventoryUuid: string): Promise<{
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

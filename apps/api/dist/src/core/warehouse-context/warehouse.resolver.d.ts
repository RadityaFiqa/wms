import { PrismaService } from '../../core/prisma/prisma.service';
export declare class WarehouseResolver {
    private readonly prisma;
    constructor(prisma: PrismaService);
    resolveWarehouse(warehouseIdHeader: string): Promise<any>;
    validateUserAccess(userId: number, warehouseId: number, roleName: string): Promise<boolean>;
}

import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { WarehouseContextService } from '../warehouse-context/warehouse-context.service';
export declare class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly warehouseContextService;
    private pool;
    constructor(warehouseContextService: WarehouseContextService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}

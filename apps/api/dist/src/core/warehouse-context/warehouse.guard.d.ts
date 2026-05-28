import { CanActivate, ExecutionContext } from '@nestjs/common';
import { WarehouseResolver } from './warehouse.resolver';
export declare class WarehouseGuard implements CanActivate {
    private readonly warehouseResolver;
    constructor(warehouseResolver: WarehouseResolver);
    canActivate(context: ExecutionContext): Promise<boolean>;
}

import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { WarehouseContextService } from './warehouse-context.service';
export declare class WarehouseInterceptor implements NestInterceptor {
    private readonly warehouseContextService;
    constructor(warehouseContextService: WarehouseContextService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}

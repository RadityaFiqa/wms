export interface WarehouseContext {
    warehouseId?: number;
    warehouseUuid?: string;
    userId?: number;
}
export declare class WarehouseContextService {
    private static readonly asyncLocalStorage;
    run(context: WarehouseContext, callback: () => any): any;
    getStore(): WarehouseContext | undefined;
    getWarehouseId(): number | undefined;
    getWarehouseUuid(): string | undefined;
    getUserId(): number | undefined;
}

import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface WarehouseContext {
  warehouseId?: number;
  warehouseUuid?: string;
  userId?: number;
}

@Injectable()
export class WarehouseContextService {
  private static readonly asyncLocalStorage =
    new AsyncLocalStorage<WarehouseContext>();

  run(context: WarehouseContext, callback: () => any) {
    return WarehouseContextService.asyncLocalStorage.run(context, callback);
  }

  getStore(): WarehouseContext | undefined {
    return WarehouseContextService.asyncLocalStorage.getStore();
  }

  getWarehouseId(): number | undefined {
    return this.getStore()?.warehouseId;
  }

  getWarehouseUuid(): string | undefined {
    return this.getStore()?.warehouseUuid;
  }

  getUserId(): number | undefined {
    return this.getStore()?.userId;
  }
}

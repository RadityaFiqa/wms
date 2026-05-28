import { Global, Module } from '@nestjs/common';
import { WarehouseContextService } from './warehouse-context.service';
import { WarehouseResolver } from './warehouse.resolver';

@Global()
@Module({
  providers: [WarehouseContextService, WarehouseResolver],
  exports: [WarehouseContextService, WarehouseResolver],
})
export class WarehouseContextModule {}

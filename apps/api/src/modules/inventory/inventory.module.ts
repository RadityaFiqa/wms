import { Module, forwardRef } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { StockOpnameController } from './stock-opname.controller';
import { StockOpnameService } from './stock-opname.service';
import { OdooModule } from '../odoo/odoo.module';

@Module({
  imports: [forwardRef(() => OdooModule)],
  controllers: [
    InventoryController,
    ReconciliationController,
    StockOpnameController,
  ],
  providers: [InventoryService, ReconciliationService, StockOpnameService],
  exports: [InventoryService, ReconciliationService, StockOpnameService],
})
export class InventoryModule {}

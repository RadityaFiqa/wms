import { Module } from '@nestjs/common';
import { FinancePurchaseOrderController } from './finance-purchase-order.controller';
import { FinancePurchaseOrderService } from './finance-purchase-order.service';
import { OdooModule } from '../odoo/odoo.module';

@Module({
  imports: [OdooModule],
  controllers: [FinancePurchaseOrderController],
  providers: [FinancePurchaseOrderService],
  exports: [FinancePurchaseOrderService],
})
export class FinanceModule {}

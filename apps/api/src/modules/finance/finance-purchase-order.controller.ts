import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FinancePurchaseOrderService } from './finance-purchase-order.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '@/core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import { PurchaseOrderQuerySchema } from '@bulog-wms/schema';
import type { PurchaseOrderQueryInput } from '@bulog-wms/schema';
import { ZodValidationPipe } from '@/core/pipes/zod-validation.pipe';

@Controller('finance/purchase-orders')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class FinancePurchaseOrderController {
  constructor(
    private readonly service: FinancePurchaseOrderService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'DocumentPurchaseOrder'))
  async findAll(
    @Query(new ZodValidationPipe(PurchaseOrderQuerySchema))
    query: PurchaseOrderQueryInput,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.findAll(warehouseId, query);
  }

  @Get('sync/status')
  @CheckPolicies((ability) => ability.can('read', 'DocumentPurchaseOrder'))
  async getSyncStatus() {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.getSyncStatus(warehouseId);
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'DocumentPurchaseOrder'))
  async findOne(@Param('uuid') uuid: string) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.findOne(warehouseId, uuid);
  }

  @Post('force-sync')
  @CheckPolicies((ability) => ability.can('update', 'DocumentPurchaseOrder'))
  @AuditLogAction('NON_COMMODITY_PO_FORCE_SYNC')
  async forceSync(@Req() req: any) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    const triggeredBy = req.user?.email || 'System';
    return this.service.forceSync(warehouseId, triggeredBy);
  }
}

import {
  Controller,
  Get,
  Param,
  BadRequestException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';

@Controller('reconciliation')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class ReconciliationController {
  constructor(
    private readonly service: ReconciliationService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Reconciliation'))
  async getList() {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.getReconciliationList(warehouseId);
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'Reconciliation'))
  async getDetail(@Param('uuid') uuid: string) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.getReconciliationDetail(warehouseId, uuid);
  }
}

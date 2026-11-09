import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  FlowTrendQuerySchema,
  type FlowTrendQueryInput,
} from '@bulog-wms/schema';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '@/core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '@/modules/casl/policies.guard';
import { CheckPolicies } from '@/modules/casl/policies.decorator';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import { ZodValidationPipe } from '@/core/pipes/zod-validation.pipe';
import { ReportsAnalyticsService } from '@/modules/reports/reports-analytics.service';

@Controller('reports/analytics')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
export class ReportsAnalyticsController {
  constructor(
    private readonly service: ReportsAnalyticsService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  @Get('flow-trend')
  @CheckPolicies((ability) => ability.can('read', 'Report'))
  getFlowTrend(
    @Query(new ZodValidationPipe(FlowTrendQuerySchema))
    query: FlowTrendQueryInput,
  ) {
    return this.service.getFlowTrend(this.requireWarehouseId(), query);
  }

  @Get('stock-inbound')
  @CheckPolicies((ability) => ability.can('read', 'Report'))
  getStockInbound() {
    return this.service.getStockInbound(this.requireWarehouseId());
  }

  private requireWarehouseId() {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return warehouseId;
  }
}

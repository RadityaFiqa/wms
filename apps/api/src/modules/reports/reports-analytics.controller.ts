import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CreateStockFolderSchema,
  FlowTrendQuerySchema,
  MoveStockFolderItemSchema,
  RenameStockFolderSchema,
  type CreateStockFolderInput,
  type FlowTrendQueryInput,
  type MoveStockFolderItemInput,
  type RenameStockFolderInput,
} from '@bulog-wms/schema';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '@/core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '@/modules/casl/policies.guard';
import { CheckPolicies } from '@/modules/casl/policies.decorator';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import { ZodValidationPipe } from '@/core/pipes/zod-validation.pipe';
import { ReportsAnalyticsService } from '@/modules/reports/reports-analytics.service';
import { StockFolderService } from '@/modules/reports/stock-folder.service';

@Controller('reports/analytics')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
export class ReportsAnalyticsController {
  constructor(
    private readonly service: ReportsAnalyticsService,
    private readonly stockFolders: StockFolderService,
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

  @Post('stock-folders')
  @CheckPolicies((ability) => ability.can('update', 'Report'))
  createStockFolder(
    @Body(new ZodValidationPipe(CreateStockFolderSchema))
    body: CreateStockFolderInput,
    @Req() req: { user?: { id: number } },
  ) {
    return this.stockFolders.create(
      this.requireWarehouseId(),
      body,
      req.user?.id,
    );
  }

  @Put('stock-folders/items')
  @CheckPolicies((ability) => ability.can('update', 'Report'))
  moveStockFolderItem(
    @Body(new ZodValidationPipe(MoveStockFolderItemSchema))
    body: MoveStockFolderItemInput,
  ) {
    return this.stockFolders.move(this.requireWarehouseId(), body);
  }

  @Patch('stock-folders/:uuid')
  @CheckPolicies((ability) => ability.can('update', 'Report'))
  renameStockFolder(
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(RenameStockFolderSchema))
    body: RenameStockFolderInput,
  ) {
    return this.stockFolders.rename(this.requireWarehouseId(), uuid, body);
  }

  @Delete('stock-folders/:uuid')
  @CheckPolicies((ability) => ability.can('update', 'Report'))
  removeStockFolder(@Param('uuid') uuid: string) {
    return this.stockFolders.remove(this.requireWarehouseId(), uuid);
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

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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  BanpangFolderNameSchema,
  BanpangRealizationQuerySchema,
  CreateStockFolderSchema,
  FlowTrendQuerySchema,
  MoveStockFolderItemSchema,
  RenameStockFolderSchema,
  StockInboundExportQuerySchema,
  MoveBanpangSalesOrderSchema,
  SaveStackMapAreaSchema,
  SaveStackMapLabelSchema,
  type SaveStackMapAreaInput,
  type SaveStackMapLabelInput,
  type BanpangFolderNameInput,
  type BanpangRealizationQueryInput,
  type MoveBanpangSalesOrderInput,
  type CreateStockFolderInput,
  type FlowTrendQueryInput,
  type MoveStockFolderItemInput,
  type RenameStockFolderInput,
  type StockInboundExportQueryInput,
} from '@bulog-wms/schema';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '@/core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '@/modules/casl/policies.guard';
import { CheckPolicies } from '@/modules/casl/policies.decorator';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import { ZodValidationPipe } from '@/core/pipes/zod-validation.pipe';
import { ReportsAnalyticsService } from '@/modules/reports/reports-analytics.service';
import { StockFolderService } from '@/modules/reports/stock-folder.service';
import { BanpangRealizationService } from '@/modules/reports/banpang-realization.service';
import { BanpangFolderService } from '@/modules/reports/banpang-folder.service';
import { StackMapService } from '@/modules/reports/stack-map.service';
import {
  ReportsAnalyticsExportService,
  type ExportFile,
} from '@/modules/reports/reports-analytics-export.service';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('reports/analytics')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
export class ReportsAnalyticsController {
  constructor(
    private readonly service: ReportsAnalyticsService,
    private readonly stockFolders: StockFolderService,
    private readonly exportService: ReportsAnalyticsExportService,
    private readonly banpang: BanpangRealizationService,
    private readonly banpangFolders: BanpangFolderService,
    private readonly stackMap: StackMapService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  @Get('stack-map')
  @CheckPolicies((ability) => ability.can('read', 'Report'))
  getStackMapSettings() {
    return this.stackMap.getSettings(this.requireWarehouseId());
  }

  @Put('stack-map/labels')
  @CheckPolicies((ability) => ability.can('update', 'Report'))
  saveStackMapLabel(
    @Body(new ZodValidationPipe(SaveStackMapLabelSchema))
    body: SaveStackMapLabelInput,
    @Req() req: { user?: { id: number } },
  ) {
    return this.stackMap.saveLabel(
      this.requireWarehouseId(),
      body,
      req.user?.id,
    );
  }

  @Put('stack-map/areas')
  @CheckPolicies((ability) => ability.can('update', 'Report'))
  saveStackMapArea(
    @Body(new ZodValidationPipe(SaveStackMapAreaSchema))
    body: SaveStackMapAreaInput,
  ) {
    return this.stackMap.saveArea(this.requireWarehouseId(), body);
  }

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

  @Get('banpang-realization')
  @CheckPolicies((ability) => ability.can('read', 'Report'))
  getBanpangRealization(
    @Query(new ZodValidationPipe(BanpangRealizationQuerySchema))
    query: BanpangRealizationQueryInput,
  ) {
    return this.banpang.getRealization(this.requireWarehouseId(), query);
  }

  @Post('banpang-folders')
  @CheckPolicies((ability) => ability.can('update', 'Report'))
  createBanpangFolder(
    @Body(new ZodValidationPipe(BanpangFolderNameSchema))
    body: BanpangFolderNameInput,
    @Req() req: { user?: { id: number } },
  ) {
    return this.banpangFolders.create(
      this.requireWarehouseId(),
      body,
      req.user?.id,
    );
  }

  @Put('banpang-folders/items')
  @CheckPolicies((ability) => ability.can('update', 'Report'))
  moveBanpangSalesOrder(
    @Body(new ZodValidationPipe(MoveBanpangSalesOrderSchema))
    body: MoveBanpangSalesOrderInput,
  ) {
    return this.banpangFolders.move(this.requireWarehouseId(), body);
  }

  @Patch('banpang-folders/:uuid')
  @CheckPolicies((ability) => ability.can('update', 'Report'))
  renameBanpangFolder(
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(BanpangFolderNameSchema))
    body: BanpangFolderNameInput,
  ) {
    return this.banpangFolders.rename(this.requireWarehouseId(), uuid, body);
  }

  @Delete('banpang-folders/:uuid')
  @CheckPolicies((ability) => ability.can('update', 'Report'))
  removeBanpangFolder(@Param('uuid') uuid: string) {
    return this.banpangFolders.remove(this.requireWarehouseId(), uuid);
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

  @Get('stock-inbound/export/xlsx')
  @CheckPolicies((ability) => ability.can('read', 'Report'))
  async exportStockInboundXlsx(
    @Query(new ZodValidationPipe(StockInboundExportQuerySchema))
    query: StockInboundExportQueryInput,
    @Res() res: Response,
  ) {
    const file = await this.exportService.generateStockInboundXlsx(
      this.requireWarehouseId(),
      query.search,
    );
    this.sendFile(res, file, XLSX_CONTENT_TYPE);
  }

  @Get('stock-inbound/export/pdf')
  @CheckPolicies((ability) => ability.can('read', 'Report'))
  async exportStockInboundPdf(
    @Query(new ZodValidationPipe(StockInboundExportQuerySchema))
    query: StockInboundExportQueryInput,
    @Res() res: Response,
  ) {
    const file = await this.exportService.generateStockInboundPdf(
      this.requireWarehouseId(),
      query.search,
    );
    this.sendFile(res, file, 'application/pdf');
  }

  private sendFile(res: Response, file: ExportFile, contentType: string) {
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename=${file.filename}`,
      'Content-Length': file.buffer.length,
    });
    res.end(file.buffer);
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

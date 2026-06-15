import { Controller, Get, Query, Res, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';

@Controller('reports/stock-movement')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Report'))
  async getReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('productId') productId?: string,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }
    return this.service.getDailyStockMovementReport(warehouseId, {
      startDate,
      endDate,
      productId,
    });
  }

  @Get('detail')
  @CheckPolicies((ability) => ability.can('read', 'Report'))
  async getDetail(
    @Query('date') date: string,
    @Query('productUuid') productUuid: string,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }
    return this.service.getDailyStockMovementDetail(warehouseId, {
      date,
      productUuid,
    });
  }

  @Get('export/pdf')
  @CheckPolicies((ability) => ability.can('read', 'Report'))
  async exportPdf(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('productId') productId: string,
    @Res() res: any,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }

    const pdfBuffer = await this.service.generatePdfReport(warehouseId, {
      startDate,
      endDate,
      productId,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=stock-movement-report-${Date.now()}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get('export/csv')
  @CheckPolicies((ability) => ability.can('read', 'Report'))
  async exportCsv(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('productId') productId: string,
    @Res() res: any,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }

    const csvContent = await this.service.generateCsvReport(warehouseId, {
      startDate,
      endDate,
      productId,
    });

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=stock-movement-report-${Date.now()}.csv`,
    });

    res.send(Buffer.from(csvContent));
  }
}

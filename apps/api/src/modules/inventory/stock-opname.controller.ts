import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Req,
  Res,
} from '@nestjs/common';
import { StockOpnameService } from './stock-opname.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';

@Controller('stock-opname')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class StockOpnameController {
  constructor(
    private readonly service: StockOpnameService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'StockOpname'))
  async getList(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('createdById') createdById?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.getList(warehouseId, {
      search,
      status,
      createdById,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'StockOpname'))
  async getDetail(@Param('uuid') uuid: string) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.getDetail(warehouseId, uuid);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'StockOpname'))
  @AuditLogAction('STOCK_OPNAME_CREATE')
  async create(@Req() req: any, @Body('notes') notes?: string) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    const createdById = req.user.id;
    return this.service.createStockOpname(warehouseId, createdById, notes);
  }

  @Put(':uuid')
  @CheckPolicies((ability) => ability.can('update', 'StockOpname'))
  @AuditLogAction('STOCK_OPNAME_UPDATE_DRAFT')
  async update(
    @Param('uuid') uuid: string,
    @Body()
    body: {
      notes?: string;
      stacks?: Array<{ uuid: string; actualQty: number | null }>;
      attachmentPaths?: string[];
    },
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.updateStockOpname(warehouseId, uuid, body);
  }

  @Post(':uuid/submit')
  @CheckPolicies((ability) => ability.can('update', 'StockOpname'))
  @AuditLogAction('STOCK_OPNAME_SUBMIT')
  async submit(@Param('uuid') uuid: string) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.submitStockOpname(warehouseId, uuid);
  }

  @Get(':uuid/counting-sheet/pdf')
  @CheckPolicies((ability) => ability.can('read', 'StockOpname'))
  async exportCountingSheet(@Param('uuid') uuid: string, @Res() res: any) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }

    const pdfBuffer = await this.service.generateCountingSheetPdf(
      warehouseId,
      uuid,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=counting-sheet-${uuid}-${Date.now()}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get(':uuid/export/pdf')
  @CheckPolicies((ability) => ability.can('read', 'StockOpname'))
  async exportResultPdf(@Param('uuid') uuid: string, @Res() res: any) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }

    const pdfBuffer = await this.service.generateResultPdf(warehouseId, uuid);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=stock-opname-report-${uuid}-${Date.now()}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}

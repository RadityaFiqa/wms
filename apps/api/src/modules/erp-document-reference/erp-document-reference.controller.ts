import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { ErpDocumentReferenceService } from './erp-document-reference.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';

@Controller('erp-document-references')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class ErpDocumentReferenceController {
  constructor(
    private readonly service: ErpDocumentReferenceService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: 'IN' | 'OUT',
    @Query('state') state?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('refFax') refFax?: string,
    @Query('gateOperationUuid') gateOperationUuid?: string,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.findAll(warehouseId, {
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      type,
      state,
      startDate,
      endDate,
      refFax,
      gateOperationUuid,
    });
  }

  @Get('partners')
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async findUniquePartners() {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.findUniquePartners(warehouseId);
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async findOne(@Param('uuid') uuid: string) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.findOne(warehouseId, uuid);
  }

  @Get('sync/status')
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async getSyncStatus() {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.getSyncStatus(warehouseId);
  }

  @Post('sync')
  @CheckPolicies((ability) => ability.can('update', 'Inventory'))
  @AuditLogAction('ERP_DOCUMENT_SYNC')
  async sync(@Req() req: any) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }

    const triggeredBy = req.user?.email || 'System';
    return this.service.triggerSync(warehouseId, triggeredBy);
  }

  @Post(':id/force-sync')
  @CheckPolicies((ability) => ability.can('update', 'Inventory'))
  @AuditLogAction('ERP_DOCUMENT_FORCE_SYNC')
  async forceSync(@Param('id') idOrUuid: string, @Req() req: any) {
    if (req.user?.role?.name !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Akses ditolak. Hanya Super Admin yang dapat mensinkronkan paksa dokumen ERP.',
      );
    }
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Warehouse context (header x-warehouse-id) diperlukan.',
      );
    }

    const triggeredBy = req.user?.email || 'System';
    return this.service.forceSyncDocument(warehouseId, idOrUuid, triggeredBy);
  }
}

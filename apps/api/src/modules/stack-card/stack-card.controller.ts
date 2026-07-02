import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { StackCardService } from './stack-card.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import {
  ImportStackCardSchema,
  ImportStackCardInput,
  UpdateStackCardSchema,
  UpdateStackCardInput,
} from '@bulog-wms/schema';

@Controller('stack-cards')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class StackCardController {
  constructor(
    private readonly service: StackCardService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  @Post('import')
  @CheckPolicies((ability) => ability.can('update', 'Inventory'))
  @AuditLogAction('STACK_CARD_CSV_IMPORT')
  async import(@Req() req: any, @Body() body: any) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }

    const validationResult = ImportStackCardSchema.safeParse(body);
    if (!validationResult.success) {
      throw new BadRequestException(
        validationResult.error.errors.map((e) => e.message).join(', '),
      );
    }

    const userId = req.user.id;
    return this.service.importStackCards(warehouseId, userId, validationResult.data);
  }

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('locationName') locationName?: string,
    @Query('sku') sku?: string,
    @Query('lot') lot?: string,
    @Query('snapshotDate') snapshotDate?: string,
    @Query('isPublished') isPublished?: string,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }

    return this.service.findAll(warehouseId, {
      search,
      page,
      limit,
      locationName,
      sku,
      lot,
      snapshotDate,
      isPublished,
    });
  }

  @Get('history')
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async getHistory() {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }
    return this.service.getUploadHistory(warehouseId);
  }

  @Get('snapshot-dates')
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async getSnapshotDates(@Query('onlyPublished') onlyPublished?: string) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }
    return this.service.getSnapshotDates(warehouseId, onlyPublished === 'true');
  }

  @Get('locations')
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async getLocations(@Query('onlyPublished') onlyPublished?: string) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }
    return this.service.getLocations(warehouseId, onlyPublished === 'true');
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async findOne(@Param('uuid') uuid: string) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }
    return this.service.findOne(warehouseId, uuid);
  }

  @Put('bulk-publish')
  @CheckPolicies((ability) => ability.can('update', 'Inventory'))
  @AuditLogAction('STACK_CARD_BULK_PUBLISH')
  async bulkPublish(
    @Body('uuids') uuids: string[],
    @Body('isPublished') isPublished: boolean,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }
    if (!Array.isArray(uuids) || uuids.length === 0) {
      throw new BadRequestException('Array uuids wajib diisi.');
    }
    return this.service.bulkPublish(warehouseId, uuids, isPublished);
  }

  @Put('publish-snapshot')
  @CheckPolicies((ability) => ability.can('update', 'Inventory'))
  @AuditLogAction('STACK_CARD_SNAPSHOT_PUBLISH')
  async publishSnapshot(
    @Body('snapshotDate') snapshotDate: string,
    @Body('isPublished') isPublished: boolean,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }
    if (!snapshotDate) {
      throw new BadRequestException('Tanggal snapshot wajib diisi.');
    }
    return this.service.publishSnapshot(warehouseId, snapshotDate, isPublished);
  }

  @Delete('bulk-delete')
  @CheckPolicies((ability) => ability.can('update', 'Inventory'))
  @AuditLogAction('STACK_CARD_BULK_DELETE')
  async bulkDelete(@Body('uuids') uuids: string[]) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }
    if (!Array.isArray(uuids) || uuids.length === 0) {
      throw new BadRequestException('Array uuids wajib diisi.');
    }
    return this.service.bulkDelete(warehouseId, uuids);
  }

  @Put(':uuid')
  @CheckPolicies((ability) => ability.can('update', 'Inventory'))
  @AuditLogAction('STACK_CARD_UPDATE')
  async update(@Param('uuid') uuid: string, @Body() body: any) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }

    const validationResult = UpdateStackCardSchema.safeParse(body);
    if (!validationResult.success) {
      throw new BadRequestException(
        validationResult.error.errors.map((e) => e.message).join(', '),
      );
    }

    return this.service.update(warehouseId, uuid, validationResult.data);
  }

  @Delete(':uuid')
  @CheckPolicies((ability) => ability.can('update', 'Inventory'))
  @AuditLogAction('STACK_CARD_DELETE')
  async remove(@Param('uuid') uuid: string) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
    }
    return this.service.delete(warehouseId, uuid);
  }
}

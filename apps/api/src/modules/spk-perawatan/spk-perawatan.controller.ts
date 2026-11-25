import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '@/core/warehouse-context/warehouse.guard';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import { PoliciesGuard } from '@/modules/casl/policies.guard';
import { CheckPolicies } from '@/modules/casl/policies.decorator';
import { AuditLogInterceptor } from '@/modules/audit-log/audit-log.interceptor';
import { AuditLogAction } from '@/modules/audit-log/audit-log.decorator';
import { ZodValidationPipe } from '@/core/pipes/zod-validation.pipe';
import { SpkPerawatanService } from '@/modules/spk-perawatan/spk-perawatan.service';
import {
  SpkPerawatanExportQuerySchema,
  SpkPerawatanQuerySchema,
} from '@bulog-wms/schema';
import type {
  SpkPerawatanExportQueryInput,
  SpkPerawatanQueryInput,
} from '@bulog-wms/schema';

@Controller('spk-perawatan')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class SpkPerawatanController {
  constructor(
    private readonly service: SpkPerawatanService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  findAll(
    @Query(new ZodValidationPipe(SpkPerawatanQuerySchema))
    query: SpkPerawatanQueryInput,
  ) {
    return this.service.findAll(this.requireWarehouseId(), query);
  }

  @Post('sync')
  @CheckPolicies((ability) => ability.can('update', 'Inventory'))
  @AuditLogAction('SPK_PERAWATAN_SYNC')
  sync() {
    return this.service.sync(this.requireWarehouseId());
  }

  @Get('export/xlsx')
  @CheckPolicies((ability) => ability.can('read', 'Inventory'))
  async exportXlsx(
    @Query(new ZodValidationPipe(SpkPerawatanExportQuerySchema))
    query: SpkPerawatanExportQueryInput,
    @Res() res: Response,
  ) {
    const file = await this.service.exportXlsx(this.requireWarehouseId(), query);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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

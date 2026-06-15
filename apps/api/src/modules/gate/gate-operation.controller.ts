import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
  ForbiddenException,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';
import { CreateGateOperationSchema } from '@bulog-wms/schema';
import type { CreateGateOperationInput } from '@bulog-wms/schema';
import { GateService } from './gate.service';

@Controller('gate-operations')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class GateOperationController {
  constructor(private readonly service: GateService) {}

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'GateOperation'))
  @AuditLogAction('GATE_OPERATION_CREATE')
  async create(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateGateOperationSchema)) body: CreateGateOperationInput,
  ) {
    const userId = req.user?.id;
    return this.service.createGateOperation(userId, body);
  }

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'GateOperation'))
  async findAll(
    @Query('search') search?: string,
    @Query('cardType') cardType?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getGateOperations({
      search,
      cardType,
      status,
      startDate,
      endDate,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('client-history')
  @CheckPolicies((ability) => ability.can('read', 'GateOperation'))
  async getClientHistory(
    @Query('clientPartner') clientPartner: string,
    @Req() req: any,
  ) {
    const warehouseId = this.service['warehouseContext'].getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Konteks warehouse (header x-warehouse-id) diperlukan.');
    }
    return this.service.getClientHistory(warehouseId, clientPartner);
  }

  @Post(':uuid/cargo')
  @CheckPolicies((ability) => ability.can('update', 'GateOperation'))
  @AuditLogAction('GATE_OPERATION_CARGO_ADD')
  async addCargoItem(
    @Param('uuid') uuid: string,
    @Req() req: any,
    @Body() body: { productId: number; quantity: number; notes?: string; quantId?: number; locationId?: number },
  ) {
    const user = req.user;
    if (user.role?.name !== 'SUPER_ADMIN' && user.role?.name !== 'WAREHOUSE_ADMIN') {
      throw new ForbiddenException('Hanya Admin yang dapat menambah barang muatan.');
    }
    const result = await this.service.addCargoItem(uuid, body);
    req.auditDetails = {
      inventory: {
        sku: result.inventory?.sku,
        name: result.inventory?.name,
        uom: result.inventory?.uom,
      },
      quantity: result.quantity,
      notes: result.notes,
      quantId: result.quantId,
      locationId: result.locationId,
    };
    return result;
  }

  @Put('cargo/:cargoUuid')
  @CheckPolicies((ability) => ability.can('update', 'GateOperation'))
  @AuditLogAction('GATE_OPERATION_CARGO_UPDATE')
  async updateCargoItem(
    @Param('cargoUuid') cargoUuid: string,
    @Req() req: any,
    @Body() body: { quantId?: number | null; locationId?: number | null; quantity?: number },
  ) {
    const user = req.user;
    if (user.role?.name !== 'SUPER_ADMIN' && user.role?.name !== 'WAREHOUSE_ADMIN') {
      throw new ForbiddenException('Hanya Admin yang dapat mengubah barang muatan.');
    }
    const result = await this.service.updateCargoItem(cargoUuid, body);
    req.auditDetails = {
      inventory: {
        sku: result.inventory?.sku,
        name: result.inventory?.name,
        uom: result.inventory?.uom,
      },
      quantity: result.quantity,
      notes: result.notes,
      quantId: result.quantId,
      locationId: result.locationId,
    };
    return result;
  }

  @Delete('cargo/:cargoUuid')
  @CheckPolicies((ability) => ability.can('update', 'GateOperation'))
  @AuditLogAction('GATE_OPERATION_CARGO_DELETE')
  async deleteCargoItem(
    @Param('cargoUuid') cargoUuid: string,
    @Req() req: any,
  ) {
    const user = req.user;
    if (user.role?.name !== 'SUPER_ADMIN' && user.role?.name !== 'WAREHOUSE_ADMIN') {
      throw new ForbiddenException('Hanya Admin yang dapat menghapus barang muatan.');
    }
    const result = await this.service.deleteCargoItem(cargoUuid);
    req.auditDetails = {
      deletedItem: {
        sku: result.deletedItem?.inventory?.sku,
        name: result.deletedItem?.inventory?.name,
        uom: result.deletedItem?.inventory?.uom,
        quantity: result.deletedItem?.quantity,
        notes: result.deletedItem?.notes,
      },
    };
    return result;
  }

  @Get(':id/delivery-order')
  @CheckPolicies((ability) => ability.can('read', 'GateOperation'))
  async getDeliveryOrderPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.service.generateDeliveryOrderPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="surat-jalan-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Get(':id/delivery-order-preview')
  @CheckPolicies((ability) => ability.can('read', 'GateOperation'))
  async getDeliveryOrderPreview(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const html = await this.service.generateDeliveryOrderHtml(id);
    res.set({
      'Content-Type': 'text/html',
    });
    res.end(html);
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'GateOperation'))
  async findOne(@Param('uuid') uuid: string) {
    return this.service.getGateOperationByUuid(uuid);
  }
}

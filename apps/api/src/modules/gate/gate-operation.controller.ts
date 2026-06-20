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
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WarehouseGuard } from '../../core/warehouse-context/warehouse.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { AuditLogInterceptor } from '../audit-log/audit-log.interceptor';
import { AuditLogAction } from '../audit-log/audit-log.decorator';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';
import {
  CreateGateOperationSchema,
  CreateGateVerificationSchema,
} from '@bulog-wms/schema';
import type {
  CreateGateOperationInput,
  CreateGateVerificationInput,
} from '@bulog-wms/schema';
import { GateService } from './gate.service';

@Controller('gate-operations')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class GateOperationController {
  private readonly logger = new Logger(GateOperationController.name);

  constructor(private readonly service: GateService) {}

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'GateOperation'))
  @AuditLogAction('GATE_OPERATION_CREATE')
  async create(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateGateOperationSchema))
    body: CreateGateOperationInput,
  ) {
    const userId = req.user?.id;
    const result = await this.service.createGateOperation(userId, body);

    this.logger.log(`createdOp result result ${JSON.stringify(result, null, 2)}`);

    req.auditDetails = { operationUuid: result.uuid };
    return result;
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
      throw new BadRequestException(
        'Konteks warehouse (header x-warehouse-id) diperlukan.',
      );
    }
    return this.service.getClientHistory(warehouseId, clientPartner);
  }

  @Post(':uuid/cargo')
  @CheckPolicies((ability) => ability.can('update', 'GateOperation'))
  @AuditLogAction('GATE_OPERATION_CARGO_ADD')
  async addCargoItem(
    @Param('uuid') uuid: string,
    @Req() req: any,
    @Body()
    body: {
      productId: number;
      quantity: number;
      notes?: string;
      quantId?: number;
      locationId?: number;
    },
  ) {
    const user = req.user;
    if (
      user.role?.name !== 'SUPER_ADMIN' &&
      user.role?.name !== 'WAREHOUSE_ADMIN'
    ) {
      throw new ForbiddenException(
        'Hanya Admin yang dapat menambah barang muatan.',
      );
    }
    const result = await this.service.addCargoItem(uuid, body);
    req.auditDetails = {
      operationUuid: uuid,
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
    @Body()
    body: {
      quantId?: number | null;
      locationId?: number | null;
      quantity?: number;
    },
  ) {
    const user = req.user;
    if (
      user.role?.name !== 'SUPER_ADMIN' &&
      user.role?.name !== 'WAREHOUSE_ADMIN'
    ) {
      throw new ForbiddenException(
        'Hanya Admin yang dapat mengubah barang muatan.',
      );
    }
    const result = await this.service.updateCargoItem(cargoUuid, body);
    req.auditDetails = {
      operationUuid: result.gateOperation?.uuid,
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
    if (
      user.role?.name !== 'SUPER_ADMIN' &&
      user.role?.name !== 'WAREHOUSE_ADMIN'
    ) {
      throw new ForbiddenException(
        'Hanya Admin yang dapat menghapus barang muatan.',
      );
    }
    const result = await this.service.deleteCargoItem(cargoUuid);
    req.auditDetails = {
      operationUuid: result.deletedItem?.gateOperation?.uuid,
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
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userId = req.user?.id;
    const pdfBuffer = await this.service.generateDeliveryOrderPdf(id, userId);
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
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userId = req.user?.id;
    const html = await this.service.generateDeliveryOrderHtml(id, userId);
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



  @Post(':uuid/verify')
  @CheckPolicies((ability) => ability.can('update', 'GateOperation'))
  @AuditLogAction('GATE_OPERATION_VERIFY')
  async verify(
    @Param('uuid') uuid: string,
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateGateVerificationSchema))
    body: CreateGateVerificationInput,
  ) {
    const userId = req.user?.id;
    return this.service.verifyGateOperation(uuid, userId, body);
  }

  @Post(':uuid/cancel')
  @CheckPolicies((ability) => ability.can('update', 'GateOperation'))
  @AuditLogAction('GATE_OPERATION_CANCEL')
  async cancel(@Param('uuid') uuid: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.service.cancelGateVerification(uuid, userId);
  }

  @Put(':uuid/notes-attachments')
  @CheckPolicies((ability) => ability.can('update', 'GateOperation'))
  @AuditLogAction('GATE_OPERATION_NOTES_ATTACHMENTS_UPDATE')
  async updateNotesAttachments(
    @Param('uuid') uuid: string,
    @Req() req: any,
    @Body() body: { notes?: string; attachmentPaths?: string[] },
  ) {
    const userId = req.user?.id;
    req.auditDetails = {
      operationUuid: uuid,
      notes: body.notes,
    };
    return this.service.updateNotesAttachments(uuid, userId, body);
  }

  @Post(':uuid/confirm')
  @CheckPolicies((ability) => ability.can('update', 'GateOperation'))
  @AuditLogAction('GATE_OPERATION_CONFIRM')
  async confirm(
    @Param('uuid') uuid: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.service.confirmGateVerification(uuid, userId);
  }



  @Get(':uuid/history')
  @CheckPolicies((ability) => ability.can('read', 'GateOperation'))
  async getVerificationHistory(
    @Param('uuid') uuid: string,
  ) {
    return this.service.getVerificationHistory(uuid);
  }
}

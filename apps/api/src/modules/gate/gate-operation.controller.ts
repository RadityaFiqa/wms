import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
  ForbiddenException,
} from '@nestjs/common';
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

  @Post(':uuid/products')
  @CheckPolicies((ability) => ability.can('update', 'GateOperation'))
  @AuditLogAction('GATE_OPERATION_CARGO_ADD')
  async addCargoItem(
    @Param('uuid') uuid: string,
    @Req() req: any,
    @Body() body: { productId: number; quantity: number; notes?: string },
  ) {
    const user = req.user;
    if (user.role?.name !== 'SUPER_ADMIN' && user.role?.name !== 'WAREHOUSE_ADMIN') {
      throw new ForbiddenException('Hanya Admin yang dapat menambah barang muatan.');
    }
    const result = await this.service.addCargoItem(uuid, body);
    req.auditDetails = {
      product: {
        sku: result.product?.sku,
        name: result.product?.name,
        uom: result.product?.uom,
      },
      quantity: result.quantity,
      notes: result.notes,
    };
    return result;
  }

  @Delete('products/:productUuid')
  @CheckPolicies((ability) => ability.can('update', 'GateOperation'))
  @AuditLogAction('GATE_OPERATION_CARGO_DELETE')
  async deleteCargoItem(
    @Param('productUuid') productUuid: string,
    @Req() req: any,
  ) {
    const user = req.user;
    if (user.role?.name !== 'SUPER_ADMIN' && user.role?.name !== 'WAREHOUSE_ADMIN') {
      throw new ForbiddenException('Hanya Admin yang dapat menghapus barang muatan.');
    }
    const result = await this.service.deleteCargoItem(productUuid);
    req.auditDetails = {
      deletedItem: {
        sku: result.deletedItem?.product?.sku,
        name: result.deletedItem?.product?.name,
        uom: result.deletedItem?.product?.uom,
        quantity: result.deletedItem?.quantity,
        notes: result.deletedItem?.notes,
      },
    };
    return result;
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'GateOperation'))
  async findOne(@Param('uuid') uuid: string) {
    return this.service.getGateOperationByUuid(uuid);
  }
}

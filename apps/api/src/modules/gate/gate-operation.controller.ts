import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getGateOperations({
      search,
      cardType,
      status,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get(':uuid')
  @CheckPolicies((ability) => ability.can('read', 'GateOperation'))
  async findOne(@Param('uuid') uuid: string) {
    return this.service.getGateOperationByUuid(uuid);
  }
}

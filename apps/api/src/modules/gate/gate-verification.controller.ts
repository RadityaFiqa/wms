import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
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
import { CreateGateVerificationSchema, AssignReferencesSchema } from '@bulog-wms/schema';
import type { CreateGateVerificationInput, AssignReferencesInput } from '@bulog-wms/schema';
import { GateService } from './gate.service';

@Controller('gate-verifications')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class GateVerificationController {
  constructor(private readonly service: GateService) {}

  @Get(':operationUuid/available-references')
  @CheckPolicies((ability) => ability.can('read', 'GateVerification'))
  async getAvailableReferences(
    @Param('operationUuid') operationUuid: string,
    @Query('productId') productId?: string,
    @Query('gateItemId') gateItemId?: string,
  ) {
    if (!productId) {
      throw new BadRequestException('Parameter productId diperlukan.');
    }
    return this.service.getAvailableReferences(
      operationUuid,
      Number(productId),
      gateItemId ? Number(gateItemId) : undefined,
    );
  }

  @Post(':operationUuid/assign-references')
  @CheckPolicies((ability) => ability.can('create', 'GateVerification'))
  @AuditLogAction('GATE_OPERATION_ASSIGN_REFERENCES')
  async assignReferences(
    @Param('operationUuid') operationUuid: string,
    @Req() req: any,
    @Body(new ZodValidationPipe(AssignReferencesSchema)) body: AssignReferencesInput,
  ) {
    const userId = req.user?.id;
    const userName = req.user?.name || req.user?.email || 'System';
    return this.service.assignReferences(operationUuid, userId, userName, body);
  }

  @Post(':operationUuid')
  @CheckPolicies((ability) => ability.can('create', 'GateVerification'))
  @AuditLogAction('GATE_OPERATION_VERIFY')
  async verify(
    @Param('operationUuid') operationUuid: string,
    @Req() req: any,
    @Body(new ZodValidationPipe(CreateGateVerificationSchema)) body: CreateGateVerificationInput,
  ) {
    const userId = req.user?.id;
    return this.service.verifyGateOperation(operationUuid, userId, body);
  }

  @Post(':operationUuid/cancel')
  @CheckPolicies((ability) => ability.can('create', 'GateVerification'))
  @AuditLogAction('GATE_OPERATION_CANCEL')
  async cancel(
    @Param('operationUuid') operationUuid: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.service.cancelGateVerification(operationUuid, userId);
  }

  @Delete('references/:referenceUuid')
  @CheckPolicies((ability) => ability.can('create', 'GateVerification'))
  @AuditLogAction('GATE_OPERATION_UNASSIGN_REFERENCE')
  async unassignReference(
    @Param('referenceUuid') referenceUuid: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    const userName = req.user?.name || req.user?.email || 'System';
    const result = await this.service.unassignReference(referenceUuid, userId, userName);
    req.auditDetails = result.auditDetails;
    return result;
  }
}

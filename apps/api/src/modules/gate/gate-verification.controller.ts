import {
  Controller,
  Post,
  Body,
  Param,
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
import { CreateGateVerificationSchema } from '@bulog-wms/schema';
import type { CreateGateVerificationInput } from '@bulog-wms/schema';
import { GateService } from './gate.service';

@Controller('gate-verifications')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class GateVerificationController {
  constructor(private readonly service: GateService) {}

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
}

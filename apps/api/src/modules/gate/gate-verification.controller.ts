import {
  Controller,
  Post,
  Body,
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
import { BulkApproveSchema, BulkRejectSchema } from '@bulog-wms/schema';
import type { BulkApproveInput, BulkRejectInput } from '@bulog-wms/schema';
import { GateService } from './gate.service';

@Controller('gate-verifications')
@UseGuards(JwtAuthGuard, WarehouseGuard, PoliciesGuard)
@UseInterceptors(AuditLogInterceptor)
export class GateVerificationController {
  constructor(private readonly service: GateService) {}

  @Post('bulk-approve')
  @CheckPolicies((ability) => ability.can('update', 'GateOperation'))
  @AuditLogAction('GATE_OPERATION_BULK_APPROVE')
  async bulkApprove(
    @Req() req: any,
    @Body(new ZodValidationPipe(BulkApproveSchema))
    body: BulkApproveInput,
  ) {
    const userId = req.user?.id;
    return this.service.bulkApprove(body.ids, userId);
  }

  @Post('bulk-reject')
  @CheckPolicies((ability) => ability.can('update', 'GateOperation'))
  @AuditLogAction('GATE_OPERATION_BULK_REJECT')
  async bulkReject(
    @Req() req: any,
    @Body(new ZodValidationPipe(BulkRejectSchema))
    body: BulkRejectInput,
  ) {
    const userId = req.user?.id;
    return this.service.bulkReject(body.ids, body.reason, userId);
  }
}

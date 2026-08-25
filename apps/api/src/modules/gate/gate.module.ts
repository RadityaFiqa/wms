import { Module } from '@nestjs/common';
import { GateService } from './gate.service';
import { GateOperationController } from './gate-operation.controller';
import { GateVerificationController } from './gate-verification.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  providers: [GateService],
  controllers: [GateOperationController, GateVerificationController],
  exports: [GateService],
})
export class GateModule {}

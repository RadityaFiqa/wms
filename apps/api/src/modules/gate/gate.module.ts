import { Module } from '@nestjs/common';
import { GateService } from './gate.service';
import { GateOperationController } from './gate-operation.controller';
import { GateVerificationController } from './gate-verification.controller';

@Module({
  providers: [GateService],
  controllers: [GateOperationController, GateVerificationController],
  exports: [GateService],
})
export class GateModule {}

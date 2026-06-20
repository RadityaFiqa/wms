import { Module } from '@nestjs/common';
import { GateService } from './gate.service';
import { GateOperationController } from './gate-operation.controller';

@Module({
  providers: [GateService],
  controllers: [GateOperationController],
  exports: [GateService],
})
export class GateModule {}

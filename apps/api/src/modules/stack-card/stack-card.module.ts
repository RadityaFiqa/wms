import { Module } from '@nestjs/common';
import { StackCardService } from './stack-card.service';
import { StackCardController } from './stack-card.controller';
import { StackCardPublicController } from './stack-card-public.controller';
import { CaslModule } from '../casl/casl.module';
import { WarehouseContextModule } from '../../core/warehouse-context/warehouse-context.module';

@Module({
  imports: [CaslModule, WarehouseContextModule],
  controllers: [StackCardController, StackCardPublicController],
  providers: [StackCardService],
  exports: [StackCardService],
})
export class StackCardModule {}

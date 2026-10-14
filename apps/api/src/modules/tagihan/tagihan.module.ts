import { Module } from '@nestjs/common';
import { TagihanController } from './tagihan.controller';
import { TagihanService } from './tagihan.service';
import { MasterTagihanStatusService } from './master-tagihan-status.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [TagihanController],
  providers: [TagihanService, MasterTagihanStatusService],
  exports: [TagihanService, MasterTagihanStatusService],
})
export class TagihanModule {}

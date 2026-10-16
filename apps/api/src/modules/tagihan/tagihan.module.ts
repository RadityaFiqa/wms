import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TagihanController } from './tagihan.controller';
import { TagihanService } from './tagihan.service';
import { MasterTagihanStatusService } from './master-tagihan-status.service';
import { TagihanReportService } from './tagihan-report.service';
import { TagihanReportProcessor } from './tagihan-report.processor';
import { StorageModule } from '../storage/storage.module';
import { OdooModule } from '../odoo/odoo.module';

@Module({
  imports: [
    StorageModule,
    OdooModule,
    BullModule.registerQueue({
      name: 'tagihan-reports',
    }),
  ],
  controllers: [TagihanController],
  providers: [
    TagihanService,
    MasterTagihanStatusService,
    TagihanReportService,
    TagihanReportProcessor,
  ],
  exports: [TagihanService, MasterTagihanStatusService, TagihanReportService],
})
export class TagihanModule {}


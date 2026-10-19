import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TagihanController } from './tagihan.controller';
import { TagihanService } from './tagihan.service';
import { MasterTagihanStatusService } from './master-tagihan-status.service';
import { TagihanReportService } from './tagihan-report.service';
import { TagihanReportProcessor } from './tagihan-report.processor';
import { StorageModule } from '../storage/storage.module';
import { OdooModule } from '../odoo/odoo.module';
import { DocumentModule } from '@/modules/document/document.module';
import { TagihanDocumentController } from '@/modules/tagihan/tagihan-document.controller';
import { TagihanDocumentService } from '@/modules/tagihan/tagihan-document.service';

@Module({
  imports: [
    StorageModule,
    OdooModule,
    DocumentModule,
    BullModule.registerQueue({
      name: 'tagihan-reports',
    }),
  ],
  controllers: [TagihanController, TagihanDocumentController],
  providers: [
    TagihanService,
    MasterTagihanStatusService,
    TagihanReportService,
    TagihanReportProcessor,
    TagihanDocumentService,
  ],
  exports: [TagihanService, MasterTagihanStatusService, TagihanReportService],
})
export class TagihanModule {}


import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { WarehouseContextModule } from '../../core/warehouse-context/warehouse-context.module';
import { DocumentTemplateController } from './document-template.controller';
import { DocumentTemplateService } from './document-template.service';
import { DocumentGenerationController } from './document-generation.controller';
import { DocumentGenerationService } from './document-generation.service';
import { DocumentProcessor } from './document-processor';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    WarehouseContextModule,
    BullModule.registerQueue({
      name: 'document-generation',
    }),
  ],
  controllers: [DocumentTemplateController, DocumentGenerationController],
  providers: [
    DocumentTemplateService,
    DocumentGenerationService,
    DocumentProcessor,
  ],
  exports: [DocumentTemplateService, DocumentGenerationService],
})
export class DocumentModule {}

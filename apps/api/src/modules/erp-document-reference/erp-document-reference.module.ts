import { Module } from '@nestjs/common';
import { ErpDocumentReferenceService } from './erp-document-reference.service';
import { ErpDocumentReferenceController } from './erp-document-reference.controller';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { OdooModule } from '../odoo/odoo.module';
import { WarehouseContextModule } from '../../core/warehouse-context/warehouse-context.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    PrismaModule,
    OdooModule,
    WarehouseContextModule,
    AuditLogModule,
  ],
  controllers: [ErpDocumentReferenceController],
  providers: [ErpDocumentReferenceService],
  exports: [ErpDocumentReferenceService],
})
export class ErpDocumentReferenceModule {}

import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OdooController } from './odoo.controller';
import { OdooRepository } from './odoo.repository';
import { OdooClient } from './odoo-client';
import { OdooAuthService } from './odoo-auth.service';
import { OdooSessionManager } from './odoo-session.manager';
import { OdooQueueProcessor } from './odoo-queue.processor';
import { OdooCronService } from './odoo-cron.service';
import { OdooSyncService } from './odoo-sync.service';
import { ErpDocumentReferenceModule } from '../erp-document-reference/erp-document-reference.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'odoo_queue',
    }),
    forwardRef(() => ErpDocumentReferenceModule),
    forwardRef(() => InventoryModule),
  ],
  controllers: [OdooController],
  providers: [
    OdooRepository,
    OdooClient,
    OdooAuthService,
    OdooSessionManager,
    OdooQueueProcessor,
    OdooCronService,
    OdooSyncService,
  ],
  exports: [OdooAuthService, OdooSessionManager, OdooClient, OdooSyncService],
})
export class OdooModule {}

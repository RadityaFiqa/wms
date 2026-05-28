import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OdooController } from './odoo.controller';
import { OdooRepository } from './odoo.repository';
import { OdooClient } from './odoo-client';
import { OdooAuthService } from './odoo-auth.service';
import { OdooSessionManager } from './odoo-session.manager';
import { OdooQueueProcessor } from './odoo-queue.processor';
import { OdooCronService } from './odoo-cron.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'odoo_queue',
    }),
  ],
  controllers: [OdooController],
  providers: [
    OdooRepository,
    OdooClient,
    OdooAuthService,
    OdooSessionManager,
    OdooQueueProcessor,
    OdooCronService,
  ],
  exports: [OdooAuthService, OdooSessionManager, OdooClient],
})
export class OdooModule {}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OdooRepository } from './odoo.repository';

@Injectable()
export class OdooCronService {
  private readonly logger = new Logger(OdooCronService.name);

  constructor(
    private readonly repository: OdooRepository,
    @InjectQueue('odoo_queue') private readonly odooQueue: Queue,
  ) {}

  /**
   * Run daily at midnight to queue session refreshes for all active Odoo accounts.
   * Leverages BullMQ for retry mechanisms and error isolation.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async queueDailySessionRefreshes() {
    this.logger.log('Memulai penjadwalan harian refresh session Odoo...');
    try {
      const activeAccounts = await this.repository.findActiveAccounts();

      for (const account of activeAccounts) {
        await this.odooQueue.add(
          'refresh_session',
          { accountId: account.id },
          {
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 30000, // 30 seconds initial delay, then 60s, 120s...
            },
            removeOnComplete: true,
          },
        );
        this.logger.log(
          `Menambahkan job refresh_session untuk gudang ${account.warehouse.name} ke antrean`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Gagal melakukan penjadwalan harian refresh session Odoo: ${err.message}`,
      );
    }
  }
}

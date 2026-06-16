import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { OdooSessionManager } from './odoo-session.manager';
import { OdooAuthService } from './odoo-auth.service';

@Injectable()
@Processor('odoo_queue')
export class OdooQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(OdooQueueProcessor.name);

  constructor(
    private readonly sessionManager: OdooSessionManager,
    private readonly authService: OdooAuthService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { accountId } = job.data;
    this.logger.log(
      `Processing odoo job: ${job.name} for account ID ${accountId}`,
    );

    switch (job.name) {
      case 'refresh_session':
        try {
          const refreshed =
            await this.sessionManager.validateAndRefreshSession(accountId);
          return { success: true, refreshed };
        } catch (err: any) {
          this.logger.error(
            `Failed to refresh session in background job: ${err.message}`,
          );
          throw err;
        }

      case 'retry_login':
        try {
          const session = await this.authService.establishSession(accountId);
          return { success: true, sessionCreated: !!session };
        } catch (err: any) {
          this.logger.error(
            `Failed to retry login in background job: ${err.message}`,
          );
          throw err;
        }

      default:
        this.logger.warn(`Unknown job name in odoo_queue: ${job.name}`);
        return { success: false, error: 'Unknown job name' };
    }
  }
}

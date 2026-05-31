import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OdooSessionManager } from './odoo-session.manager';
import { OdooAuthService } from './odoo-auth.service';
export declare class OdooQueueProcessor extends WorkerHost {
    private readonly sessionManager;
    private readonly authService;
    private readonly logger;
    constructor(sessionManager: OdooSessionManager, authService: OdooAuthService);
    process(job: Job<any, any, string>): Promise<any>;
}

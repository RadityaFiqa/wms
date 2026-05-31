import { Queue } from 'bullmq';
import { OdooRepository } from './odoo.repository';
export declare class OdooCronService {
    private readonly repository;
    private readonly odooQueue;
    private readonly logger;
    constructor(repository: OdooRepository, odooQueue: Queue);
    queueDailySessionRefreshes(): Promise<void>;
}

import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
export declare class EmailProcessor extends WorkerHost {
    private transporter;
    constructor();
    private renderTemplate;
    process(job: Job<any, any, string>): Promise<any>;
}

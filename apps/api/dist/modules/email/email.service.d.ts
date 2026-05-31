import { Queue } from 'bullmq';
export declare class EmailService {
    private readonly emailQueue;
    constructor(emailQueue: Queue);
    sendWelcomeEmail(email: string, name: string, tempPassword: string): Promise<void>;
    sendPasswordResetEmail(email: string, name: string, resetLink: string): Promise<void>;
    sendAccountStatusEmail(email: string, name: string, isActive: boolean): Promise<void>;
}

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class EmailService {
  constructor(@InjectQueue('email_queue') private readonly emailQueue: Queue) {}

  async sendWelcomeEmail(email: string, name: string, tempPassword: string) {
    await this.emailQueue.add('sendWelcomeEmail', { email, name, tempPassword });
  }

  async sendPasswordResetEmail(email: string, name: string, resetLink: string) {
    await this.emailQueue.add('sendPasswordResetEmail', { email, name, resetLink });
  }

  async sendAccountStatusEmail(email: string, name: string, isActive: boolean) {
    await this.emailQueue.add('sendAccountStatusEmail', { email, name, isActive });
  }
}

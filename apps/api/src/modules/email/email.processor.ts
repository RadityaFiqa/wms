import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

@Processor('email_queue')
export class EmailProcessor extends WorkerHost {
  private transporter: nodemailer.Transporter;

  constructor() {
    super();
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025'),
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
      secure: process.env.SMTP_SECURE === 'true',
    });
  }

  private renderTemplate(templateName: string, context: Record<string, any>): string {
    // Try resolving in multiple possible locations due to difference in rootDirs between tsc compiler and nest-cli asset copy.
    const possiblePaths = [
      path.join(__dirname, 'templates', `${templateName}.hbs`),
      path.join(__dirname, '..', '..', 'modules', 'email', 'templates', `${templateName}.hbs`),
      path.join(__dirname, '..', '..', '..', 'modules', 'email', 'templates', `${templateName}.hbs`),
      path.join(process.cwd(), 'src', 'modules', 'email', 'templates', `${templateName}.hbs`),
      path.join(process.cwd(), 'apps', 'api', 'src', 'modules', 'email', 'templates', `${templateName}.hbs`),
    ];

    let templatePath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        templatePath = p;
        break;
      }
    }

    if (!templatePath) {
      throw new Error(`Template file for ${templateName} not found. Searched in: ${possiblePaths.join(', ')}`);
    }

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);
    return template(context);
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { email, name } = job.data;
    console.log(`Processing email job: ${job.name} for ${email}`);

    let subject = '';
    let html = '';

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    switch (job.name) {
      case 'sendWelcomeEmail': {
        const { tempPassword } = job.data;
        subject = 'Welcome to Bulog WMS - Account Created';
        html = this.renderTemplate('welcome', {
          name,
          email,
          tempPassword,
          loginUrl: `${frontendUrl}/login`,
        });
        break;
      }

      case 'sendPasswordResetEmail': {
        const { resetLink } = job.data;
        subject = 'WMS Bulog - Permintaan Reset Password';
        html = this.renderTemplate('reset-password', {
          name,
          resetLink,
        });
        break;
      }

      case 'sendAccountStatusEmail': {
        const { isActive } = job.data;
        subject = `WMS Bulog - Status Akun Anda ${isActive ? 'Diaktifkan' : 'Dinonaktifkan'}`;
        html = this.renderTemplate('account-status', {
          name,
          isActive,
          statusLabel: isActive ? 'AKTIF (ACTIVE)' : 'NON-AKTIF (INACTIVE)',
          loginUrl: `${frontendUrl}/login`,
        });
        break;
      }

      default:
        console.warn(`Unknown email job name: ${job.name}`);
        return;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"Bulog WMS" <wms@bulog.co.id>',
        to: email,
        subject,
        html,
      });
      console.log(`Email sent successfully to ${email}`);
    } catch (error) {
      console.error(`Failed to send email to ${email}:`, error);
      throw error;
    }
  }
}

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const nodemailer = __importStar(require("nodemailer"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const Handlebars = __importStar(require("handlebars"));
let EmailProcessor = class EmailProcessor extends bullmq_1.WorkerHost {
    transporter;
    constructor() {
        super();
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'localhost',
            port: parseInt(process.env.SMTP_PORT || '1025'),
            auth: process.env.SMTP_USER
                ? {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                }
                : undefined,
            secure: process.env.SMTP_SECURE === 'true',
        });
    }
    renderTemplate(templateName, context) {
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
    async process(job) {
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
        }
        catch (error) {
            console.error(`Failed to send email to ${email}:`, error);
            throw error;
        }
    }
};
exports.EmailProcessor = EmailProcessor;
exports.EmailProcessor = EmailProcessor = __decorate([
    (0, bullmq_1.Processor)('email_queue'),
    __metadata("design:paramtypes", [])
], EmailProcessor);
//# sourceMappingURL=email.processor.js.map
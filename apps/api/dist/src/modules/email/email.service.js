"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
let EmailService = class EmailService {
    emailQueue;
    constructor(emailQueue) {
        this.emailQueue = emailQueue;
    }
    async sendWelcomeEmail(email, name, tempPassword) {
        await this.emailQueue.add('sendWelcomeEmail', { email, name, tempPassword });
    }
    async sendPasswordResetEmail(email, name, resetLink) {
        await this.emailQueue.add('sendPasswordResetEmail', { email, name, resetLink });
    }
    async sendAccountStatusEmail(email, name, isActive) {
        await this.emailQueue.add('sendAccountStatusEmail', { email, name, isActive });
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('email_queue')),
    __metadata("design:paramtypes", [bullmq_2.Queue])
], EmailService);
//# sourceMappingURL=email.service.js.map
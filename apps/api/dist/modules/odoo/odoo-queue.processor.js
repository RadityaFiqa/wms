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
var OdooQueueProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdooQueueProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const odoo_session_manager_1 = require("./odoo-session.manager");
const odoo_auth_service_1 = require("./odoo-auth.service");
let OdooQueueProcessor = OdooQueueProcessor_1 = class OdooQueueProcessor extends bullmq_1.WorkerHost {
    sessionManager;
    authService;
    logger = new common_1.Logger(OdooQueueProcessor_1.name);
    constructor(sessionManager, authService) {
        super();
        this.sessionManager = sessionManager;
        this.authService = authService;
    }
    async process(job) {
        const { accountId } = job.data;
        this.logger.log(`Processing odoo job: ${job.name} for account ID ${accountId}`);
        switch (job.name) {
            case 'refresh_session':
                try {
                    const refreshed = await this.sessionManager.validateAndRefreshSession(accountId);
                    return { success: true, refreshed };
                }
                catch (err) {
                    this.logger.error(`Failed to refresh session in background job: ${err.message}`);
                    throw err;
                }
            case 'retry_login':
                try {
                    const session = await this.authService.establishSession(accountId);
                    return { success: true, sessionCreated: !!session };
                }
                catch (err) {
                    this.logger.error(`Failed to retry login in background job: ${err.message}`);
                    throw err;
                }
            default:
                this.logger.warn(`Unknown job name in odoo_queue: ${job.name}`);
                return { success: false, error: 'Unknown job name' };
        }
    }
};
exports.OdooQueueProcessor = OdooQueueProcessor;
exports.OdooQueueProcessor = OdooQueueProcessor = OdooQueueProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bullmq_1.Processor)('odoo_queue'),
    __metadata("design:paramtypes", [odoo_session_manager_1.OdooSessionManager,
        odoo_auth_service_1.OdooAuthService])
], OdooQueueProcessor);
//# sourceMappingURL=odoo-queue.processor.js.map
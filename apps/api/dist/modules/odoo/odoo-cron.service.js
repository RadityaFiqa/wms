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
var OdooCronService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdooCronService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const odoo_repository_1 = require("./odoo.repository");
let OdooCronService = OdooCronService_1 = class OdooCronService {
    repository;
    odooQueue;
    logger = new common_1.Logger(OdooCronService_1.name);
    constructor(repository, odooQueue) {
        this.repository = repository;
        this.odooQueue = odooQueue;
    }
    async queueDailySessionRefreshes() {
        this.logger.log('Memulai penjadwalan harian refresh session Odoo...');
        try {
            const activeAccounts = await this.repository.findActiveAccounts();
            for (const account of activeAccounts) {
                await this.odooQueue.add('refresh_session', { accountId: account.id }, {
                    attempts: 5,
                    backoff: {
                        type: 'exponential',
                        delay: 30000,
                    },
                    removeOnComplete: true,
                });
                this.logger.log(`Menambahkan job refresh_session untuk gudang ${account.warehouse.name} ke antrean`);
            }
        }
        catch (err) {
            this.logger.error(`Gagal melakukan penjadwalan harian refresh session Odoo: ${err.message}`);
        }
    }
};
exports.OdooCronService = OdooCronService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_MIDNIGHT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OdooCronService.prototype, "queueDailySessionRefreshes", null);
exports.OdooCronService = OdooCronService = OdooCronService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, bullmq_1.InjectQueue)('odoo_queue')),
    __metadata("design:paramtypes", [odoo_repository_1.OdooRepository,
        bullmq_2.Queue])
], OdooCronService);
//# sourceMappingURL=odoo-cron.service.js.map
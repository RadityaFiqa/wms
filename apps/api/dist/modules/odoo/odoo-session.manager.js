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
var OdooSessionManager_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdooSessionManager = void 0;
const common_1 = require("@nestjs/common");
const odoo_repository_1 = require("./odoo.repository");
const odoo_auth_service_1 = require("./odoo-auth.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
let OdooSessionManager = OdooSessionManager_1 = class OdooSessionManager {
    repository;
    authService;
    auditLogService;
    logger = new common_1.Logger(OdooSessionManager_1.name);
    constructor(repository, authService, auditLogService) {
        this.repository = repository;
        this.authService = authService;
        this.auditLogService = auditLogService;
    }
    async validateAndRefreshSession(accountId) {
        const account = await this.repository.findById(accountId);
        if (!account || !account.isActive) {
            return false;
        }
        const now = new Date();
        const isExpired = !account.sessionExpiredAt || account.sessionExpiredAt <= now;
        const bufferTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
        const isNearExpiry = account.sessionExpiredAt && account.sessionExpiredAt <= bufferTime;
        if (isExpired || isNearExpiry || !account.sessionId) {
            this.logger.log(`Session Odoo untuk gudang ${account.warehouse.name} kedaluwarsa atau kosong. Memulai relogin...`);
            try {
                await this.invalidateSession(account.id);
                await this.authService.establishSession(account.id);
                this.logger.log(`Session Odoo berhasil diperbarui untuk gudang ${account.warehouse.name}`);
                await this.auditLogService.log({
                    action: 'ODOO_SESSION_REFRESH_SUCCESS',
                    details: {
                        odooAccountUuid: account.uuid,
                        warehouseName: account.warehouse.name,
                        message: 'Session Odoo berhasil diperbarui secara otomatis',
                    },
                }).catch((e) => console.error('Failed to write audit log:', e));
                return true;
            }
            catch (err) {
                this.logger.error(`Gagal memperbarui session Odoo untuk gudang ${account.warehouse.name}: ${err.message}`);
                await this.auditLogService.log({
                    action: 'ODOO_SESSION_REFRESH_FAILED',
                    details: {
                        odooAccountUuid: account.uuid,
                        warehouseName: account.warehouse.name,
                        error: err.message,
                    },
                }).catch((e) => console.error('Failed to write audit log:', e));
                if (err.message.includes('Kredensial Odoo')) {
                    await this.repository.updateSessionData(account.id, {
                        sessionId: null,
                        csrfToken: null,
                        sessionExpiredAt: null,
                    });
                }
                throw err;
            }
        }
        return false;
    }
    async invalidateSession(accountId) {
        await this.repository.updateSessionData(accountId, {
            sessionId: null,
            csrfToken: null,
            sessionExpiredAt: null,
        });
    }
    async refreshAllActiveSessions() {
        const activeAccounts = await this.repository.findActiveAccounts();
        const results = {};
        for (const account of activeAccounts) {
            try {
                await this.validateAndRefreshSession(account.id);
                results[account.uuid] = 'SUCCESS';
            }
            catch (err) {
                results[account.uuid] = `FAILED: ${err.message}`;
            }
        }
        return results;
    }
};
exports.OdooSessionManager = OdooSessionManager;
exports.OdooSessionManager = OdooSessionManager = OdooSessionManager_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [odoo_repository_1.OdooRepository,
        odoo_auth_service_1.OdooAuthService,
        audit_log_service_1.AuditLogService])
], OdooSessionManager);
//# sourceMappingURL=odoo-session.manager.js.map
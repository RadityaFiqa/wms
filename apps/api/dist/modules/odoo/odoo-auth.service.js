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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdooAuthService = void 0;
const common_1 = require("@nestjs/common");
const odoo_repository_1 = require("./odoo.repository");
const odoo_client_1 = require("./odoo-client");
const encryption_util_1 = require("../../core/utils/encryption.util");
const audit_log_service_1 = require("../audit-log/audit-log.service");
let OdooAuthService = class OdooAuthService {
    repository;
    client;
    auditLogService;
    constructor(repository, client, auditLogService) {
        this.repository = repository;
        this.client = client;
        this.auditLogService = auditLogService;
    }
    async testConnectionRaw(baseUrl, username, pass) {
        try {
            const { sessionId, csrfToken } = await this.client.authenticate(baseUrl, username, pass);
            return { success: true, sessionId, csrfToken };
        }
        catch (err) {
            throw new common_1.BadRequestException(`Test koneksi gagal: ${err.message}`);
        }
    }
    async testConnectionByUuid(uuid, actorId, ipAddress, userAgent) {
        const account = await this.repository.findByUuid(uuid);
        if (!account) {
            throw new common_1.BadRequestException('Konfigurasi akun Odoo tidak ditemukan');
        }
        try {
            const decryptedPassword = (0, encryption_util_1.decrypt)(account.encryptedPassword);
            const { sessionId, csrfToken } = await this.client.authenticate(account.baseUrl, account.username, decryptedPassword);
            await this.auditLogService.log({
                actorId,
                action: 'ODOO_LOGIN_SUCCESS',
                ipAddress,
                userAgent,
                details: {
                    odooAccountUuid: account.uuid,
                    warehouseName: account.warehouse.name,
                    message: 'Koneksi Odoo berhasil diuji',
                },
            }).catch((e) => console.error('Failed to write Odoo audit log:', e));
            return { success: true, sessionId, csrfToken };
        }
        catch (err) {
            await this.auditLogService.log({
                actorId,
                action: 'ODOO_LOGIN_FAILED',
                ipAddress,
                userAgent,
                details: {
                    odooAccountUuid: account.uuid,
                    warehouseName: account.warehouse.name,
                    error: err.message,
                },
            }).catch((e) => console.error('Failed to write Odoo audit log:', e));
            throw new common_1.BadRequestException(`Test koneksi Odoo gagal: ${err.message}`);
        }
    }
    async establishSession(accountId) {
        const account = await this.prismaFindAccountById(accountId);
        if (!account) {
            throw new Error(`Akun Odoo dengan ID ${accountId} tidak ditemukan`);
        }
        if (!account.isActive) {
            throw new Error(`Akun Odoo untuk gudang ${account.warehouseId} tidak aktif`);
        }
        const decryptedPassword = (0, encryption_util_1.decrypt)(account.encryptedPassword);
        const { sessionId, csrfToken } = await this.client.authenticate(account.baseUrl, account.username, decryptedPassword);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        const updated = await this.repository.updateSessionData(account.id, {
            sessionId,
            csrfToken,
            sessionExpiredAt: expiresAt,
            lastLoginAt: new Date(),
            lastRefreshAt: new Date(),
        });
        return updated;
    }
    async prismaFindAccountById(id) {
        return this.repository.findById(id);
    }
};
exports.OdooAuthService = OdooAuthService;
exports.OdooAuthService = OdooAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [odoo_repository_1.OdooRepository,
        odoo_client_1.OdooClient,
        audit_log_service_1.AuditLogService])
], OdooAuthService);
//# sourceMappingURL=odoo-auth.service.js.map
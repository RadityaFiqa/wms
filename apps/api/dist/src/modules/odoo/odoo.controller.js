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
exports.OdooController = void 0;
const common_1 = require("@nestjs/common");
const odoo_repository_1 = require("./odoo.repository");
const odoo_auth_service_1 = require("./odoo-auth.service");
const odoo_session_manager_1 = require("./odoo-session.manager");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const policies_guard_1 = require("../casl/policies.guard");
const policies_decorator_1 = require("../casl/policies.decorator");
const audit_log_interceptor_1 = require("../audit-log/audit-log.interceptor");
const audit_log_decorator_1 = require("../audit-log/audit-log.decorator");
const schema_1 = require("@bulog-wms/schema");
const zod_validation_pipe_1 = require("../../core/pipes/zod-validation.pipe");
const encryption_util_1 = require("../../core/utils/encryption.util");
let OdooController = class OdooController {
    repository;
    authService;
    sessionManager;
    constructor(repository, authService, sessionManager) {
        this.repository = repository;
        this.authService = authService;
        this.sessionManager = sessionManager;
    }
    async create(body) {
        const existing = await this.repository.findByWarehouseId(body.warehouseId);
        if (existing) {
            throw new common_1.BadRequestException('Konfigurasi Odoo untuk gudang ini sudah ada.');
        }
        const encryptedPassword = (0, encryption_util_1.encrypt)(body.password);
        const account = await this.repository.create({
            warehouseId: body.warehouseId,
            baseUrl: body.baseUrl,
            username: body.username,
            encryptedPassword,
            isActive: true,
        });
        return this.sanitize(account);
    }
    async findAll() {
        const accounts = await this.repository.findAll();
        return accounts.map((acc) => this.sanitize(acc));
    }
    async findOne(uuid) {
        const account = await this.repository.findByUuid(uuid);
        if (!account) {
            throw new common_1.BadRequestException('Konfigurasi Odoo tidak ditemukan.');
        }
        return this.sanitize(account);
    }
    async update(uuid, body) {
        const existing = await this.repository.findByUuid(uuid);
        if (!existing) {
            throw new common_1.BadRequestException('Konfigurasi Odoo tidak ditemukan.');
        }
        if (existing.warehouseId !== body.warehouseId) {
            const warehouseAssignee = await this.repository.findByWarehouseId(body.warehouseId);
            if (warehouseAssignee) {
                throw new common_1.BadRequestException('Gudang tujuan sudah dikonfigurasi dengan akun Odoo lain.');
            }
        }
        const updateData = {
            warehouseId: body.warehouseId,
            baseUrl: body.baseUrl,
            username: body.username,
            isActive: body.isActive,
        };
        if (body.password) {
            updateData.encryptedPassword = (0, encryption_util_1.encrypt)(body.password);
            updateData.sessionId = null;
            updateData.csrfToken = null;
            updateData.sessionExpiredAt = null;
        }
        const updated = await this.repository.update(uuid, updateData);
        return this.sanitize(updated);
    }
    async remove(uuid) {
        const existing = await this.repository.findByUuid(uuid);
        if (!existing) {
            throw new common_1.BadRequestException('Konfigurasi Odoo tidak ditemukan.');
        }
        await this.repository.delete(uuid);
        return { message: 'Konfigurasi Odoo berhasil dihapus.' };
    }
    async testConnectionRaw(body) {
        const { baseUrl, username, password } = body;
        if (!baseUrl || !username || !password) {
            throw new common_1.BadRequestException('Base URL, username, dan password harus diisi.');
        }
        return this.authService.testConnectionRaw(baseUrl, username, password);
    }
    async testConnection(uuid, req) {
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        const ipStr = Array.isArray(ipAddress) ? ipAddress[0] : (ipAddress || undefined);
        return this.authService.testConnectionByUuid(uuid, req.user?.id, ipStr, userAgent);
    }
    async deactivate(uuid) {
        const existing = await this.repository.findByUuid(uuid);
        if (!existing) {
            throw new common_1.BadRequestException('Konfigurasi Odoo tidak ditemukan.');
        }
        const updated = await this.repository.update(uuid, {
            isActive: false,
            sessionId: null,
            csrfToken: null,
            sessionExpiredAt: null,
        });
        return this.sanitize(updated);
    }
    async activate(uuid) {
        const existing = await this.repository.findByUuid(uuid);
        if (!existing) {
            throw new common_1.BadRequestException('Konfigurasi Odoo tidak ditemukan.');
        }
        const updated = await this.repository.update(uuid, { isActive: true });
        return this.sanitize(updated);
    }
    async refreshSession(uuid) {
        const existing = await this.repository.findByUuid(uuid);
        if (!existing) {
            throw new common_1.BadRequestException('Konfigurasi Odoo tidak ditemukan.');
        }
        if (!existing.isActive) {
            throw new common_1.BadRequestException('Akun Odoo tidak aktif. Aktifkan akun terlebih dahulu.');
        }
        await this.sessionManager.invalidateSession(existing.id);
        await this.authService.establishSession(existing.id);
        const updated = await this.repository.findById(existing.id);
        return this.sanitize(updated);
    }
    sanitize(account) {
        if (!account)
            return null;
        const { encryptedPassword, ...sanitized } = account;
        return sanitized;
    }
};
exports.OdooController = OdooController;
__decorate([
    (0, common_1.Post)(),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('create', 'OdooAccount')),
    (0, audit_log_decorator_1.AuditLogAction)('ODOO_CONFIG_CREATE'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(schema_1.CreateOdooAccountSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OdooController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'OdooAccount')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OdooController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':uuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'OdooAccount')),
    __param(0, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OdooController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':uuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'OdooAccount')),
    (0, audit_log_decorator_1.AuditLogAction)('ODOO_CONFIG_UPDATE'),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(schema_1.UpdateOdooAccountSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OdooController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':uuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('delete', 'OdooAccount')),
    (0, audit_log_decorator_1.AuditLogAction)('ODOO_CONFIG_DELETE'),
    __param(0, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OdooController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('test-connection-raw'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('create', 'OdooAccount')),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OdooController.prototype, "testConnectionRaw", null);
__decorate([
    (0, common_1.Post)(':uuid/test-connection'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'OdooAccount')),
    (0, audit_log_decorator_1.AuditLogAction)('ODOO_CONNECTION_TEST'),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OdooController.prototype, "testConnection", null);
__decorate([
    (0, common_1.Post)(':uuid/deactivate'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'OdooAccount')),
    (0, audit_log_decorator_1.AuditLogAction)('ODOO_CONFIG_DEACTIVATE'),
    __param(0, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OdooController.prototype, "deactivate", null);
__decorate([
    (0, common_1.Post)(':uuid/activate'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'OdooAccount')),
    (0, audit_log_decorator_1.AuditLogAction)('ODOO_CONFIG_ACTIVATE'),
    __param(0, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OdooController.prototype, "activate", null);
__decorate([
    (0, common_1.Post)(':uuid/refresh'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'OdooAccount')),
    (0, audit_log_decorator_1.AuditLogAction)('ODOO_SESSION_MANUAL_REFRESH'),
    __param(0, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OdooController.prototype, "refreshSession", null);
exports.OdooController = OdooController = __decorate([
    (0, common_1.Controller)('odoo-accounts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.UseInterceptors)(audit_log_interceptor_1.AuditLogInterceptor),
    __metadata("design:paramtypes", [odoo_repository_1.OdooRepository,
        odoo_auth_service_1.OdooAuthService,
        odoo_session_manager_1.OdooSessionManager])
], OdooController);
//# sourceMappingURL=odoo.controller.js.map
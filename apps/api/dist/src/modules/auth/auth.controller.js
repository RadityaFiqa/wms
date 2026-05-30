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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const throttler_1 = require("@nestjs/throttler");
const zod_validation_pipe_1 = require("../../core/pipes/zod-validation.pipe");
const schema_1 = require("@bulog-wms/schema");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const audit_log_decorator_1 = require("../audit-log/audit-log.decorator");
const common_2 = require("@nestjs/common");
const audit_log_interceptor_1 = require("../audit-log/audit-log.interceptor");
const audit_log_service_1 = require("../audit-log/audit-log.service");
let AuthController = class AuthController {
    authService;
    auditLogService;
    constructor(authService, auditLogService) {
        this.authService = authService;
        this.auditLogService = auditLogService;
    }
    async login(body, req, res) {
        const user = await this.authService.validateUser(body.email, body.password);
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        const ipStr = Array.isArray(ipAddress) ? ipAddress[0] : (ipAddress || undefined);
        if (!user) {
            await this.auditLogService.log({
                action: 'LOGIN_FAILED',
                ipAddress: ipStr,
                userAgent,
                details: { email: body.email },
            }).catch((e) => console.error('Failed to log LOGIN_FAILED audit log:', e));
            throw new common_1.UnauthorizedException('Email atau password salah');
        }
        const result = await this.authService.login(user, ipStr, userAgent);
        res.cookie('refresh_token', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        await this.auditLogService.log({
            actorId: user.id,
            action: 'LOGIN_SUCCESS',
            ipAddress: ipStr,
            userAgent,
        }).catch((e) => console.error('Failed to log LOGIN_SUCCESS audit log:', e));
        return {
            accessToken: result.accessToken,
            user: result.user,
        };
    }
    async refresh(req, res) {
        const refreshToken = req.cookies?.['refresh_token'];
        if (!refreshToken) {
            throw new common_1.UnauthorizedException('Refresh token tidak ditemukan');
        }
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        const ipStr = Array.isArray(ipAddress) ? ipAddress[0] : (ipAddress || undefined);
        const result = await this.authService.refresh(refreshToken, ipStr, userAgent);
        res.cookie('refresh_token', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return {
            accessToken: result.accessToken,
            user: result.user,
        };
    }
    async logout(req, res) {
        const refreshToken = req.cookies?.['refresh_token'];
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        const ipStr = Array.isArray(ipAddress) ? ipAddress[0] : (ipAddress || undefined);
        if (refreshToken) {
            this.authService.logout(refreshToken, req.user.id).then(async (session) => {
                if (session) {
                    await this.auditLogService.log({
                        actorId: req.user.id,
                        action: 'LOGOUT_SUCCESS',
                        ipAddress: ipStr,
                        userAgent,
                    }).catch((e) => console.error('Failed to log LOGOUT_SUCCESS audit log:', e));
                }
            }).catch((e) => {
                console.error('Error during async logout processing:', e);
            });
            res.clearCookie('refresh_token');
        }
        return { message: 'Logout berhasil' };
    }
    async forgotPassword(body) {
        return this.authService.forgotPassword(body.email);
    }
    async resetPassword(body) {
        return this.authService.resetPassword(body.token, body.password);
    }
    async changePassword(req, body) {
        return this.authService.changePassword(req.user.id, {
            oldPass: body.oldPassword,
            newPass: body.newPassword,
        });
    }
    async me(req) {
        const user = req.user;
        return {
            uuid: user.uuid,
            email: user.email,
            name: user.name,
            isFirstLogin: user.isFirstLogin,
            role: user.role.name,
            permissions: user.role.permissions.map((rp) => ({
                action: rp.permission.action,
                subject: rp.permission.subject,
            })),
            warehouse: user.warehouse ? { uuid: user.warehouse.uuid, name: user.warehouse.name } : null,
            accessibleWarehouses: await this.authService.getAccessibleWarehouses(user.id, user.role.name),
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.UseGuards)(throttler_1.ThrottlerGuard),
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(schema_1.LoginSchema))),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('refresh'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('forgot-password'),
    (0, common_1.UseGuards)(throttler_1.ThrottlerGuard),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(schema_1.ForgotPasswordSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(schema_1.ResetPasswordSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('change-password'),
    (0, audit_log_decorator_1.AuditLogAction)('USER_PASSWORD_CHANGE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(schema_1.ChangePasswordSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    (0, common_2.UseInterceptors)(audit_log_interceptor_1.AuditLogInterceptor),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        audit_log_service_1.AuditLogService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map
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
exports.AuditLogInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const operators_1 = require("rxjs/operators");
const audit_log_service_1 = require("./audit-log.service");
const audit_log_decorator_1 = require("./audit-log.decorator");
let AuditLogInterceptor = class AuditLogInterceptor {
    reflector;
    auditLogService;
    constructor(reflector, auditLogService) {
        this.reflector = reflector;
        this.auditLogService = auditLogService;
    }
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const action = this.reflector.get(audit_log_decorator_1.AUDIT_ACTION_KEY, context.getHandler());
        if (!action) {
            return next.handle();
        }
        return next.handle().pipe((0, operators_1.tap)({
            next: (data) => {
                const user = request.user;
                const ipAddress = request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress;
                const userAgent = request.headers['user-agent'];
                let targetId = undefined;
                if (request.params.id) {
                    const paramId = parseInt(request.params.id);
                    if (!isNaN(paramId))
                        targetId = paramId;
                }
                if (data && typeof data === 'object' && data.id) {
                    targetId = data.id;
                }
                const sanitizedBody = request.body ? { ...request.body } : undefined;
                if (sanitizedBody) {
                    const keysToRedact = ['password', 'confirmPassword', 'oldPassword', 'newPassword', 'confirmNewPassword', 'token'];
                    for (const key of keysToRedact) {
                        if (sanitizedBody[key])
                            sanitizedBody[key] = '***REDACTED***';
                    }
                }
                this.auditLogService.log({
                    actorId: user?.id,
                    targetId: targetId,
                    action,
                    ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : (ipAddress || null),
                    userAgent,
                    details: {
                        body: sanitizedBody,
                        params: request.params,
                        query: request.query,
                    },
                }).catch((err) => console.error('Failed to save audit log in interceptor:', err));
            },
        }));
    }
};
exports.AuditLogInterceptor = AuditLogInterceptor;
exports.AuditLogInterceptor = AuditLogInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        audit_log_service_1.AuditLogService])
], AuditLogInterceptor);
//# sourceMappingURL=audit-log.interceptor.js.map
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
exports.UserController = void 0;
const common_1 = require("@nestjs/common");
const user_service_1 = require("./user.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const warehouse_guard_1 = require("../../core/warehouse-context/warehouse.guard");
const policies_guard_1 = require("../casl/policies.guard");
const policies_decorator_1 = require("../casl/policies.decorator");
const audit_log_interceptor_1 = require("../audit-log/audit-log.interceptor");
const audit_log_decorator_1 = require("../audit-log/audit-log.decorator");
const schema_1 = require("@bulog-wms/schema");
const zod_validation_pipe_1 = require("../../core/pipes/zod-validation.pipe");
let UserController = class UserController {
    userService;
    constructor(userService) {
        this.userService = userService;
    }
    async create(req, body) {
        return this.userService.create(body, req.user);
    }
    async findAll(req, search, roleId, isActive, page, limit) {
        return this.userService.findAll({ search, roleId, isActive, page, limit }, req.user);
    }
    async findOne(uuid, req) {
        return this.userService.findByUuid(uuid, req.user);
    }
    async update(uuid, body, req) {
        return this.userService.update(uuid, body, req.user);
    }
    async deactivate(uuid, req) {
        return this.userService.toggleStatus(uuid, false, req.user);
    }
    async activate(uuid, req) {
        return this.userService.toggleStatus(uuid, true, req.user);
    }
    async resetPassword(uuid, req) {
        return this.userService.adminResetPassword(uuid, req.user);
    }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.Post)(),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('create', 'User')),
    (0, audit_log_decorator_1.AuditLogAction)('USER_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(schema_1.CreateUserSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'User')),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('roleId')),
    __param(3, (0, common_1.Query)('isActive')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number, String, Number, Number]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':uuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'User')),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':uuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'User')),
    (0, audit_log_decorator_1.AuditLogAction)('USER_UPDATE'),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(schema_1.UpdateUserSchema))),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':uuid/deactivate'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'User')),
    (0, audit_log_decorator_1.AuditLogAction)('USER_DEACTIVATE'),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "deactivate", null);
__decorate([
    (0, common_1.Post)(':uuid/activate'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'User')),
    (0, audit_log_decorator_1.AuditLogAction)('USER_REACTIVATE'),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "activate", null);
__decorate([
    (0, common_1.Post)(':uuid/reset-password'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'User')),
    (0, audit_log_decorator_1.AuditLogAction)('USER_PASSWORD_RESET'),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "resetPassword", null);
exports.UserController = UserController = __decorate([
    (0, common_1.Controller)('users'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, warehouse_guard_1.WarehouseGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.UseInterceptors)(audit_log_interceptor_1.AuditLogInterceptor),
    __metadata("design:paramtypes", [user_service_1.UserService])
], UserController);
//# sourceMappingURL=user.controller.js.map
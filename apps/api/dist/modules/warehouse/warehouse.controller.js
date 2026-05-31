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
exports.WarehouseController = void 0;
const common_1 = require("@nestjs/common");
const warehouse_service_1 = require("./warehouse.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const policies_guard_1 = require("../casl/policies.guard");
const policies_decorator_1 = require("../casl/policies.decorator");
const audit_log_interceptor_1 = require("../audit-log/audit-log.interceptor");
const audit_log_decorator_1 = require("../audit-log/audit-log.decorator");
const schema_1 = require("@bulog-wms/schema");
const zod_validation_pipe_1 = require("../../core/pipes/zod-validation.pipe");
const prisma_service_1 = require("../../core/prisma/prisma.service");
let WarehouseController = class WarehouseController {
    service;
    prisma;
    constructor(service, prisma) {
        this.service = service;
        this.prisma = prisma;
    }
    async create(req, body) {
        if (req.user?.role?.name !== 'SUPER_ADMIN') {
            throw new common_1.ForbiddenException('Akses ditolak. Hanya Super Admin yang dapat membuat gudang.');
        }
        return this.service.create(body);
    }
    async findAll(req, search, page, limit) {
        const user = req.user;
        const roleName = user.role?.name || user.role;
        let allowedIds = undefined;
        let activeOnly = false;
        if (roleName !== 'SUPER_ADMIN') {
            activeOnly = true;
            const accesses = await this.prisma.warehouseAccess.findMany({
                where: { userId: user.id },
                select: { warehouseId: true },
            });
            allowedIds = accesses.map((a) => a.warehouseId);
        }
        return this.service.findAll({
            search,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            activeOnly,
            allowedIds,
        });
    }
    async findOne(uuid, req) {
        if (req.user?.role?.name !== 'SUPER_ADMIN') {
            throw new common_1.ForbiddenException('Akses ditolak. Hanya Super Admin yang dapat melihat detail manajemen gudang.');
        }
        return this.service.findByUuid(uuid);
    }
    async update(uuid, req, body) {
        if (req.user?.role?.name !== 'SUPER_ADMIN') {
            throw new common_1.ForbiddenException('Akses ditolak. Hanya Super Admin yang dapat memperbarui gudang.');
        }
        return this.service.update(uuid, body);
    }
    async remove(uuid, req) {
        if (req.user?.role?.name !== 'SUPER_ADMIN') {
            throw new common_1.ForbiddenException('Akses ditolak. Hanya Super Admin yang dapat menonaktifkan gudang.');
        }
        return this.service.remove(uuid);
    }
};
exports.WarehouseController = WarehouseController;
__decorate([
    (0, common_1.Post)(),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('create', 'Warehouse')),
    (0, audit_log_decorator_1.AuditLogAction)('WAREHOUSE_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(schema_1.CreateWarehouseSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Warehouse')),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':uuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Warehouse')),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':uuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'Warehouse')),
    (0, audit_log_decorator_1.AuditLogAction)('WAREHOUSE_UPDATE'),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(schema_1.UpdateWarehouseSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':uuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('delete', 'Warehouse')),
    (0, audit_log_decorator_1.AuditLogAction)('WAREHOUSE_DEACTIVATE'),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "remove", null);
exports.WarehouseController = WarehouseController = __decorate([
    (0, common_1.Controller)('warehouses'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.UseInterceptors)(audit_log_interceptor_1.AuditLogInterceptor),
    __metadata("design:paramtypes", [warehouse_service_1.WarehouseService,
        prisma_service_1.PrismaService])
], WarehouseController);
//# sourceMappingURL=warehouse.controller.js.map
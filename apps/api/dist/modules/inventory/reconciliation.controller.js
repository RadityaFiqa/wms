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
exports.ReconciliationController = void 0;
const common_1 = require("@nestjs/common");
const reconciliation_service_1 = require("./reconciliation.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const warehouse_guard_1 = require("../../core/warehouse-context/warehouse.guard");
const policies_guard_1 = require("../casl/policies.guard");
const policies_decorator_1 = require("../casl/policies.decorator");
const audit_log_interceptor_1 = require("../audit-log/audit-log.interceptor");
const warehouse_context_service_1 = require("../../core/warehouse-context/warehouse-context.service");
let ReconciliationController = class ReconciliationController {
    service;
    warehouseContext;
    constructor(service, warehouseContext) {
        this.service = service;
        this.warehouseContext = warehouseContext;
    }
    async getList() {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.service.getReconciliationList(warehouseId);
    }
    async getDetail(uuid) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.service.getReconciliationDetail(warehouseId, uuid);
    }
};
exports.ReconciliationController = ReconciliationController;
__decorate([
    (0, common_1.Get)(),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Reconciliation')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReconciliationController.prototype, "getList", null);
__decorate([
    (0, common_1.Get)(':uuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Reconciliation')),
    __param(0, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReconciliationController.prototype, "getDetail", null);
exports.ReconciliationController = ReconciliationController = __decorate([
    (0, common_1.Controller)('inventory/reconciliation'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, warehouse_guard_1.WarehouseGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.UseInterceptors)(audit_log_interceptor_1.AuditLogInterceptor),
    __metadata("design:paramtypes", [reconciliation_service_1.ReconciliationService,
        warehouse_context_service_1.WarehouseContextService])
], ReconciliationController);
//# sourceMappingURL=reconciliation.controller.js.map
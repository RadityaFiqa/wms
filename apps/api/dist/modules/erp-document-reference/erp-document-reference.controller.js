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
exports.ErpDocumentReferenceController = void 0;
const common_1 = require("@nestjs/common");
const erp_document_reference_service_1 = require("./erp-document-reference.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const warehouse_guard_1 = require("../../core/warehouse-context/warehouse.guard");
const policies_guard_1 = require("../casl/policies.guard");
const policies_decorator_1 = require("../casl/policies.decorator");
const audit_log_interceptor_1 = require("../audit-log/audit-log.interceptor");
const audit_log_decorator_1 = require("../audit-log/audit-log.decorator");
const warehouse_context_service_1 = require("../../core/warehouse-context/warehouse-context.service");
let ErpDocumentReferenceController = class ErpDocumentReferenceController {
    service;
    warehouseContext;
    constructor(service, warehouseContext) {
        this.service = service;
        this.warehouseContext = warehouseContext;
    }
    async findAll(search, page, limit, type, state, startDate, endDate, refFax, gateOperationUuid) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.service.findAll(warehouseId, {
            search,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            type,
            state,
            startDate,
            endDate,
            refFax,
            gateOperationUuid,
        });
    }
    async findUniquePartners() {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.service.findUniquePartners(warehouseId);
    }
    async findOne(uuid) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.service.findOne(warehouseId, uuid);
    }
    async getSyncStatus() {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.service.getSyncStatus(warehouseId);
    }
    async sync(req) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        const triggeredBy = req.user?.email || 'System';
        return this.service.triggerSync(warehouseId, triggeredBy);
    }
    async forceSync(idOrUuid, req) {
        if (req.user?.role?.name !== 'SUPER_ADMIN') {
            throw new common_1.ForbiddenException('Akses ditolak. Hanya Super Admin yang dapat mensinkronkan paksa dokumen ERP.');
        }
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        const triggeredBy = req.user?.email || 'System';
        return this.service.forceSyncDocument(warehouseId, idOrUuid, triggeredBy);
    }
};
exports.ErpDocumentReferenceController = ErpDocumentReferenceController;
__decorate([
    (0, common_1.Get)(),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Inventory')),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('type')),
    __param(4, (0, common_1.Query)('state')),
    __param(5, (0, common_1.Query)('startDate')),
    __param(6, (0, common_1.Query)('endDate')),
    __param(7, (0, common_1.Query)('refFax')),
    __param(8, (0, common_1.Query)('gateOperationUuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ErpDocumentReferenceController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('partners'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Inventory')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ErpDocumentReferenceController.prototype, "findUniquePartners", null);
__decorate([
    (0, common_1.Get)(':uuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Inventory')),
    __param(0, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ErpDocumentReferenceController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('sync/status'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Inventory')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ErpDocumentReferenceController.prototype, "getSyncStatus", null);
__decorate([
    (0, common_1.Post)('sync'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'Inventory')),
    (0, audit_log_decorator_1.AuditLogAction)('ERP_DOCUMENT_SYNC'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ErpDocumentReferenceController.prototype, "sync", null);
__decorate([
    (0, common_1.Post)(':id/force-sync'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'Inventory')),
    (0, audit_log_decorator_1.AuditLogAction)('ERP_DOCUMENT_FORCE_SYNC'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ErpDocumentReferenceController.prototype, "forceSync", null);
exports.ErpDocumentReferenceController = ErpDocumentReferenceController = __decorate([
    (0, common_1.Controller)('erp-document-references'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, warehouse_guard_1.WarehouseGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.UseInterceptors)(audit_log_interceptor_1.AuditLogInterceptor),
    __metadata("design:paramtypes", [erp_document_reference_service_1.ErpDocumentReferenceService,
        warehouse_context_service_1.WarehouseContextService])
], ErpDocumentReferenceController);
//# sourceMappingURL=erp-document-reference.controller.js.map
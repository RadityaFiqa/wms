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
exports.StockOpnameController = void 0;
const common_1 = require("@nestjs/common");
const stock_opname_service_1 = require("./stock-opname.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const warehouse_guard_1 = require("../../core/warehouse-context/warehouse.guard");
const policies_guard_1 = require("../casl/policies.guard");
const policies_decorator_1 = require("../casl/policies.decorator");
const audit_log_interceptor_1 = require("../audit-log/audit-log.interceptor");
const audit_log_decorator_1 = require("../audit-log/audit-log.decorator");
const warehouse_context_service_1 = require("../../core/warehouse-context/warehouse-context.service");
let StockOpnameController = class StockOpnameController {
    service;
    warehouseContext;
    constructor(service, warehouseContext) {
        this.service = service;
        this.warehouseContext = warehouseContext;
    }
    async getList(search, status, createdById, startDate, endDate, page, limit) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.service.getList(warehouseId, {
            search,
            status,
            createdById,
            startDate,
            endDate,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }
    async getDetail(uuid) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.service.getDetail(warehouseId, uuid);
    }
    async create(req, notes) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        const createdById = req.user.id;
        return this.service.createStockOpname(warehouseId, createdById, notes);
    }
    async update(uuid, body) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.service.updateStockOpname(warehouseId, uuid, body);
    }
    async submit(uuid) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.service.submitStockOpname(warehouseId, uuid);
    }
    async exportCountingSheet(uuid, res) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        const pdfBuffer = await this.service.generateCountingSheetPdf(warehouseId, uuid);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=counting-sheet-${uuid}-${Date.now()}.pdf`,
            'Content-Length': pdfBuffer.length,
        });
        res.end(pdfBuffer);
    }
    async exportResultPdf(uuid, res) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        const pdfBuffer = await this.service.generateResultPdf(warehouseId, uuid);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=stock-opname-report-${uuid}-${Date.now()}.pdf`,
            'Content-Length': pdfBuffer.length,
        });
        res.end(pdfBuffer);
    }
};
exports.StockOpnameController = StockOpnameController;
__decorate([
    (0, common_1.Get)(),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'StockOpname')),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('createdById')),
    __param(3, (0, common_1.Query)('startDate')),
    __param(4, (0, common_1.Query)('endDate')),
    __param(5, (0, common_1.Query)('page')),
    __param(6, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], StockOpnameController.prototype, "getList", null);
__decorate([
    (0, common_1.Get)(':uuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'StockOpname')),
    __param(0, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StockOpnameController.prototype, "getDetail", null);
__decorate([
    (0, common_1.Post)(),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('create', 'StockOpname')),
    (0, audit_log_decorator_1.AuditLogAction)('STOCK_OPNAME_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('notes')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], StockOpnameController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':uuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'StockOpname')),
    (0, audit_log_decorator_1.AuditLogAction)('STOCK_OPNAME_UPDATE_DRAFT'),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StockOpnameController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':uuid/submit'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'StockOpname')),
    (0, audit_log_decorator_1.AuditLogAction)('STOCK_OPNAME_SUBMIT'),
    __param(0, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StockOpnameController.prototype, "submit", null);
__decorate([
    (0, common_1.Get)(':uuid/counting-sheet/pdf'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'StockOpname')),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StockOpnameController.prototype, "exportCountingSheet", null);
__decorate([
    (0, common_1.Get)(':uuid/export/pdf'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'StockOpname')),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StockOpnameController.prototype, "exportResultPdf", null);
exports.StockOpnameController = StockOpnameController = __decorate([
    (0, common_1.Controller)('stock-opname'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, warehouse_guard_1.WarehouseGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.UseInterceptors)(audit_log_interceptor_1.AuditLogInterceptor),
    __metadata("design:paramtypes", [stock_opname_service_1.StockOpnameService,
        warehouse_context_service_1.WarehouseContextService])
], StockOpnameController);
//# sourceMappingURL=stock-opname.controller.js.map
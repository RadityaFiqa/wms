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
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const reports_service_1 = require("./reports.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const warehouse_guard_1 = require("../../core/warehouse-context/warehouse.guard");
const policies_guard_1 = require("../casl/policies.guard");
const policies_decorator_1 = require("../casl/policies.decorator");
const audit_log_interceptor_1 = require("../audit-log/audit-log.interceptor");
const warehouse_context_service_1 = require("../../core/warehouse-context/warehouse-context.service");
let ReportsController = class ReportsController {
    service;
    warehouseContext;
    constructor(service, warehouseContext) {
        this.service = service;
        this.warehouseContext = warehouseContext;
    }
    async getReport(startDate, endDate, productId, category) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.service.getDailyStockMovementReport(warehouseId, {
            startDate,
            endDate,
            productId,
            category,
        });
    }
    async getDetail(date, productUuid) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.service.getDailyStockMovementDetail(warehouseId, {
            date,
            productUuid,
        });
    }
    async exportPdf(startDate, endDate, productId, category, res) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        const pdfBuffer = await this.service.generatePdfReport(warehouseId, {
            startDate,
            endDate,
            productId,
            category,
        });
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=stock-movement-report-${Date.now()}.pdf`,
            'Content-Length': pdfBuffer.length,
        });
        res.end(pdfBuffer);
    }
    async exportCsv(startDate, endDate, productId, category, res) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        const csvContent = await this.service.generateCsvReport(warehouseId, {
            startDate,
            endDate,
            productId,
            category,
        });
        res.set({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename=stock-movement-report-${Date.now()}.csv`,
        });
        res.send(Buffer.from(csvContent));
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Get)(),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Report')),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __param(2, (0, common_1.Query)('productId')),
    __param(3, (0, common_1.Query)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getReport", null);
__decorate([
    (0, common_1.Get)('detail'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Report')),
    __param(0, (0, common_1.Query)('date')),
    __param(1, (0, common_1.Query)('productUuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getDetail", null);
__decorate([
    (0, common_1.Get)('export/pdf'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Report')),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __param(2, (0, common_1.Query)('productId')),
    __param(3, (0, common_1.Query)('category')),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "exportPdf", null);
__decorate([
    (0, common_1.Get)('export/csv'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Report')),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __param(2, (0, common_1.Query)('productId')),
    __param(3, (0, common_1.Query)('category')),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "exportCsv", null);
exports.ReportsController = ReportsController = __decorate([
    (0, common_1.Controller)('reports/stock-movement'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, warehouse_guard_1.WarehouseGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.UseInterceptors)(audit_log_interceptor_1.AuditLogInterceptor),
    __metadata("design:paramtypes", [reports_service_1.ReportsService,
        warehouse_context_service_1.WarehouseContextService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map
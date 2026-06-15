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
exports.InventoryController = void 0;
const common_1 = require("@nestjs/common");
const inventory_service_1 = require("./inventory.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const warehouse_guard_1 = require("../../core/warehouse-context/warehouse.guard");
const policies_guard_1 = require("../casl/policies.guard");
const policies_decorator_1 = require("../casl/policies.decorator");
const audit_log_interceptor_1 = require("../audit-log/audit-log.interceptor");
const audit_log_decorator_1 = require("../audit-log/audit-log.decorator");
const warehouse_context_service_1 = require("../../core/warehouse-context/warehouse-context.service");
const prisma_service_1 = require("../../core/prisma/prisma.service");
let InventoryController = class InventoryController {
    service;
    warehouseContext;
    prisma;
    constructor(service, warehouseContext, prisma) {
        this.service = service;
        this.warehouseContext = warehouseContext;
        this.prisma = prisma;
    }
    async findAll(search, page, limit) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.service.findAll(warehouseId, {
            search,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }
    async findAllProducts(search) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        const where = {
            warehouseId,
        };
        if (search) {
            where.AND = [
                {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { sku: { contains: search, mode: 'insensitive' } },
                    ],
                },
            ];
        }
        return this.prisma.inventory.findMany({
            where,
            orderBy: { name: 'asc' },
        });
    }
    async getSyncStatus() {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        const account = await this.prismaFindAccountByWarehouseId(warehouseId);
        if (!account) {
            return {
                lastSyncAt: null,
                lastSyncStatus: null,
                lastSyncError: null,
                lastSyncBy: null,
                lastSyncCount: null,
            };
        }
        return {
            lastSyncAt: account.lastSyncAt,
            lastSyncStatus: account.lastSyncStatus,
            lastSyncError: account.lastSyncError,
            lastSyncBy: account.lastSyncBy,
            lastSyncCount: account.lastSyncCount,
        };
    }
    async exportPdf(res, search) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        const pdfBuffer = await this.service.generatePdfReport(warehouseId, { search });
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=inventory-report-${Date.now()}.pdf`,
            'Content-Length': pdfBuffer.length,
        });
        res.end(pdfBuffer);
    }
    async findAllLocations() {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.prisma.location.findMany({
            where: { warehouseId },
            orderBy: { displayName: 'asc' },
        });
    }
    async findDetail(uuid) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        return this.service.findDetail(warehouseId, uuid);
    }
    async sync(req) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Warehouse context (header x-warehouse-id) diperlukan.');
        }
        const triggeredBy = req.user?.email || 'System';
        return this.service.syncOdooInventory(warehouseId, triggeredBy);
    }
    async prismaFindAccountByWarehouseId(warehouseId) {
        return this.prisma.odooAccount.findUnique({
            where: { warehouseId },
        });
    }
};
exports.InventoryController = InventoryController;
__decorate([
    (0, common_1.Get)(),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Inventory')),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('products'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'GateOperation') || ability.can('read', 'Inventory')),
    __param(0, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "findAllProducts", null);
__decorate([
    (0, common_1.Get)('sync/status'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Inventory')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getSyncStatus", null);
__decorate([
    (0, common_1.Get)('export/pdf'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Inventory')),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "exportPdf", null);
__decorate([
    (0, common_1.Get)('locations'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Inventory')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "findAllLocations", null);
__decorate([
    (0, common_1.Get)(':uuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'Inventory')),
    __param(0, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "findDetail", null);
__decorate([
    (0, common_1.Post)('sync'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'Inventory')),
    (0, audit_log_decorator_1.AuditLogAction)('INVENTORY_SYNC'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "sync", null);
exports.InventoryController = InventoryController = __decorate([
    (0, common_1.Controller)('inventory'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, warehouse_guard_1.WarehouseGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.UseInterceptors)(audit_log_interceptor_1.AuditLogInterceptor),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService,
        warehouse_context_service_1.WarehouseContextService,
        prisma_service_1.PrismaService])
], InventoryController);
//# sourceMappingURL=inventory.controller.js.map
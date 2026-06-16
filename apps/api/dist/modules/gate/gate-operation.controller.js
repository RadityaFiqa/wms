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
exports.GateOperationController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const warehouse_guard_1 = require("../../core/warehouse-context/warehouse.guard");
const policies_guard_1 = require("../casl/policies.guard");
const policies_decorator_1 = require("../casl/policies.decorator");
const audit_log_interceptor_1 = require("../audit-log/audit-log.interceptor");
const audit_log_decorator_1 = require("../audit-log/audit-log.decorator");
const zod_validation_pipe_1 = require("../../core/pipes/zod-validation.pipe");
const schema_1 = require("@bulog-wms/schema");
const gate_service_1 = require("./gate.service");
let GateOperationController = class GateOperationController {
    service;
    constructor(service) {
        this.service = service;
    }
    async create(req, body) {
        const userId = req.user?.id;
        return this.service.createGateOperation(userId, body);
    }
    async findAll(search, cardType, status, startDate, endDate, page, limit) {
        return this.service.getGateOperations({
            search,
            cardType,
            status,
            startDate,
            endDate,
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
        });
    }
    async getClientHistory(clientPartner, req) {
        const warehouseId = this.service['warehouseContext'].getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Konteks warehouse (header x-warehouse-id) diperlukan.');
        }
        return this.service.getClientHistory(warehouseId, clientPartner);
    }
    async addCargoItem(uuid, req, body) {
        const user = req.user;
        if (user.role?.name !== 'SUPER_ADMIN' &&
            user.role?.name !== 'WAREHOUSE_ADMIN') {
            throw new common_1.ForbiddenException('Hanya Admin yang dapat menambah barang muatan.');
        }
        const result = await this.service.addCargoItem(uuid, body);
        req.auditDetails = {
            inventory: {
                sku: result.inventory?.sku,
                name: result.inventory?.name,
                uom: result.inventory?.uom,
            },
            quantity: result.quantity,
            notes: result.notes,
            quantId: result.quantId,
            locationId: result.locationId,
        };
        return result;
    }
    async updateCargoItem(cargoUuid, req, body) {
        const user = req.user;
        if (user.role?.name !== 'SUPER_ADMIN' &&
            user.role?.name !== 'WAREHOUSE_ADMIN') {
            throw new common_1.ForbiddenException('Hanya Admin yang dapat mengubah barang muatan.');
        }
        const result = await this.service.updateCargoItem(cargoUuid, body);
        req.auditDetails = {
            inventory: {
                sku: result.inventory?.sku,
                name: result.inventory?.name,
                uom: result.inventory?.uom,
            },
            quantity: result.quantity,
            notes: result.notes,
            quantId: result.quantId,
            locationId: result.locationId,
        };
        return result;
    }
    async deleteCargoItem(cargoUuid, req) {
        const user = req.user;
        if (user.role?.name !== 'SUPER_ADMIN' &&
            user.role?.name !== 'WAREHOUSE_ADMIN') {
            throw new common_1.ForbiddenException('Hanya Admin yang dapat menghapus barang muatan.');
        }
        const result = await this.service.deleteCargoItem(cargoUuid);
        req.auditDetails = {
            deletedItem: {
                sku: result.deletedItem?.inventory?.sku,
                name: result.deletedItem?.inventory?.name,
                uom: result.deletedItem?.inventory?.uom,
                quantity: result.deletedItem?.quantity,
                notes: result.deletedItem?.notes,
            },
        };
        return result;
    }
    async getDeliveryOrderPdf(id, res) {
        const pdfBuffer = await this.service.generateDeliveryOrderPdf(id);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="surat-jalan-${id}.pdf"`,
            'Content-Length': pdfBuffer.length,
        });
        res.end(pdfBuffer);
    }
    async getDeliveryOrderPreview(id, res) {
        const html = await this.service.generateDeliveryOrderHtml(id);
        res.set({
            'Content-Type': 'text/html',
        });
        res.end(html);
    }
    async findOne(uuid) {
        return this.service.getGateOperationByUuid(uuid);
    }
};
exports.GateOperationController = GateOperationController;
__decorate([
    (0, common_1.Post)(),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('create', 'GateOperation')),
    (0, audit_log_decorator_1.AuditLogAction)('GATE_OPERATION_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(schema_1.CreateGateOperationSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GateOperationController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'GateOperation')),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('cardType')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('startDate')),
    __param(4, (0, common_1.Query)('endDate')),
    __param(5, (0, common_1.Query)('page')),
    __param(6, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], GateOperationController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('client-history'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'GateOperation')),
    __param(0, (0, common_1.Query)('clientPartner')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], GateOperationController.prototype, "getClientHistory", null);
__decorate([
    (0, common_1.Post)(':uuid/cargo'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'GateOperation')),
    (0, audit_log_decorator_1.AuditLogAction)('GATE_OPERATION_CARGO_ADD'),
    __param(0, (0, common_1.Param)('uuid')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], GateOperationController.prototype, "addCargoItem", null);
__decorate([
    (0, common_1.Put)('cargo/:cargoUuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'GateOperation')),
    (0, audit_log_decorator_1.AuditLogAction)('GATE_OPERATION_CARGO_UPDATE'),
    __param(0, (0, common_1.Param)('cargoUuid')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], GateOperationController.prototype, "updateCargoItem", null);
__decorate([
    (0, common_1.Delete)('cargo/:cargoUuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('update', 'GateOperation')),
    (0, audit_log_decorator_1.AuditLogAction)('GATE_OPERATION_CARGO_DELETE'),
    __param(0, (0, common_1.Param)('cargoUuid')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], GateOperationController.prototype, "deleteCargoItem", null);
__decorate([
    (0, common_1.Get)(':id/delivery-order'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'GateOperation')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], GateOperationController.prototype, "getDeliveryOrderPdf", null);
__decorate([
    (0, common_1.Get)(':id/delivery-order-preview'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'GateOperation')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], GateOperationController.prototype, "getDeliveryOrderPreview", null);
__decorate([
    (0, common_1.Get)(':uuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('read', 'GateOperation')),
    __param(0, (0, common_1.Param)('uuid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GateOperationController.prototype, "findOne", null);
exports.GateOperationController = GateOperationController = __decorate([
    (0, common_1.Controller)('gate-operations'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, warehouse_guard_1.WarehouseGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.UseInterceptors)(audit_log_interceptor_1.AuditLogInterceptor),
    __metadata("design:paramtypes", [gate_service_1.GateService])
], GateOperationController);
//# sourceMappingURL=gate-operation.controller.js.map
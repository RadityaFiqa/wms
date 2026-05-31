"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErpDocumentReferenceModule = void 0;
const common_1 = require("@nestjs/common");
const erp_document_reference_service_1 = require("./erp-document-reference.service");
const erp_document_reference_controller_1 = require("./erp-document-reference.controller");
const prisma_module_1 = require("../../core/prisma/prisma.module");
const odoo_module_1 = require("../odoo/odoo.module");
const warehouse_context_module_1 = require("../../core/warehouse-context/warehouse-context.module");
const audit_log_module_1 = require("../audit-log/audit-log.module");
let ErpDocumentReferenceModule = class ErpDocumentReferenceModule {
};
exports.ErpDocumentReferenceModule = ErpDocumentReferenceModule;
exports.ErpDocumentReferenceModule = ErpDocumentReferenceModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            odoo_module_1.OdooModule,
            warehouse_context_module_1.WarehouseContextModule,
            audit_log_module_1.AuditLogModule,
        ],
        controllers: [erp_document_reference_controller_1.ErpDocumentReferenceController],
        providers: [erp_document_reference_service_1.ErpDocumentReferenceService],
        exports: [erp_document_reference_service_1.ErpDocumentReferenceService],
    })
], ErpDocumentReferenceModule);
//# sourceMappingURL=erp-document-reference.module.js.map
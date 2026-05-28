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
exports.GateVerificationController = void 0;
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
let GateVerificationController = class GateVerificationController {
    service;
    constructor(service) {
        this.service = service;
    }
    async verify(operationUuid, req, body) {
        const userId = req.user?.id;
        return this.service.verifyGateOperation(operationUuid, userId, body);
    }
};
exports.GateVerificationController = GateVerificationController;
__decorate([
    (0, common_1.Post)(':operationUuid'),
    (0, policies_decorator_1.CheckPolicies)((ability) => ability.can('create', 'GateVerification')),
    (0, audit_log_decorator_1.AuditLogAction)('GATE_OPERATION_VERIFY'),
    __param(0, (0, common_1.Param)('operationUuid')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(schema_1.CreateGateVerificationSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], GateVerificationController.prototype, "verify", null);
exports.GateVerificationController = GateVerificationController = __decorate([
    (0, common_1.Controller)('gate-verifications'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, warehouse_guard_1.WarehouseGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.UseInterceptors)(audit_log_interceptor_1.AuditLogInterceptor),
    __metadata("design:paramtypes", [gate_service_1.GateService])
], GateVerificationController);
//# sourceMappingURL=gate-verification.controller.js.map
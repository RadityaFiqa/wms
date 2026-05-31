"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("@nestjs/bullmq");
const schedule_1 = require("@nestjs/schedule");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./core/prisma/prisma.module");
const logger_module_1 = require("./core/logger/logger.module");
const redis_module_1 = require("./core/redis/redis.module");
const auth_module_1 = require("./modules/auth/auth.module");
const user_module_1 = require("./modules/user/user.module");
const role_module_1 = require("./modules/role/role.module");
const casl_module_1 = require("./modules/casl/casl.module");
const audit_log_module_1 = require("./modules/audit-log/audit-log.module");
const email_module_1 = require("./modules/email/email.module");
const odoo_module_1 = require("./modules/odoo/odoo.module");
const inventory_module_1 = require("./modules/inventory/inventory.module");
const warehouse_context_module_1 = require("./core/warehouse-context/warehouse-context.module");
const storage_module_1 = require("./modules/storage/storage.module");
const gate_module_1 = require("./modules/gate/gate.module");
const erp_document_reference_module_1 = require("./modules/erp-document-reference/erp-document-reference.module");
const warehouse_module_1 = require("./modules/warehouse/warehouse.module");
const reports_module_1 = require("./modules/reports/reports.module");
const core_1 = require("@nestjs/core");
const warehouse_interceptor_1 = require("./core/warehouse-context/warehouse.interceptor");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
            }),
            bullmq_1.BullModule.forRoot({
                connection: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379'),
                },
            }),
            schedule_1.ScheduleModule.forRoot(),
            logger_module_1.LoggerModule,
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            warehouse_context_module_1.WarehouseContextModule,
            casl_module_1.CaslModule,
            email_module_1.EmailModule,
            auth_module_1.AuthModule,
            user_module_1.UserModule,
            role_module_1.RoleModule,
            audit_log_module_1.AuditLogModule,
            odoo_module_1.OdooModule,
            inventory_module_1.InventoryModule,
            storage_module_1.StorageModule,
            gate_module_1.GateModule,
            erp_document_reference_module_1.ErpDocumentReferenceModule,
            warehouse_module_1.WarehouseModule,
            reports_module_1.ReportsModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: warehouse_interceptor_1.WarehouseInterceptor,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
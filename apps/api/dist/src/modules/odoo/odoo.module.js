"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdooModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const odoo_controller_1 = require("./odoo.controller");
const odoo_repository_1 = require("./odoo.repository");
const odoo_client_1 = require("./odoo-client");
const odoo_auth_service_1 = require("./odoo-auth.service");
const odoo_session_manager_1 = require("./odoo-session.manager");
const odoo_queue_processor_1 = require("./odoo-queue.processor");
const odoo_cron_service_1 = require("./odoo-cron.service");
let OdooModule = class OdooModule {
};
exports.OdooModule = OdooModule;
exports.OdooModule = OdooModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.registerQueue({
                name: 'odoo_queue',
            }),
        ],
        controllers: [odoo_controller_1.OdooController],
        providers: [
            odoo_repository_1.OdooRepository,
            odoo_client_1.OdooClient,
            odoo_auth_service_1.OdooAuthService,
            odoo_session_manager_1.OdooSessionManager,
            odoo_queue_processor_1.OdooQueueProcessor,
            odoo_cron_service_1.OdooCronService,
        ],
        exports: [odoo_auth_service_1.OdooAuthService, odoo_session_manager_1.OdooSessionManager, odoo_client_1.OdooClient],
    })
], OdooModule);
//# sourceMappingURL=odoo.module.js.map
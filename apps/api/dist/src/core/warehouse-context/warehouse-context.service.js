"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var WarehouseContextService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarehouseContextService = void 0;
const common_1 = require("@nestjs/common");
const async_hooks_1 = require("async_hooks");
let WarehouseContextService = class WarehouseContextService {
    static { WarehouseContextService_1 = this; }
    static asyncLocalStorage = new async_hooks_1.AsyncLocalStorage();
    run(context, callback) {
        return WarehouseContextService_1.asyncLocalStorage.run(context, callback);
    }
    getStore() {
        return WarehouseContextService_1.asyncLocalStorage.getStore();
    }
    getWarehouseId() {
        return this.getStore()?.warehouseId;
    }
    getWarehouseUuid() {
        return this.getStore()?.warehouseUuid;
    }
    getUserId() {
        return this.getStore()?.userId;
    }
};
exports.WarehouseContextService = WarehouseContextService;
exports.WarehouseContextService = WarehouseContextService = WarehouseContextService_1 = __decorate([
    (0, common_1.Injectable)()
], WarehouseContextService);
//# sourceMappingURL=warehouse-context.service.js.map
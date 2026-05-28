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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarehouseGuard = void 0;
const common_1 = require("@nestjs/common");
const warehouse_resolver_1 = require("./warehouse.resolver");
let WarehouseGuard = class WarehouseGuard {
    warehouseResolver;
    constructor(warehouseResolver) {
        this.warehouseResolver = warehouseResolver;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            return true;
        }
        const warehouseIdHeader = request.headers['x-warehouse-id'];
        if (!warehouseIdHeader) {
            return true;
        }
        const warehouse = (await this.warehouseResolver.resolveWarehouse(warehouseIdHeader));
        if (!warehouse) {
            throw new common_1.BadRequestException('Warehouse tidak valid');
        }
        const roleName = user.role?.name || user.role;
        const hasAccess = await this.warehouseResolver.validateUserAccess(user.id, warehouse.id, roleName);
        if (!hasAccess) {
            throw new common_1.ForbiddenException('Anda tidak memiliki akses ke warehouse ini');
        }
        request.warehouse = warehouse;
        return true;
    }
};
exports.WarehouseGuard = WarehouseGuard;
exports.WarehouseGuard = WarehouseGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [warehouse_resolver_1.WarehouseResolver])
], WarehouseGuard);
//# sourceMappingURL=warehouse.guard.js.map
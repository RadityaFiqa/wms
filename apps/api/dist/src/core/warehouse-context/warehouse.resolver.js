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
exports.WarehouseResolver = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/prisma/prisma.service");
let WarehouseResolver = class WarehouseResolver {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resolveWarehouse(warehouseIdHeader) {
        if (!warehouseIdHeader) {
            return null;
        }
        let warehouse = null;
        const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(warehouseIdHeader);
        if (isUuid) {
            warehouse = await this.prisma.warehouse.findUnique({
                where: { uuid: warehouseIdHeader },
            });
        }
        else {
            const id = parseInt(warehouseIdHeader, 10);
            if (!isNaN(id)) {
                warehouse = await this.prisma.warehouse.findUnique({
                    where: { id },
                });
            }
        }
        if (!warehouse) {
            throw new common_1.NotFoundException('Gudang (warehouse) tidak ditemukan');
        }
        return warehouse;
    }
    async validateUserAccess(userId, warehouseId, roleName) {
        if (roleName === 'SUPER_ADMIN') {
            return true;
        }
        const access = await this.prisma.userWarehouseAccess.findUnique({
            where: {
                userId_warehouseId: {
                    userId,
                    warehouseId,
                },
            },
        });
        return !!access;
    }
};
exports.WarehouseResolver = WarehouseResolver;
exports.WarehouseResolver = WarehouseResolver = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WarehouseResolver);
//# sourceMappingURL=warehouse.resolver.js.map
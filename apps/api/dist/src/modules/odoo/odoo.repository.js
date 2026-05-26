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
exports.OdooRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/prisma/prisma.service");
let OdooRepository = class OdooRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.odooAccount.findMany({
            include: {
                warehouse: {
                    select: {
                        name: true,
                        uuid: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
    async findActiveAccounts() {
        return this.prisma.odooAccount.findMany({
            where: {
                isActive: true,
            },
            include: {
                warehouse: {
                    select: {
                        name: true,
                    },
                },
            },
        });
    }
    async findByUuid(uuid) {
        return this.prisma.odooAccount.findUnique({
            where: { uuid },
            include: {
                warehouse: {
                    select: {
                        name: true,
                        uuid: true,
                    },
                },
            },
        });
    }
    async findByWarehouseId(warehouseId) {
        return this.prisma.odooAccount.findUnique({
            where: { warehouseId },
        });
    }
    async findById(id) {
        return this.prisma.odooAccount.findUnique({
            where: { id },
            include: {
                warehouse: {
                    select: {
                        name: true,
                    },
                },
            },
        });
    }
    async create(data) {
        return this.prisma.odooAccount.create({
            data,
            include: {
                warehouse: {
                    select: {
                        name: true,
                    },
                },
            },
        });
    }
    async update(uuid, data) {
        return this.prisma.odooAccount.update({
            where: { uuid },
            data,
            include: {
                warehouse: {
                    select: {
                        name: true,
                    },
                },
            },
        });
    }
    async updateSessionData(id, sessionDetails) {
        return this.prisma.odooAccount.update({
            where: { id },
            data: sessionDetails,
        });
    }
    async delete(uuid) {
        return this.prisma.odooAccount.delete({
            where: { uuid },
        });
    }
};
exports.OdooRepository = OdooRepository;
exports.OdooRepository = OdooRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OdooRepository);
//# sourceMappingURL=odoo.repository.js.map
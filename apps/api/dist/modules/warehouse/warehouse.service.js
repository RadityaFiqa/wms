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
exports.WarehouseService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/prisma/prisma.service");
let WarehouseService = class WarehouseService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        const existing = await this.prisma.warehouse.findUnique({
            where: { code: data.code },
        });
        if (existing) {
            throw new common_1.BadRequestException('Kode gudang (warehouse code) sudah digunakan.');
        }
        return this.prisma.warehouse.create({
            data: {
                code: data.code,
                name: data.name,
                location: data.location,
                capacity: data.capacity,
                type: data.type || null,
                address: data.address || null,
                isActive: true,
                odooReference: data.odooReference || null,
            },
        });
    }
    async findAll(query) {
        const page = query.page || 1;
        const limit = query.limit || 10;
        const skip = (page - 1) * limit;
        const where = {};
        if (query.activeOnly) {
            where.isActive = true;
        }
        if (query.allowedIds && query.allowedIds.length > 0) {
            where.id = { in: query.allowedIds };
        }
        else if (query.allowedIds) {
            where.id = -1;
        }
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
                { location: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        const [total, items] = await Promise.all([
            this.prisma.warehouse.count({ where }),
            this.prisma.warehouse.findMany({
                where,
                skip,
                take: limit,
                orderBy: { code: 'asc' },
            }),
        ]);
        return {
            data: items,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async findByUuid(uuid) {
        const warehouse = await this.prisma.warehouse.findUnique({
            where: { uuid },
        });
        if (!warehouse) {
            throw new common_1.NotFoundException('Gudang (warehouse) tidak ditemukan.');
        }
        return warehouse;
    }
    async update(uuid, data) {
        const warehouse = await this.findByUuid(uuid);
        if (data.code !== warehouse.code) {
            const existing = await this.prisma.warehouse.findUnique({
                where: { code: data.code },
            });
            if (existing) {
                throw new common_1.BadRequestException('Kode gudang (warehouse code) sudah digunakan.');
            }
        }
        return this.prisma.warehouse.update({
            where: { uuid },
            data: {
                code: data.code,
                name: data.name,
                location: data.location,
                capacity: data.capacity,
                type: data.type || null,
                address: data.address || null,
                isActive: data.isActive !== undefined ? data.isActive : warehouse.isActive,
                odooReference: data.odooReference || null,
            },
        });
    }
    async remove(uuid) {
        const warehouse = await this.findByUuid(uuid);
        return this.prisma.warehouse.update({
            where: { uuid },
            data: { isActive: false },
        });
    }
};
exports.WarehouseService = WarehouseService;
exports.WarehouseService = WarehouseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WarehouseService);
//# sourceMappingURL=warehouse.service.js.map
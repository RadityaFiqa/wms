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
exports.AuditLogService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/prisma/prisma.service");
let AuditLogService = class AuditLogService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async log(data) {
        return this.prisma.auditLog.create({
            data: {
                actorId: data.actorId || null,
                targetId: data.targetId || null,
                action: data.action,
                ipAddress: data.ipAddress || null,
                userAgent: data.userAgent || null,
                details: data.details ? JSON.stringify(data.details) : null,
            },
        });
    }
    async findAll(query, currentUser) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const skip = (page - 1) * limit;
        const where = {};
        if (query.action) {
            where.action = query.action;
        }
        if (query.search) {
            where.OR = [
                { actor: { name: { contains: query.search, mode: 'insensitive' } } },
                { actor: { email: { contains: query.search, mode: 'insensitive' } } },
                { target: { name: { contains: query.search, mode: 'insensitive' } } },
                { target: { email: { contains: query.search, mode: 'insensitive' } } },
                { action: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        if (currentUser.role?.name !== 'SUPER_ADMIN') {
            const accesses = await this.prisma.warehouseAccess.findMany({
                where: { userId: currentUser.id },
                select: { warehouseId: true },
            });
            const allowedWarehouseIds = accesses.map((a) => a.warehouseId);
            const warehouseCondition = {
                OR: [
                    { actor: { warehouseId: { in: allowedWarehouseIds } } },
                    { target: { warehouseId: { in: allowedWarehouseIds } } },
                ],
            };
            if (where.OR) {
                where.AND = [
                    { OR: where.OR },
                    warehouseCondition,
                ];
                delete where.OR;
            }
            else {
                where.AND = [warehouseCondition];
            }
        }
        const [total, data] = await Promise.all([
            this.prisma.auditLog.count({ where }),
            this.prisma.auditLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { timestamp: 'desc' },
                include: {
                    actor: { select: { id: true, uuid: true, email: true, name: true } },
                    target: { select: { id: true, uuid: true, email: true, name: true } },
                },
            }),
        ]);
        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
};
exports.AuditLogService = AuditLogService;
exports.AuditLogService = AuditLogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditLogService);
//# sourceMappingURL=audit-log.service.js.map
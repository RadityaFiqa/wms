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
exports.RoleService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/prisma/prisma.service");
let RoleService = class RoleService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.role.findMany({
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
            orderBy: { id: 'asc' },
        });
    }
    async findAllPermissions() {
        return this.prisma.permission.findMany({
            orderBy: { subject: 'asc' },
        });
    }
    async findByUuid(uuid) {
        const role = await this.prisma.role.findUnique({
            where: { uuid },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });
        if (!role) {
            throw new common_1.NotFoundException('Role tidak ditemukan');
        }
        return role;
    }
    async create(data) {
        const existing = await this.prisma.role.findUnique({
            where: { name: data.name },
        });
        if (existing) {
            throw new common_1.BadRequestException('Nama role sudah digunakan');
        }
        const role = await this.prisma.role.create({
            data: {
                name: data.name,
                description: data.description,
            },
        });
        if (data.permissionIds && data.permissionIds.length > 0) {
            const connections = data.permissionIds.map((pid) => ({
                roleId: role.id,
                permissionId: pid,
            }));
            await this.prisma.rolePermission.createMany({
                data: connections,
            });
        }
        return this.findByUuid(role.uuid);
    }
    async update(uuid, data) {
        const role = await this.prisma.role.findUnique({
            where: { uuid },
        });
        if (!role) {
            throw new common_1.NotFoundException('Role tidak ditemukan');
        }
        await this.prisma.role.update({
            where: { uuid },
            data: {
                description: data.description,
            },
        });
        if (data.permissionIds !== undefined) {
            await this.prisma.rolePermission.deleteMany({
                where: { roleId: role.id },
            });
            if (data.permissionIds.length > 0) {
                const connections = data.permissionIds.map((pid) => ({
                    roleId: role.id,
                    permissionId: pid,
                }));
                await this.prisma.rolePermission.createMany({
                    data: connections,
                });
            }
        }
        return this.findByUuid(uuid);
    }
};
exports.RoleService = RoleService;
exports.RoleService = RoleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RoleService);
//# sourceMappingURL=role.service.js.map
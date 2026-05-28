"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/prisma/prisma.service");
const email_service_1 = require("../email/email.service");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
let UserService = class UserService {
    prisma;
    emailService;
    constructor(prisma, emailService) {
        this.prisma = prisma;
        this.emailService = emailService;
    }
    generateRandomPassword(length = 12) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
        let password = '';
        const bytes = crypto.randomBytes(length);
        for (let i = 0; i < length; i++) {
            password += chars[bytes[i] % chars.length];
        }
        return password;
    }
    async create(data) {
        const existing = await this.prisma.user.findUnique({
            where: { email: data.email },
        });
        if (existing) {
            throw new common_1.BadRequestException('Email sudah terdaftar');
        }
        const tempPassword = this.generateRandomPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const user = await this.prisma.user.create({
            data: {
                email: data.email,
                name: data.name,
                password: hashedPassword,
                roleId: data.roleId,
                warehouseId: data.warehouseId || null,
                isFirstLogin: true,
                isActive: true,
            },
            include: {
                role: true,
            },
        });
        await this.emailService.sendWelcomeEmail(user.email, user.name, tempPassword);
        const { password: _, ...result } = user;
        return result;
    }
    async update(uuid, data) {
        const user = await this.prisma.user.findUnique({
            where: { uuid },
        });
        if (!user) {
            throw new common_1.NotFoundException('User tidak ditemukan');
        }
        if (data.email && data.email !== user.email) {
            const emailConflict = await this.prisma.user.findUnique({
                where: { email: data.email },
            });
            if (emailConflict) {
                throw new common_1.BadRequestException('Email sudah digunakan oleh user lain');
            }
        }
        const updated = await this.prisma.user.update({
            where: { uuid },
            data: {
                email: data.email,
                name: data.name,
                roleId: data.roleId,
                warehouseId: data.warehouseId !== undefined ? data.warehouseId : user.warehouseId,
            },
            include: {
                role: true,
            },
        });
        const { password: _, ...result } = updated;
        return result;
    }
    async toggleStatus(uuid, isActive) {
        const user = await this.prisma.user.findUnique({
            where: { uuid },
        });
        if (!user) {
            throw new common_1.NotFoundException('User tidak ditemukan');
        }
        const updated = await this.prisma.user.update({
            where: { uuid },
            data: { isActive },
        });
        await this.emailService.sendAccountStatusEmail(updated.email, updated.name, isActive);
        if (!isActive) {
            await this.prisma.session.updateMany({
                where: { userId: user.id },
                data: { isRevoked: true },
            });
        }
        const { password: _, ...result } = updated;
        return result;
    }
    async adminResetPassword(uuid) {
        const user = await this.prisma.user.findUnique({
            where: { uuid },
        });
        if (!user) {
            throw new common_1.NotFoundException('User tidak ditemukan');
        }
        const newTempPassword = this.generateRandomPassword();
        const hashedPassword = await bcrypt.hash(newTempPassword, 10);
        await this.prisma.user.update({
            where: { uuid },
            data: {
                password: hashedPassword,
                isFirstLogin: true,
            },
        });
        await this.prisma.session.updateMany({
            where: { userId: user.id },
            data: { isRevoked: true },
        });
        await this.emailService.sendWelcomeEmail(user.email, user.name, newTempPassword);
        return { message: 'Password berhasil direset. Password baru telah dikirimkan ke email user.' };
    }
    async findAll(query) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const skip = (page - 1) * limit;
        const where = {};
        if (query.roleId) {
            where.roleId = Number(query.roleId);
        }
        if (query.isActive !== "") {
            where.isActive = String(query.isActive) === 'true';
        }
        console.log(`isActive`, where);
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        const [total, data] = await Promise.all([
            this.prisma.user.count({ where }),
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    role: { select: { id: true, uuid: true, name: true } },
                    warehouse: { select: { id: true, uuid: true, name: true } },
                },
            }),
        ]);
        const usersWithoutPassword = data.map(({ password, ...user }) => user);
        return {
            data: usersWithoutPassword,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async findByEmail(email) {
        return this.prisma.user.findUnique({
            where: { email },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: {
                                permission: true,
                            },
                        },
                    },
                },
                warehouse: true,
            },
        });
    }
    async findByUuid(uuid) {
        const user = await this.prisma.user.findUnique({
            where: { uuid },
            include: {
                role: {
                    select: { id: true, uuid: true, name: true },
                },
                warehouse: {
                    select: { id: true, uuid: true, name: true },
                },
            },
        });
        if (!user) {
            throw new common_1.NotFoundException('User tidak ditemukan');
        }
        const { password, ...result } = user;
        return result;
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService])
], UserService);
//# sourceMappingURL=user.service.js.map
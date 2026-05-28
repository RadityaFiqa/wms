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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const user_service_1 = require("../user/user.service");
const prisma_service_1 = require("../../core/prisma/prisma.service");
const email_service_1 = require("../email/email.service");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
let AuthService = class AuthService {
    userService;
    jwtService;
    prisma;
    emailService;
    constructor(userService, jwtService, prisma, emailService) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.prisma = prisma;
        this.emailService = emailService;
    }
    async validateUser(email, pass) {
        const user = await this.userService.findByEmail(email);
        if (user && user.isActive) {
            const isMatch = await bcrypt.compare(pass, user.password);
            if (isMatch) {
                const { password, ...result } = user;
                return result;
            }
        }
        return null;
    }
    async login(user, ipAddress, userAgent) {
        const payload = { email: user.email, sub: user.id };
        const accessToken = this.jwtService.sign(payload);
        const refreshToken = crypto.randomBytes(40).toString('hex');
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await this.prisma.session.create({
            data: {
                userId: user.id,
                token: refreshTokenHash,
                ipAddress,
                userAgent,
                expiresAt,
            },
        });
        return {
            accessToken,
            refreshToken,
            user: {
                uuid: user.uuid,
                email: user.email,
                name: user.name,
                isFirstLogin: user.isFirstLogin,
                role: user.role.name,
                permissions: user.role.permissions.map((rp) => ({
                    action: rp.permission.action,
                    subject: rp.permission.subject,
                })),
                warehouse: user.warehouse ? { uuid: user.warehouse.uuid, name: user.warehouse.name } : null,
                accessibleWarehouses: await this.getAccessibleWarehouses(user.id, user.role.name),
            },
        };
    }
    async getAccessibleWarehouses(userId, roleName) {
        if (roleName === 'SUPER_ADMIN') {
            return this.prisma.warehouse.findMany({
                select: { uuid: true, name: true },
                orderBy: { name: 'asc' },
            });
        }
        const accesses = await this.prisma.userWarehouseAccess.findMany({
            where: { userId },
            include: { warehouse: { select: { uuid: true, name: true } } },
            orderBy: { warehouse: { name: 'asc' } },
        });
        return accesses.map((acc) => ({
            uuid: acc.warehouse.uuid,
            name: acc.warehouse.name,
        }));
    }
    async refresh(refreshToken, ipAddress, userAgent) {
        const activeSessions = await this.prisma.session.findMany({
            where: { isRevoked: false, expiresAt: { gt: new Date() } },
            include: {
                user: {
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
                },
            },
        });
        let matchedSession = null;
        for (const session of activeSessions) {
            const isMatch = await bcrypt.compare(refreshToken, session.token);
            if (isMatch) {
                matchedSession = session;
                break;
            }
        }
        if (!matchedSession) {
            throw new common_1.UnauthorizedException('Refresh token tidak valid atau kedaluwarsa');
        }
        await this.prisma.session.update({
            where: { id: matchedSession.id },
            data: { isRevoked: true },
        });
        const user = matchedSession.user;
        const payload = { email: user.email, sub: user.id };
        const newAccessToken = this.jwtService.sign(payload);
        const newRefreshToken = crypto.randomBytes(40).toString('hex');
        const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await this.prisma.session.create({
            data: {
                userId: user.id,
                token: newRefreshTokenHash,
                ipAddress,
                userAgent,
                expiresAt,
            },
        });
        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            user: {
                uuid: user.uuid,
                email: user.email,
                name: user.name,
                isFirstLogin: user.isFirstLogin,
                role: user.role.name,
                permissions: user.role.permissions.map((rp) => ({
                    action: rp.permission.action,
                    subject: rp.permission.subject,
                })),
                warehouse: user.warehouse ? { uuid: user.warehouse.uuid, name: user.warehouse.name } : null,
                accessibleWarehouses: await this.getAccessibleWarehouses(user.id, user.role.name),
            },
        };
    }
    async logout(refreshToken) {
        const activeSessions = await this.prisma.session.findMany({
            where: { isRevoked: false },
        });
        for (const session of activeSessions) {
            const isMatch = await bcrypt.compare(refreshToken, session.token);
            if (isMatch) {
                await this.prisma.session.update({
                    where: { id: session.id },
                    data: { isRevoked: true },
                });
                break;
            }
        }
    }
    async forgotPassword(email) {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            return { message: 'Jika email terdaftar, instruksi reset password telah dikirimkan.' };
        }
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        await this.prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                token,
                expiresAt,
            },
        });
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const resetLink = `${frontendUrl}/reset-password?token=${token}`;
        await this.emailService.sendPasswordResetEmail(user.email, user.name, resetLink);
        return { message: 'Jika email terdaftar, instruksi reset password telah dikirimkan.' };
    }
    async resetPassword(token, pass) {
        const resetToken = await this.prisma.passwordResetToken.findUnique({
            where: { token },
            include: { user: true },
        });
        if (!resetToken || resetToken.isUsed || resetToken.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Token reset password tidak valid atau sudah kedaluwarsa');
        }
        const hashedPassword = await bcrypt.hash(pass, 10);
        await this.prisma.user.update({
            where: { id: resetToken.userId },
            data: {
                password: hashedPassword,
                isFirstLogin: false,
            },
        });
        await this.prisma.passwordResetToken.update({
            where: { id: resetToken.id },
            data: { isUsed: true },
        });
        await this.prisma.session.updateMany({
            where: { userId: resetToken.userId },
            data: { isRevoked: true },
        });
        return { message: 'Password berhasil diperbarui. Silakan login kembali.' };
    }
    async changePassword(userId, data) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('User tidak ditemukan');
        }
        const isMatch = await bcrypt.compare(data.oldPass, user.password);
        if (!isMatch) {
            throw new common_1.BadRequestException('Password lama salah');
        }
        const hashedPassword = await bcrypt.hash(data.newPass, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                isFirstLogin: false,
            },
        });
        await this.prisma.session.updateMany({
            where: { userId, isRevoked: false },
            data: { isRevoked: true },
        });
        return { message: 'Password berhasil diubah. Silakan gunakan password baru Anda untuk login berikutnya.' };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_service_1.UserService,
        jwt_1.JwtService,
        prisma_service_1.PrismaService,
        email_service_1.EmailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map
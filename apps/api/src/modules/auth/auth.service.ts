import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
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

  async login(user: any, ipAddress?: string, userAgent?: string) {
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload);
    
    // Generate refresh token
    const sessionUuid = crypto.randomUUID();
    const tokenSecret = crypto.randomBytes(32).toString('hex');
    const refreshToken = `${sessionUuid}:${tokenSecret}`;
    const refreshTokenHash = await bcrypt.hash(tokenSecret, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Save session in DB
    await this.prisma.session.create({
      data: {
        uuid: sessionUuid,
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
        permissions: user.role.permissions.map((rp: any) => ({
          action: rp.permission.action,
          subject: rp.permission.subject,
        })),
        warehouse: user.warehouse ? { uuid: user.warehouse.uuid, name: user.warehouse.name } : null,
        accessibleWarehouses: await this.getAccessibleWarehouses(user.id, user.role.name),
      },
    };
  }

  async getAccessibleWarehouses(userId: number, roleName: string) {
    if (roleName === 'SUPER_ADMIN') {
      return this.prisma.warehouse.findMany({
        select: { uuid: true, name: true },
        orderBy: { name: 'asc' },
      });
    }

    const accesses = await this.prisma.warehouseAccess.findMany({
      where: { userId },
      include: { warehouse: { select: { uuid: true, name: true } } },
      orderBy: { warehouse: { name: 'asc' } } as any,
    });

    return accesses.map((acc) => ({
      uuid: acc.warehouse.uuid,
      name: acc.warehouse.name,
    }));
  }

  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    let matchedSession: any = null;

    if (refreshToken.includes(':')) {
      const [sessionUuid, tokenSecret] = refreshToken.split(':');
      const session = await this.prisma.session.findUnique({
        where: { uuid: sessionUuid, isRevoked: false, expiresAt: { gt: new Date() } },
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

      if (session) {
        const isMatch = await bcrypt.compare(tokenSecret, session.token);
        if (isMatch) {
          matchedSession = session;
        }
      }
    } else {
      // Fallback for old style tokens
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

      for (const session of activeSessions) {
        const isMatch = await bcrypt.compare(refreshToken, session.token);
        if (isMatch) {
          matchedSession = session;
          break;
        }
      }
    }

    if (!matchedSession) {
      throw new UnauthorizedException('Refresh token tidak valid atau kedaluwarsa');
    }

    // Revoke the used refresh token (rotation)
    await this.prisma.session.update({
      where: { id: matchedSession.id },
      data: { isRevoked: true },
    });

    // Generate new tokens
    const user = matchedSession.user;
    const payload = { email: user.email, sub: user.id };
    const newAccessToken = this.jwtService.sign(payload);
    
    const newSessionUuid = crypto.randomUUID();
    const newTokenSecret = crypto.randomBytes(32).toString('hex');
    const newRefreshToken = `${newSessionUuid}:${newTokenSecret}`;
    const newRefreshTokenHash = await bcrypt.hash(newTokenSecret, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Save new session in DB
    await this.prisma.session.create({
      data: {
        uuid: newSessionUuid,
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
        permissions: user.role.permissions.map((rp: any) => ({
          action: rp.permission.action,
          subject: rp.permission.subject,
        })),
        warehouse: user.warehouse ? { uuid: user.warehouse.uuid, name: user.warehouse.name } : null,
        accessibleWarehouses: await this.getAccessibleWarehouses(user.id, user.role.name),
      },
    };
  }

  async logout(refreshToken: string, userId: number) {
    if (refreshToken.includes(':')) {
      const [sessionUuid, tokenSecret] = refreshToken.split(':');
      const session = await this.prisma.session.findUnique({
        where: { uuid: sessionUuid, userId, isRevoked: false },
      });
      if (session) {
        const isMatch = await bcrypt.compare(tokenSecret, session.token);
        if (isMatch) {
          return await this.prisma.session.update({
            where: { id: session.id },
            data: { isRevoked: true },
          });
        }
      }
    } else {
      // Fallback for old style tokens
      const activeSessions = await this.prisma.session.findMany({
        where: { userId, isRevoked: false },
      });

      for (const session of activeSessions) {
        const isMatch = await bcrypt.compare(refreshToken, session.token);
        if (isMatch) {
          return await this.prisma.session.update({
            where: { id: session.id },
            data: { isRevoked: true },
          });
        }
      }
    }
    return null;
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return { message: 'Jika email terdaftar, instruksi reset password telah dikirimkan.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

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

  async resetPassword(token: string, pass: string) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.isUsed || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Token reset password tidak valid atau sudah kedaluwarsa');
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

    // Invalidate all active sessions
    await this.prisma.session.updateMany({
      where: { userId: resetToken.userId },
      data: { isRevoked: true },
    });

    return { message: 'Password berhasil diperbarui. Silakan login kembali.' };
  }

  async changePassword(userId: number, data: { oldPass: string; newPass: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User tidak ditemukan');
    }

    const isMatch = await bcrypt.compare(data.oldPass, user.password);
    if (!isMatch) {
      throw new BadRequestException('Password lama salah');
    }

    const hashedPassword = await bcrypt.hash(data.newPass, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        isFirstLogin: false,
      },
    });

    // Revoke all active sessions
    await this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    return { message: 'Password berhasil diubah. Silakan gunakan password baru Anda untuk login berikutnya.' };
  }
}

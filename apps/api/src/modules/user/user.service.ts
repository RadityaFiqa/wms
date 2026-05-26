import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private generateRandomPassword(length = 12): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    let password = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      password += chars[bytes[i] % chars.length];
    }
    return password;
  }

  async create(data: {
    email: string;
    name: string;
    roleId: number;
    warehouseId?: number | null;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new BadRequestException('Email sudah terdaftar');
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

  async update(uuid: string, data: {
    email: string;
    name: string;
    roleId: number;
    warehouseId?: number | null;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
    });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    if (data.email && data.email !== user.email) {
      const emailConflict = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (emailConflict) {
        throw new BadRequestException('Email sudah digunakan oleh user lain');
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

  async toggleStatus(uuid: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
    });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
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

  async adminResetPassword(uuid: string) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
    });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
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

  async findAll(query: {
    search?: string;
    roleId?: number;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.roleId) {
      where.roleId = Number(query.roleId);
    }

    if (query.isActive !== undefined) {
      where.isActive = String(query.isActive) === 'true';
    }

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

  async findByEmail(email: string) {
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

  async findByUuid(uuid: string) {
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
      throw new NotFoundException('User tidak ditemukan');
    }
    const { password, ...result } = user;
    return result;
  }
}

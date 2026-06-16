import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
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
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    let password = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      password += chars[bytes[i] % chars.length];
    }
    return password;
  }

  private async getWarehouseAdminScope(currentUser: any) {
    const isSuperAdmin = currentUser.role?.name === 'SUPER_ADMIN';
    if (isSuperAdmin) {
      return { isSuperAdmin: true, allowedWarehouseIds: [] };
    }

    const accesses = await this.prisma.warehouseAccess.findMany({
      where: { userId: currentUser.id },
      select: { warehouseId: true },
    });
    const allowedWarehouseIds = accesses.map((a) => a.warehouseId);
    return { isSuperAdmin: false, allowedWarehouseIds };
  }

  async create(
    data: {
      email: string;
      name: string;
      roleId: number;
      warehouseId?: number | null;
    },
    currentUser: any,
  ) {
    const { isSuperAdmin, allowedWarehouseIds } =
      await this.getWarehouseAdminScope(currentUser);
    if (!isSuperAdmin) {
      if (data.roleId === 1) {
        throw new ForbiddenException(
          'Anda tidak dapat membuat akun Super Admin',
        );
      }
      if (
        !data.warehouseId ||
        !allowedWarehouseIds.includes(data.warehouseId)
      ) {
        throw new ForbiddenException(
          'Anda hanya dapat membuat user untuk warehouse yang ditugaskan kepada Anda',
        );
      }
    }

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

    // Sync WarehouseAccess
    if (user.warehouseId) {
      await this.prisma.warehouseAccess.upsert({
        where: {
          userId_warehouseId: {
            userId: user.id,
            warehouseId: user.warehouseId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          warehouseId: user.warehouseId,
        },
      });
    }

    await this.emailService.sendWelcomeEmail(
      user.email,
      user.name,
      tempPassword,
    );

    const { password: _, ...result } = user;
    return result;
  }

  async update(
    uuid: string,
    data: {
      email: string;
      name: string;
      roleId: number;
      warehouseId?: number | null;
    },
    currentUser: any,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
    });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const { isSuperAdmin, allowedWarehouseIds } =
      await this.getWarehouseAdminScope(currentUser);
    if (!isSuperAdmin) {
      // 1. Check existing user scope
      if (user.roleId === 1) {
        throw new ForbiddenException(
          'Anda tidak dapat mengubah akun Super Admin',
        );
      }
      if (
        !user.warehouseId ||
        !allowedWarehouseIds.includes(user.warehouseId)
      ) {
        throw new ForbiddenException(
          'Anda tidak dapat mengubah user di luar warehouse Anda',
        );
      }

      // 2. Check new values scope
      if (data.roleId === 1) {
        throw new ForbiddenException(
          'Anda tidak dapat mengubah role menjadi Super Admin',
        );
      }
      if (
        !data.warehouseId ||
        !allowedWarehouseIds.includes(data.warehouseId)
      ) {
        throw new ForbiddenException(
          'Anda hanya dapat menugaskan user ke warehouse yang ditugaskan kepada Anda',
        );
      }
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
        warehouseId:
          data.warehouseId !== undefined ? data.warehouseId : user.warehouseId,
      },
      include: {
        role: true,
      },
    });

    // Synchronize WarehouseAccess
    if (data.warehouseId !== undefined) {
      if (data.warehouseId === null) {
        await this.prisma.warehouseAccess.deleteMany({
          where: { userId: user.id },
        });
      } else {
        await this.prisma.warehouseAccess.deleteMany({
          where: {
            userId: user.id,
            warehouseId: { not: data.warehouseId },
          },
        });
        await this.prisma.warehouseAccess.upsert({
          where: {
            userId_warehouseId: {
              userId: user.id,
              warehouseId: data.warehouseId,
            },
          },
          update: {},
          create: {
            userId: user.id,
            warehouseId: data.warehouseId,
          },
        });
      }
    }

    const { password: _, ...result } = updated;
    return result;
  }

  async toggleStatus(uuid: string, isActive: boolean, currentUser: any) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
    });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const { isSuperAdmin, allowedWarehouseIds } =
      await this.getWarehouseAdminScope(currentUser);
    if (!isSuperAdmin) {
      if (user.roleId === 1) {
        throw new ForbiddenException(
          'Anda tidak dapat mengubah status akun Super Admin',
        );
      }
      if (
        !user.warehouseId ||
        !allowedWarehouseIds.includes(user.warehouseId)
      ) {
        throw new ForbiddenException(
          'Anda tidak memiliki akses untuk mengubah status user di luar warehouse Anda',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { uuid },
      data: { isActive },
    });

    await this.emailService.sendAccountStatusEmail(
      updated.email,
      updated.name,
      isActive,
    );

    if (!isActive) {
      await this.prisma.session.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });
    }

    const { password: _, ...result } = updated;
    return result;
  }

  async adminResetPassword(uuid: string, currentUser: any) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
    });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const { isSuperAdmin, allowedWarehouseIds } =
      await this.getWarehouseAdminScope(currentUser);
    if (!isSuperAdmin) {
      if (user.roleId === 1) {
        throw new ForbiddenException(
          'Anda tidak dapat mereset password akun Super Admin',
        );
      }
      if (
        !user.warehouseId ||
        !allowedWarehouseIds.includes(user.warehouseId)
      ) {
        throw new ForbiddenException(
          'Anda tidak memiliki akses untuk mereset password user di luar warehouse Anda',
        );
      }
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

    await this.emailService.sendWelcomeEmail(
      user.email,
      user.name,
      newTempPassword,
    );

    return {
      message:
        'Password berhasil direset. Password baru telah dikirimkan ke email user.',
    };
  }

  async findAll(
    query: {
      search?: string;
      roleId?: number;
      isActive?: string;
      page?: number;
      limit?: number;
    },
    currentUser: any,
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.roleId) {
      where.roleId = Number(query.roleId);
    }

    if (query.isActive !== '') {
      where.isActive = String(query.isActive) === 'true';
    }

    console.log(`isActive`, where);

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const { isSuperAdmin, allowedWarehouseIds } =
      await this.getWarehouseAdminScope(currentUser);
    if (!isSuperAdmin) {
      where.warehouseId = { in: allowedWarehouseIds };
      where.roleId = where.roleId
        ? { equals: where.roleId, not: 1 }
        : { not: 1 };
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

  async findByUuid(uuid: string, currentUser: any) {
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

    const { isSuperAdmin, allowedWarehouseIds } =
      await this.getWarehouseAdminScope(currentUser);
    if (!isSuperAdmin) {
      if (user.roleId === 1) {
        throw new ForbiddenException(
          'Anda tidak memiliki akses untuk melihat akun Super Admin',
        );
      }
      if (
        !user.warehouseId ||
        !allowedWarehouseIds.includes(user.warehouseId)
      ) {
        throw new ForbiddenException(
          'Anda tidak memiliki akses untuk melihat user di luar warehouse Anda',
        );
      }
    }

    const { password, ...result } = user;
    return result;
  }
}

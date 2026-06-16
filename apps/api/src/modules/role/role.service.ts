import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findByUuid(uuid: string) {
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
      throw new NotFoundException('Role tidak ditemukan');
    }
    return role;
  }

  async create(data: {
    name: string;
    description?: string | null;
    permissionIds?: number[];
  }) {
    const existing = await this.prisma.role.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      throw new BadRequestException('Nama role sudah digunakan');
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

  async update(
    uuid: string,
    data: { description?: string | null; permissionIds?: number[] },
  ) {
    const role = await this.prisma.role.findUnique({
      where: { uuid },
    });
    if (!role) {
      throw new NotFoundException('Role tidak ditemukan');
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
}

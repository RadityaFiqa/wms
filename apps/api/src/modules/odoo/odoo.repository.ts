import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { Prisma } from '@prisma/client';

@Injectable()
export class OdooRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  async findActiveAccounts(isNonCommodity?: boolean) {
    const where: Prisma.OdooAccountWhereInput = {
      isActive: true,
    };
    if (isNonCommodity !== undefined) {
      where.isNonCommodity = isNonCommodity;
    }
    return this.prisma.odooAccount.findMany({
      where,
      include: {
        warehouse: {
          select: {
            name: true,
            uuid: true,
            odooReference: true,
          },
        },
      },
    });
  }

  async findByUuid(uuid: string) {
    return this.prisma.odooAccount.findUnique({
      where: { uuid },
      include: {
        warehouse: {
          select: {
            name: true,
            uuid: true,
            odooReference: true,
          },
        },
      },
    });
  }

  async findByWarehouseId(warehouseId: number, isNonCommodity = false) {
    return this.prisma.odooAccount.findFirst({
      where: {
        warehouseId,
        isNonCommodity,
      },
      include: {
        warehouse: {
          select: {
            name: true,
            uuid: true,
            odooReference: true,
          },
        },
      },
    });
  }

  async findAccountsByWarehouseId(warehouseId: number) {
    return this.prisma.odooAccount.findMany({
      where: { warehouseId },
      include: {
        warehouse: {
          select: {
            name: true,
            uuid: true,
            odooReference: true,
          },
        },
      },
      orderBy: {
        isNonCommodity: 'asc',
      },
    });
  }

  async findById(id: number) {
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

  async create(data: Prisma.OdooAccountUncheckedCreateInput) {
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

  async update(uuid: string, data: Prisma.OdooAccountUpdateInput) {
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

  async updateSessionData(
    id: number,
    sessionDetails: {
      sessionId: string | null;
      csrfToken: string | null;
      sessionExpiredAt: Date | null;
      lastLoginAt?: Date;
      lastRefreshAt?: Date;
    },
  ) {
    return this.prisma.odooAccount.update({
      where: { id },
      data: sessionDetails,
    });
  }

  async delete(uuid: string) {
    return this.prisma.odooAccount.delete({
      where: { uuid },
    });
  }
}

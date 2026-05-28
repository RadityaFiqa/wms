import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class WarehouseResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolveWarehouse(warehouseIdHeader: string) {
    if (!warehouseIdHeader) {
      return null;
    }

    let warehouse: any = null;
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(warehouseIdHeader);
    
    if (isUuid) {
      warehouse = await this.prisma.warehouse.findUnique({
        where: { uuid: warehouseIdHeader },
      });
    } else {
      const id = parseInt(warehouseIdHeader, 10);
      if (!isNaN(id)) {
        warehouse = await this.prisma.warehouse.findUnique({
          where: { id },
        });
      }
    }

    if (!warehouse) {
      throw new NotFoundException('Gudang (warehouse) tidak ditemukan');
    }

    return warehouse;
  }

  async validateUserAccess(userId: number, warehouseId: number, roleName: string): Promise<boolean> {
    if (roleName === 'SUPER_ADMIN') {
      return true;
    }

    const access = await this.prisma.userWarehouseAccess.findUnique({
      where: {
        userId_warehouseId: {
          userId,
          warehouseId,
        },
      },
    });

    return !!access;
  }
}

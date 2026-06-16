import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
} from '@bulog-wms/schema';

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateWarehouseInput) {
    const existing = await this.prisma.warehouse.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      throw new BadRequestException(
        'Kode gudang (warehouse code) sudah digunakan.',
      );
    }

    return this.prisma.warehouse.create({
      data: {
        code: data.code,
        name: data.name,
        location: data.location,
        capacity: data.capacity,
        type: data.type || null,
        address: data.address || null,
        isActive: true,
        odooReference: data.odooReference || null,
      },
    });
  }

  async findAll(query: {
    search?: string;
    page?: number;
    limit?: number;
    activeOnly?: boolean;
    allowedIds?: number[];
  }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.activeOnly) {
      where.isActive = true;
    }

    if (query.allowedIds && query.allowedIds.length > 0) {
      where.id = { in: query.allowedIds };
    } else if (query.allowedIds) {
      // If allowedIds is an empty array, they have access to nothing
      where.id = -1;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.warehouse.count({ where }),
      this.prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
      }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByUuid(uuid: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { uuid },
    });
    if (!warehouse) {
      throw new NotFoundException('Gudang (warehouse) tidak ditemukan.');
    }
    return warehouse;
  }

  async update(uuid: string, data: UpdateWarehouseInput) {
    const warehouse = await this.findByUuid(uuid);

    if (data.code !== warehouse.code) {
      const existing = await this.prisma.warehouse.findUnique({
        where: { code: data.code },
      });
      if (existing) {
        throw new BadRequestException(
          'Kode gudang (warehouse code) sudah digunakan.',
        );
      }
    }

    return this.prisma.warehouse.update({
      where: { uuid },
      data: {
        code: data.code,
        name: data.name,
        location: data.location,
        capacity: data.capacity,
        type: data.type || null,
        address: data.address || null,
        isActive:
          data.isActive !== undefined ? data.isActive : warehouse.isActive,
        odooReference: data.odooReference || null,
      },
    });
  }

  async remove(uuid: string) {
    const warehouse = await this.findByUuid(uuid);

    // Soft delete / deactivate
    return this.prisma.warehouse.update({
      where: { uuid },
      data: { isActive: false },
    });
  }
}

import { Controller, Get, Query, BadRequestException, NotFoundException } from '@nestjs/common';
import { StackCardService } from './stack-card.service';
import { PrismaService } from '@/core/prisma/prisma.service';

@Controller('public-stack-cards')
export class StackCardPublicController {
  constructor(
    private readonly service: StackCardService,
    private readonly prisma: PrismaService,
  ) {}

  private async getWarehouseId(uuid?: string, locationName?: string): Promise<number | undefined> {
    if (uuid) {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { uuid },
        select: { id: true },
      });
      if (!warehouse) {
        throw new NotFoundException('Gudang tidak ditemukan.');
      }
      return warehouse.id;
    }

    if (locationName) {
      const match = await this.prisma.stackCard.findFirst({
        where: { locationName },
        select: { warehouseId: true },
      });
      return match?.warehouseId;
    }

    return undefined;
  }

  @Get('warehouses')
  async getWarehouses() {
    return this.prisma.warehouse.findMany({
      where: { isActive: true },
      select: {
        uuid: true,
        name: true,
        code: true,
        kartuTumpukanSource: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  @Get()
  async findAll(
    @Query('warehouseUuid') warehouseUuid?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('locationName') locationName?: string,
    @Query('snapshotDate') snapshotDate?: string,
  ) {
    const resolvedWarehouseId = await this.getWarehouseId(warehouseUuid, locationName);
    
    // If no warehouse could be resolved and no warehouseUuid was provided, return empty
    if (!resolvedWarehouseId) {
      return {
        data: [],
        total: 0,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        totalPages: 0,
        summary: {
          totalSkus: 0,
          totalLots: 0,
          totalQuantity: 0,
          totalQuantum: 0,
        },
      };
    }

    return this.service.findAll(resolvedWarehouseId, {
      search,
      page,
      limit,
      locationName,
      snapshotDate,
      isPublished: 'true', // strictly published only for public access
    });
  }

  @Get('snapshot-dates')
  async getSnapshotDates(
    @Query('warehouseUuid') warehouseUuid?: string,
    @Query('locationName') locationName?: string,
  ) {
    const resolvedWarehouseId = await this.getWarehouseId(warehouseUuid, locationName);
    if (!resolvedWarehouseId) {
      return [];
    }
    return this.service.getSnapshotDates(resolvedWarehouseId, true); // onlyPublished = true
  }

  @Get('locations')
  async getLocations(
    @Query('warehouseUuid') warehouseUuid?: string,
    @Query('locationName') locationName?: string,
  ) {
    const resolvedWarehouseId = await this.getWarehouseId(warehouseUuid, locationName);
    if (!resolvedWarehouseId) {
      return [];
    }
    return this.service.getLocations(resolvedWarehouseId, true); // onlyPublished = true
  }
}

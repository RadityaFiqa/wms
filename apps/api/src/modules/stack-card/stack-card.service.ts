import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import {
  ImportStackCardInput,
  UpdateStackCardInput,
  StackCardQueryInput,
} from '@bulog-wms/schema';

@Injectable()
export class StackCardService {
  constructor(private readonly prisma: PrismaService) {}

  async importStackCards(
    warehouseId: number,
    userId: number,
    input: ImportStackCardInput,
  ) {
    const { snapshotDate, locationName, actionType, filename, rows } = input;
    const dateParsed = new Date(snapshotDate);

    if (isNaN(dateParsed.getTime())) {
      throw new BadRequestException('Format tanggal snapshot tidak valid.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. If REPLACE, delete existing stack cards for this location and snapshot date
      if (actionType === 'REPLACE') {
        await tx.stackCard.deleteMany({
          where: {
            warehouseId,
            locationName,
            snapshotDate: dateParsed,
          },
        });
      }

      // 2. Prepare rows for insertion
      const recordsToInsert = rows.map((row) => {
        const placementDateParsed = new Date(row.placementDate);
        if (isNaN(placementDateParsed.getTime())) {
          throw new BadRequestException(
            `Format tanggal penempatan tidak valid untuk produk ${row.productName}.`,
          );
        }

        let expiredDateParsed: Date | null = null;
        if (row.expiredDate) {
          expiredDateParsed = new Date(row.expiredDate);
          if (isNaN(expiredDateParsed.getTime())) {
            throw new BadRequestException(
              `Format tanggal expired tidak valid untuk produk ${row.productName}.`,
            );
          }
        }

        return {
          warehouseId,
          productName: row.productName,
          sku: row.sku,
          lot: row.lot,
          shelfLife: row.shelfLife,
          expiredDate: expiredDateParsed,
          placementDate: placementDateParsed,
          locationName: row.locationName,
          quantity: row.quantity,
          quantum: row.quantum,
          uom: row.uom,
          spraying: row.spraying || null,
          fumigasi: row.fumigasi || null,
          fogging: row.fogging || null,
          keterangan: row.keterangan || null,
          isPublished: false, // Uploaded CSV starts as draft (unpublished)
          snapshotDate: dateParsed,
        };
      });

      // 3. Bulk insert stack card items
      await tx.stackCard.createMany({
        data: recordsToInsert,
      });

      // 4. Create log record
      const uploadLog = await tx.stackCardUploadLog.create({
        data: {
          warehouseId,
          snapshotDate: dateParsed,
          filename,
          locationName,
          rowCount: rows.length,
          actionType,
          uploadedById: userId,
        },
      });

      return {
        message: `Berhasil mengimpor ${rows.length} baris data kartu tumpukan.`,
        logId: uploadLog.uuid,
      };
    });
  }

  parseLotInfo(lotName?: string | null, referenceDate = new Date()) {
    if (!lotName || typeof lotName !== 'string') {
      return { expiredDate: null, placement: null, shelfAge: null };
    }

    const expMatch = lotName.match(/\[(\d{4}-\d{2}-\d{2})\]/);
    const placementMatch = lotName.match(/\/(\d{1,2}\/\d{4})(?:\/|$)/);

    if (!expMatch || !placementMatch) {
      return { expiredDate: null, placement: null, shelfAge: null };
    }

    const expiredDate = expMatch[1];
    const placement = placementMatch[1];

    const [monthStr, yearStr] = placement.split('/');
    const pMonth = parseInt(monthStr, 10);
    const pYear = parseInt(yearStr, 10);

    if (isNaN(pMonth) || isNaN(pYear) || pMonth < 1 || pMonth > 12) {
      return { expiredDate: null, placement: null, shelfAge: null };
    }

    const currentYear = referenceDate.getFullYear();
    const currentMonth = referenceDate.getMonth() + 1; // 1-12
    const shelfAge = (currentYear - pYear) * 12 + (currentMonth - pMonth);

    return {
      expiredDate,
      placement,
      shelfAge,
    };
  }

  async findAll(warehouseId: number, query: StackCardQueryInput) {
    let effectiveDataSource = query.dataSource;
    if (!effectiveDataSource) {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { kartuTumpukanSource: true },
      });
      effectiveDataSource = warehouse?.kartuTumpukanSource || 'CSV';
    }

    if (effectiveDataSource === 'REAL_STOCK') {
      const page = query.page ? parseInt(query.page as string, 10) : 1;
      const limit = query.limit ? parseInt(query.limit as string, 10) : 10;
      const skip = (page - 1) * limit;

      const where: any = {
        quantity: {
          gt: 0,
        },
        location: {
          warehouseId,
        },
      };

      if (query.locationName) {
        where.location = {
          ...where.location,
          displayName: query.locationName,
        };
      }

      if (query.search) {
        where.AND = [
          {
            OR: [
              { inventory: { name: { contains: query.search, mode: 'insensitive' } } },
              { inventory: { sku: { contains: query.search, mode: 'insensitive' } } },
              { lotName: { contains: query.search, mode: 'insensitive' } },
              { location: { displayName: { contains: query.search, mode: 'insensitive' } } },
            ],
          },
        ];
      }

      const [quants, total] = await Promise.all([
        this.prisma.quant.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ location: { displayName: 'asc' } }, { id: 'asc' }],
          include: {
            inventory: true,
            location: true,
          },
        }),
        this.prisma.quant.count({ where }),
      ]);

      const stats = await this.prisma.quant.aggregate({
        where,
        _sum: {
          quantity: true,
          secondaryUnitQty: true,
        },
      });

      const uniqueSkus = await this.prisma.quant.groupBy({
        by: ['inventoryId'],
        where,
      });

      const uniqueLots = await this.prisma.quant.groupBy({
        by: ['lotName'],
        where,
      });

      const now = new Date();
      const data = quants.map((q) => {
        const lotInfo = this.parseLotInfo(q.lotName);
        return {
          uuid: q.uuid,
          productName: q.inventory?.name || '-',
          sku: q.inventory?.sku || '-',
          lot: q.lotName || '-',
          shelfLife: lotInfo.shelfAge,
          expiredDate: lotInfo.expiredDate,
          placement: lotInfo.placement,
          placementDate: null,
          snapshotDate: now,
          locationName: q.location?.displayName || '-',
          quantity: q.quantity,
          quantum: q.secondaryUnitQty || 0,
          uom: q.inventory?.uom || '-',
          spraying: null,
          fumigasi: null,
          fogging: null,
          keterangan: null,
          isPublished: true,
          dataSource: 'REAL_STOCK',
        };
      });

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        summary: {
          totalSkus: uniqueSkus.length,
          totalLots: uniqueLots.length,
          totalQuantity: stats._sum.quantity || 0,
          totalQuantum: stats._sum.secondaryUnitQty || 0,
        },
      };
    }

    const page = query.page ? parseInt(query.page as string, 10) : 1;
    const limit = query.limit ? parseInt(query.limit as string, 10) : 10;
    const skip = (page - 1) * limit;

    const where: any = {
      warehouseId,
    };

    // Filter locationName
    if (query.locationName) {
      where.locationName = query.locationName;
    }

    // Filter snapshotDate
    if (query.snapshotDate) {
      const snapDate = new Date(query.snapshotDate);
      if (!isNaN(snapDate.getTime())) {
        where.snapshotDate = snapDate;
      }
    }

    // Filter status publish
    if (query.isPublished === 'true') {
      where.isPublished = true;
    } else if (query.isPublished === 'false') {
      where.isPublished = false;
    }

    // Search query
    if (query.search) {
      where.AND = [
        {
          OR: [
            { productName: { contains: query.search, mode: 'insensitive' } },
            { sku: { contains: query.search, mode: 'insensitive' } },
            { lot: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.stackCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ placementDate: 'desc' }, { id: 'asc' }],
        include: {
          warehouse: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.stackCard.count({ where }),
    ]);

    // Calculate sum statistics for the query
    const stats = await this.prisma.stackCard.aggregate({
      where,
      _sum: {
        quantity: true,
        quantum: true,
      },
      _count: {
        sku: true,
        lot: true,
      },
    });

    // Count unique lots and SKUs by grouping if necessary
    const uniqueSkus = await this.prisma.stackCard.groupBy({
      by: ['sku'],
      where,
    });
    const uniqueLots = await this.prisma.stackCard.groupBy({
      by: ['lot'],
      where,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalSkus: uniqueSkus.length,
        totalLots: uniqueLots.length,
        totalQuantity: stats._sum.quantity || 0,
        totalQuantum: stats._sum.quantum || 0,
      },
    };
  }

  async findOne(warehouseId: number, uuid: string) {
    const record = await this.prisma.stackCard.findFirst({
      where: {
        uuid,
        warehouseId,
      },
    });
    if (!record) {
      throw new NotFoundException('Data kartu tumpukan tidak ditemukan.');
    }
    return record;
  }

  async update(
    warehouseId: number,
    uuid: string,
    data: UpdateStackCardInput,
  ) {
    const record = await this.findOne(warehouseId, uuid);

    const placementDateParsed = new Date(data.placementDate);
    if (isNaN(placementDateParsed.getTime())) {
      throw new BadRequestException('Format tanggal penempatan tidak valid.');
    }

    let expiredDateParsed: Date | null = null;
    if (data.expiredDate) {
      expiredDateParsed = new Date(data.expiredDate);
      if (isNaN(expiredDateParsed.getTime())) {
        throw new BadRequestException('Format tanggal expired tidak valid.');
      }
    }

    return this.prisma.stackCard.update({
      where: { id: record.id },
      data: {
        productName: data.productName,
        sku: data.sku,
        lot: data.lot,
        shelfLife: data.shelfLife,
        expiredDate: expiredDateParsed,
        placementDate: placementDateParsed,
        locationName: data.locationName,
        quantity: data.quantity,
        quantum: data.quantum,
        uom: data.uom,
        spraying: data.spraying || null,
        fumigasi: data.fumigasi || null,
        fogging: data.fogging || null,
        keterangan: data.keterangan || null,
        isPublished: data.isPublished !== undefined ? data.isPublished : record.isPublished,
      },
    });
  }

  async delete(warehouseId: number, uuid: string) {
    const record = await this.findOne(warehouseId, uuid);
    await this.prisma.stackCard.delete({
      where: { id: record.id },
    });
    return { success: true, message: 'Data kartu tumpukan berhasil dihapus.' };
  }

  async bulkDelete(warehouseId: number, uuids: string[]) {
    const result = await this.prisma.stackCard.deleteMany({
      where: {
        warehouseId,
        uuid: { in: uuids },
      },
    });
    return {
      success: true,
      message: `Berhasil menghapus ${result.count} data kartu tumpukan.`,
    };
  }

  async bulkPublish(
    warehouseId: number,
    uuids: string[],
    isPublished: boolean,
  ) {
    const result = await this.prisma.stackCard.updateMany({
      where: {
        warehouseId,
        uuid: { in: uuids },
      },
      data: {
        isPublished,
      },
    });
    return {
      success: true,
      message: `Berhasil memperbarui status publikasi ${result.count} data kartu tumpukan.`,
    };
  }

  async publishSnapshot(
    warehouseId: number,
    snapshotDateStr: string,
    isPublished: boolean,
  ) {
    const snapDate = new Date(snapshotDateStr);
    if (isNaN(snapDate.getTime())) {
      throw new BadRequestException('Format tanggal snapshot tidak valid.');
    }

    const result = await this.prisma.stackCard.updateMany({
      where: {
        warehouseId,
        snapshotDate: snapDate,
      },
      data: {
        isPublished,
      },
    });

    return {
      success: true,
      message: `Berhasil ${
        isPublished ? 'mempublikasikan' : 'membatalkan publikasi'
      } ${result.count} data kartu tumpukan untuk tanggal snapshot ${snapshotDateStr}.`,
    };
  }

  async getUploadHistory(warehouseId: number) {
    return this.prisma.stackCardUploadLog.findMany({
      where: { warehouseId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        uploadedBy: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  async getSnapshotDates(
    warehouseId: number,
    onlyPublished = false,
    dataSource?: 'REAL_STOCK' | 'CSV',
  ) {
    let effectiveDataSource = dataSource;
    if (!effectiveDataSource) {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { kartuTumpukanSource: true },
      });
      effectiveDataSource = warehouse?.kartuTumpukanSource || 'CSV';
    }

    if (effectiveDataSource === 'REAL_STOCK') {
      return [new Date().toISOString()];
    }

    const where: any = { warehouseId };
    if (onlyPublished) {
      where.isPublished = true;
    }

    const dates = await this.prisma.stackCard.findMany({
      where,
      select: {
        snapshotDate: true,
      },
      distinct: ['snapshotDate'],
      orderBy: {
        snapshotDate: 'desc',
      },
    });

    return dates.map((d) => d.snapshotDate);
  }

  async getLocations(warehouseId: number, onlyPublished = false, dataSource?: 'REAL_STOCK' | 'CSV') {
    let effectiveDataSource = dataSource;
    if (!effectiveDataSource) {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { kartuTumpukanSource: true },
      });
      effectiveDataSource = warehouse?.kartuTumpukanSource || 'CSV';
    }

    if (effectiveDataSource === 'REAL_STOCK') {
      const locations = await this.prisma.location.findMany({
        where: {
          warehouseId,
          quants: {
            some: {
              quantity: { gt: 0 },
            },
          },
        },
        select: {
          displayName: true,
        },
        orderBy: {
          displayName: 'asc',
        },
      });

      return locations.map((l) => l.displayName);
    }

    const where: any = { warehouseId };
    if (onlyPublished) {
      where.isPublished = true;
    }

    const locations = await this.prisma.stackCard.findMany({
      where,
      select: {
        locationName: true,
      },
      distinct: ['locationName'],
      orderBy: {
        locationName: 'asc',
      },
    });

    return locations.map((l) => l.locationName);
  }

  async updateKartuTumpukanSource(warehouseId: number, source: 'REAL_STOCK' | 'CSV') {
    const warehouse = await this.prisma.warehouse.update({
      where: { id: warehouseId },
      data: { kartuTumpukanSource: source },
    });
    return {
      success: true,
      message: `Sumber data kartu tumpukan untuk gudang ${warehouse.name} berhasil diperbarui ke ${source}.`,
      data: warehouse,
    };
  }
}


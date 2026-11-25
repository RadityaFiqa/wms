import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import {
  ImportStackCardInput,
  UpdateStackCardInput,
  StackCardQueryInput,
  KARTU_TUMPUKAN_KANWIL,
  KARTU_TUMPUKAN_SIGN_CITY,
} from '@bulog-wms/schema';
import * as ExcelJS from 'exceljs';
import {
  findLatestTreatmentDates,
  laterDate,
  toMakassarDate,
} from '@/modules/spk-perawatan/spk-matching.util';

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
              {
                inventory: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                inventory: {
                  sku: { contains: query.search, mode: 'insensitive' },
                },
              },
              { lotName: { contains: query.search, mode: 'insensitive' } },
              {
                location: {
                  displayName: { contains: query.search, mode: 'insensitive' },
                },
              },
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
            location: {
              include: { warehouse: { select: { name: true } } },
            },
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
      const inboundDates = await this.findInboundDates(warehouseId, quants);
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
          // Tanggal penempatan is the date of the IN document that brought the lot in
          placementDate: inboundDates.get(q.id) ?? null,
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
          warehouse: { name: q.location?.warehouse?.name || '' },
        };
      });

      return {
        data: await this.withSpkTreatments(warehouseId, data),
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
      data: await this.withSpkTreatments(warehouseId, data),
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

  /**
   * Date of the done incoming (IN) document of each quant's product + lot, keyed by
   * quant id. The earliest IN into the quant's own location wins; when the lot was
   * received elsewhere (then moved), the earliest IN of the lot is used.
   */
  private async findInboundDates(
    warehouseId: number,
    quants: {
      id: number;
      inventoryId: number;
      locationId: number;
      lotName: string | null;
    }[],
  ): Promise<Map<number, Date>> {
    const result = new Map<number, Date>();
    const lotted = quants.filter((q) => q.lotName);
    if (!lotted.length) return result;

    const moveLines = await this.prisma.documentReferenceMoveLine.findMany({
      where: {
        inventoryId: { in: Array.from(new Set(lotted.map((q) => q.inventoryId))) },
        lotName: { in: Array.from(new Set(lotted.map((q) => q.lotName!))) },
        documentReference: {
          warehouseId,
          state: 'done',
          pickingTypeCode: 'incoming',
        },
      },
      select: {
        inventoryId: true,
        lotName: true,
        destinationLocationId: true,
        date: true,
        documentReference: { select: { dateDone: true, scheduledDate: true } },
      },
    });

    const earliest = (dates: (Date | null)[]) =>
      dates
        .filter((d): d is Date => !!d)
        .reduce<Date | null>((min, d) => (!min || d < min ? d : min), null);

    for (const q of lotted) {
      const lines = moveLines.filter(
        (ml) => ml.inventoryId === q.inventoryId && ml.lotName === q.lotName,
      );
      const dateOf = (ml: (typeof lines)[number]) =>
        ml.documentReference.dateDone ??
        ml.date ??
        ml.documentReference.scheduledDate;
      const here = lines.filter((ml) => ml.destinationLocationId === q.locationId);
      const date = earliest((here.length ? here : lines).map(dateOf));
      if (date) result.set(q.id, date);
    }
    return result;
  }

  /**
   * Fills spraying / fumigasi / fogging with the latest SPK Perawatan date of the
   * same product + lot, keeping a manually entered date when it is later.
   */
  private async withSpkTreatments<
    T extends {
      productName: string;
      sku: string;
      lot: string;
      spraying: string | null;
      fumigasi: string | null;
      fogging: string | null;
    },
  >(warehouseId: number, rows: T[]): Promise<T[]> {
    const dates = await findLatestTreatmentDates(this.prisma, warehouseId, rows);
    return rows.map((row, i) => ({
      ...row,
      spraying: laterDate(row.spraying, dates[i].spraying),
      fumigasi: laterDate(row.fumigasi, dates[i].fumigasi),
      fogging: laterDate(row.fogging, dates[i].fogging),
    }));
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

  async update(warehouseId: number, uuid: string, data: UpdateStackCardInput) {
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
        isPublished:
          data.isPublished !== undefined
            ? data.isPublished
            : record.isPublished,
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

  async getLocations(
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

  /**
   * Spreadsheet of the kartu tumpukan with the same filters as the list (all pages),
   * laid out like the official printed Kartu Tumpukan sheet, treatment dates
   * included from SPK Perawatan.
   */
  async exportXlsx(
    warehouseId: number,
    query: StackCardQueryInput,
    printedBy?: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const [warehouse, result] = await Promise.all([
      this.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { name: true, kartuTumpukanSource: true },
      }),
      this.findAll(warehouseId, { ...query, page: 1, limit: 1_000_000 }),
    ]);
    const isRealStock =
      (query.dataSource ?? warehouse?.kartuTumpukanSource) === 'REAL_STOCK';
    const rows = result.data as any[];
    const warehouseName = warehouse?.name ?? '';
    const dots = '..............................';

    const pad2 = (n: number) => String(n).padStart(2, '0');
    /** dd/mm/yyyy in the warehouse timezone, like the printed sheet */
    const printDate = (value: unknown): string => {
      if (!value || value === '-') return '';
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split('-');
        return `${d}/${m}/${y}`;
      }
      const date = new Date(value as string | Date);
      if (isNaN(date.getTime())) return String(value);
      const [y, m, d] = toMakassarDate(date).split('-');
      return `${d}/${m}/${y}`;
    };

    const sheetDate =
      !isRealStock &&
      query.snapshotDate &&
      !isNaN(Date.parse(query.snapshotDate))
        ? new Date(query.snapshotDate)
        : new Date();
    const [sy, sm, sd] = toMakassarDate(sheetDate).split('-').map(Number);
    const longDate = new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(sy, sm - 1, sd)));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bulog WMS';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Kartu Tumpukan', {
      pageSetup: {
        orientation: 'landscape',
        paperSize: 9, // A4
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    // Column widths follow the printed sheet proportions
    const widths = [5, 40, 13, 26, 8, 13, 18, 16, 12, 12, 11, 12, 12, 12, 22];
    widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));
    const font: Partial<ExcelJS.Font> = { name: 'Arial', size: 10 };
    const border: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    const numFmt = '#,##0.##';

    // Title block
    const titles = [
      'KARTU TUMPUKAN',
      `KANTOR WILAYAH ${KARTU_TUMPUKAN_KANWIL}`,
      (warehouseName || dots).toUpperCase(),
      `PER TANGGAL ${pad2(sd)}/${pad2(sm)}/${sy}`,
    ];
    titles.forEach((text, i) => {
      sheet.mergeCells(i + 1, 1, i + 1, 15);
      const cell = sheet.getCell(i + 1, 1);
      cell.value = text;
      cell.font = { ...font, size: 12, bold: true };
      cell.alignment = { horizontal: 'center' };
    });

    // Two-level header
    const h1 = titles.length + 2;
    const h2 = h1 + 1;
    const single: [number, string][] = [
      [1, 'No'],
      [2, 'Produk'],
      [3, 'SKU'],
      [4, 'Lot'],
      [5, 'Umur Simpan'],
      [6, 'Expired Date/Best'],
      [7, 'Tanggal Penempatan'],
      [8, 'Lokasi'],
      [15, 'Keterangan'],
    ];
    for (const [col, text] of single) {
      sheet.mergeCells(h1, col, h2, col);
      sheet.getCell(h1, col).value = text;
    }
    sheet.mergeCells(h1, 9, h1, 11);
    sheet.getCell(h1, 9).value = 'Persediaan Fisik';
    sheet.mergeCells(h1, 12, h1, 14);
    sheet.getCell(h1, 12).value = 'Tanggal Perawatan';
    ['Kuantitas', 'Kuantum', 'UoM', 'Spraying', 'Fumigasi', 'Fogging'].forEach(
      (text, i) => (sheet.getCell(h2, 9 + i).value = text),
    );
    for (const r of [h1, h2]) {
      for (let c = 1; c <= 15; c++) {
        const cell = sheet.getCell(r, c);
        cell.font = font;
        cell.border = border;
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true,
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFBFC4C9' },
        };
      }
    }

    // Data rows
    rows.forEach((r, i) => {
      const values: (string | number | null)[] = [
        i + 1,
        r.productName,
        r.sku,
        r.lot,
        r.shelfLife ?? '',
        printDate(r.expiredDate),
        r.placementDate ? printDate(r.placementDate) : (r.placement ?? ''),
        r.locationName,
        r.quantity ?? 0,
        r.quantum ?? 0,
        r.uom,
        printDate(r.spraying),
        printDate(r.fumigasi),
        printDate(r.fogging),
        r.keterangan ?? '',
      ];
      const rowNo = h2 + 1 + i;
      values.forEach((value, c) => {
        const cell = sheet.getCell(rowNo, c + 1);
        cell.value = value ?? '';
        cell.font = font;
        cell.border = border;
        cell.alignment = { vertical: 'middle', wrapText: true };
        if (c === 8 || c === 9) cell.numFmt = numFmt;
      });
    });

    // JUMLAH row
    const totalRow = h2 + rows.length + 1;
    sheet.mergeCells(totalRow, 2, totalRow, 8);
    sheet.getCell(totalRow, 2).value = 'JUMLAH';
    sheet.getCell(totalRow, 9).value = result.summary.totalQuantity;
    sheet.getCell(totalRow, 10).value = result.summary.totalQuantum;
    for (let c = 1; c <= 15; c++) {
      const cell = sheet.getCell(totalRow, c);
      cell.font = { ...font, bold: true };
      cell.border = border;
      cell.alignment = c === 2 ? { horizontal: 'center' } : {};
      if (c === 9 || c === 10) cell.numFmt = numFmt;
    }

    // Signature block: right side starts where "Spraying" starts
    const sign = totalRow + 2;
    const printedByCell = sheet.getCell(sign + 6, 1);
    printedByCell.value = `Dicetak Oleh : ${printedBy || dots}`;
    printedByCell.font = font;
    const signLines: [number, string, Partial<ExcelJS.Font>?][] = [
      [sign, `${KARTU_TUMPUKAN_SIGN_CITY}, ${longDate}`],
      [sign + 1, (warehouseName || dots).toUpperCase()],
      [sign + 5, `( ${dots} )`, { underline: true }],
      [sign + 6, 'Kepala Gudang'],
    ];
    for (const [row, text, extra] of signLines) {
      sheet.mergeCells(row, 12, row, 15);
      const cell = sheet.getCell(row, 12);
      cell.value = text;
      cell.font = { ...font, ...extra };
    }

    sheet.views = [{ state: 'frozen', ySplit: h2 }];

    const location = query.locationName
      ? `-${query.locationName.replace(/[^\w.-]+/g, '_')}`
      : '';
    return {
      filename: `kartu-tumpukan${location}-${sy}-${pad2(sm)}-${pad2(sd)}.xlsx`,
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    };
  }

  /**
   * Calculator rows and note of a tumpukan from the most recent completed
   * Stock Opname that has a non-empty calculation for it, or null if none.
   */
  async getLatestOpnameCalculation(warehouseId: number, locationName: string) {
    const stacks = await this.prisma.stockOpnameStack.findMany({
      where: {
        locationName,
        item: { stockOpname: { warehouseId, status: 'COMPLETED' } },
      },
      select: {
        actualQty: true,
        calculationRows: true,
        note: true,
        item: {
          select: {
            productUom: true,
            stockOpname: {
              select: {
                id: true,
                uuid: true,
                opnameNumber: true,
                completionDate: true,
              },
            },
          },
        },
      },
      orderBy: [
        { item: { stockOpname: { completionDate: 'desc' } } },
        { id: 'asc' },
      ],
    });

    const parseRows = (value: unknown) =>
      Array.isArray(value)
        ? value.flatMap((r) =>
            r &&
            typeof r === 'object' &&
            typeof (r as any).expression === 'string' &&
            (r as any).expression.trim() !== ''
              ? [
                  {
                    expression: (r as any).expression as string,
                    result: Number((r as any).result) || 0,
                  },
                ]
              : [],
          )
        : [];

    // Stacks are ordered newest opname first; use the first one with rows
    const latest = stacks.find((st) => parseRows(st.calculationRows).length);
    if (!latest) return null;

    const opname = latest.item.stockOpname;
    const sameOpname = stacks.filter(
      (st) => st.item.stockOpname.id === opname.id,
    );
    const counted = sameOpname.filter((st) => st.actualQty !== null);
    const notes = Array.from(
      new Set(
        sameOpname.map((st) => st.note?.trim()).filter((n): n is string => !!n),
      ),
    );

    return {
      opnameUuid: opname.uuid,
      opnameNumber: opname.opnameNumber,
      completionDate: opname.completionDate,
      uom: latest.item.productUom,
      calculations: sameOpname.flatMap((st) => parseRows(st.calculationRows)),
      total: counted.reduce((sum, st) => sum + (st.actualQty ?? 0), 0),
      note: notes.length ? notes.join('; ') : null,
    };
  }

  async updateKartuTumpukanSource(
    warehouseId: number,
    source: 'REAL_STOCK' | 'CSV',
  ) {
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

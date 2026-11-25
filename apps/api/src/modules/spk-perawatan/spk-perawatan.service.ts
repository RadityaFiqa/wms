import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '@/core/prisma/prisma.service';
import { OdooSyncService } from '@/modules/odoo/odoo-sync.service';
import {
  SPK_TREATMENT_TYPES,
  findLatestTreatmentDates,
  normalizeText,
  spkProductMatches,
  toMakassarDate,
} from '@/modules/spk-perawatan/spk-matching.util';
import type {
  SpkPerawatanExportQueryInput,
  SpkPerawatanItem,
  SpkPerawatanListResponse,
  SpkPerawatanQueryInput,
  SpkPerawatanSyncResult,
  SpkRelatedStack,
  SpkTreatmentType,
} from '@bulog-wms/schema';

const ODOO_MODEL = 'vit.spk_perawatan';
const PAGE_SIZE = 200;
const READ_BATCH = 50;

const TREATMENT_LABEL: Record<SpkTreatmentType, string> = {
  SPRAYING: 'Spraying',
  FUMIGASI: 'Fumigasi',
  FOGGING: 'Fogging',
};

/** Odoo field holding each treatment */
const TREATMENT_ODOO_FIELD: Record<SpkTreatmentType, string> = {
  SPRAYING: 'type_spraying',
  FUMIGASI: 'type_fumigasi',
  FOGGING: 'type_fogging',
};

const READ_SPECIFICATION = {
  state: {},
  name: {},
  date: {},
  weekly_id: { fields: { display_name: {} } },
  location_id: { fields: { display_name: {} } },
  type: {},
  nama_surat_pemohon: {},
  jabatan_pihak_pertama: {},
  type_spraying: {},
  type_fumigasi: {},
  type_fogging: {},
  spk_line_ids: {
    fields: {
      product_id: { fields: { display_name: {} } },
      lot_id: { fields: { display_name: {} } },
      jumlah_stock: {},
    },
  },
  display_name: {},
};

const spkInclude = {
  lines: { orderBy: { id: 'asc' } },
} satisfies Prisma.SpkPerawatanInclude;

type SpkWithLines = Prisma.SpkPerawatanGetPayload<{
  include: typeof spkInclude;
}>;

interface ParsedSpk {
  odooId: number;
  name: string;
  state: string | null;
  date: Date | null;
  weeklyName: string | null;
  locationName: string | null;
  namaSuratPemohon: string | null;
  jabatanPihakPertama: string | null;
  treatmentTypes: SpkTreatmentType[];
  typeSpraying: string | null;
  typeFumigasi: string | null;
  typeFogging: string | null;
  lines: {
    productName: string;
    lotName: string | null;
    jumlahStock: number | null;
  }[];
}

interface StackRow {
  productName: string;
  sku: string;
  lot: string;
  locationName: string;
  quantity: number;
  uom: string | null;
}

@Injectable()
export class SpkPerawatanService {
  private readonly logger = new Logger(SpkPerawatanService.name);
  private readonly runningSyncs = new Set<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooSyncService: OdooSyncService,
  ) {}

  /** Re-sync every active commodity warehouse a few times a day */
  @Cron('15 6-18/3 * * *', { timeZone: 'Asia/Makassar' })
  async syncAllWarehouses() {
    const accounts = await this.prisma.odooAccount.findMany({
      where: { isActive: true, isNonCommodity: false },
      select: { warehouseId: true },
    });
    for (const { warehouseId } of accounts) {
      await this.sync(warehouseId).catch((err) =>
        this.logger.error(
          `[SPK-PERAWATAN] Sinkronisasi otomatis gudang ${warehouseId} gagal: ${err.message}`,
        ),
      );
    }
  }

  /** Pulls every SPK Perawatan "usulan" of the warehouse from Odoo and replaces the local copy */
  async sync(warehouseId: number): Promise<SpkPerawatanSyncResult> {
    if (this.runningSyncs.has(warehouseId)) {
      throw new BadRequestException(
        'Sinkronisasi SPK Perawatan untuk gudang ini sedang berjalan.',
      );
    }

    const account = await this.prisma.odooAccount.findFirst({
      where: { warehouseId, isNonCommodity: false },
    });
    if (!account) {
      throw new NotFoundException(
        'Akun Odoo untuk gudang aktif ini belum dikonfigurasi.',
      );
    }
    if (!account.isActive) {
      throw new BadRequestException('Akun Odoo untuk gudang ini tidak aktif.');
    }

    this.runningSyncs.add(warehouseId);
    try {
      const context = await this.odooSyncService.getUserContext(
        warehouseId,
        account.username,
      );
      const records = await this.fetchFromOdoo(warehouseId, context);
      const parsed = records.map((r) => this.parseRecord(r));
      const syncedAt = new Date();

      const removed = await this.prisma.$transaction(
        async (tx) => {
          for (const spk of parsed) {
            const { lines, odooId, ...data } = spk;
            const saved = await tx.spkPerawatan.upsert({
              where: { warehouseId_odooId: { warehouseId, odooId } },
              create: { ...data, odooId, warehouseId, syncedAt },
              update: { ...data, syncedAt },
              select: { id: true },
            });
            await tx.spkPerawatanLine.deleteMany({
              where: { spkPerawatanId: saved.id },
            });
            if (lines.length) {
              await tx.spkPerawatanLine.createMany({
                data: lines.map((l) => ({ ...l, spkPerawatanId: saved.id })),
              });
            }
          }

          // SPK deleted in Odoo (or no longer "usulan") are dropped
          const { count } = await tx.spkPerawatan.deleteMany({
            where: {
              warehouseId,
              odooId: { notIn: parsed.map((p) => p.odooId) },
            },
          });
          return count;
        },
        { timeout: 300_000 },
      );

      const lineCount = parsed.reduce((sum, p) => sum + p.lines.length, 0);
      this.logger.log(
        `[SPK-PERAWATAN] Gudang ${warehouseId}: ${parsed.length} SPK, ${lineCount} baris, ${removed} dihapus`,
      );
      return {
        message: `Berhasil menyinkronkan ${parsed.length} SPK Perawatan (${lineCount} baris produk).`,
        total: parsed.length,
        lines: lineCount,
        removed,
      };
    } finally {
      this.runningSyncs.delete(warehouseId);
    }
  }

  async findAll(
    warehouseId: number,
    query: SpkPerawatanQueryInput,
  ): Promise<SpkPerawatanListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildWhere(warehouseId, query);

    const [records, total, latest] = await Promise.all([
      this.prisma.spkPerawatan.findMany({
        where,
        include: spkInclude,
        orderBy: [{ date: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.spkPerawatan.count({ where }),
      this.prisma.spkPerawatan.findFirst({
        where: { warehouseId },
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      }),
    ]);

    return {
      data: await this.toItems(warehouseId, records),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      lastSyncedAt: latest?.syncedAt.toISOString() ?? null,
    };
  }

  /** Spreadsheet of the filtered SPK lines and the latest treatment of each related stack */
  async exportXlsx(
    warehouseId: number,
    query: SpkPerawatanExportQueryInput,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const [warehouse, records] = await Promise.all([
      this.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { name: true },
      }),
      this.prisma.spkPerawatan.findMany({
        where: this.buildWhere(warehouseId, query),
        include: spkInclude,
        orderBy: [{ date: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      }),
    ]);
    const items = await this.toItems(warehouseId, records);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bulog WMS';
    workbook.created = new Date();

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    const border: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    const printedAt = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Makassar',
    }).format(new Date());

    const writeSheet = (
      name: string,
      title: string,
      columns: { header: string; width: number; numFmt?: string }[],
      rows: (string | number | Date | null)[][],
    ) => {
      const sheet = workbook.addWorksheet(name);
      const lastCol = sheet.getColumn(columns.length).letter;
      const titleLines = [
        title,
        `Gudang: ${warehouse?.name ?? '-'}`,
        `Dicetak: ${printedAt}`,
      ];
      titleLines.forEach((text, i) => {
        sheet.mergeCells(`A${i + 1}:${lastCol}${i + 1}`);
        const cell = sheet.getCell(`A${i + 1}`);
        cell.value = text;
        cell.font = { size: i === 0 ? 12 : 10, bold: i === 0 };
      });

      const headerRowNo = titleLines.length + 2;
      const header = sheet.getRow(headerRowNo);
      columns.forEach((col, i) => {
        sheet.getColumn(i + 1).width = col.width;
        const cell = header.getCell(i + 1);
        cell.value = col.header;
        cell.font = { bold: true };
        cell.fill = headerFill;
        cell.border = border;
        cell.alignment = { vertical: 'middle', wrapText: true };
      });

      rows.forEach((values, r) => {
        const row = sheet.getRow(headerRowNo + 1 + r);
        values.forEach((value, c) => {
          const cell = row.getCell(c + 1);
          cell.value = value ?? '';
          cell.border = border;
          cell.alignment = { vertical: 'top', wrapText: true };
          if (columns[c].numFmt) cell.numFmt = columns[c].numFmt!;
        });
      });

      sheet.autoFilter = {
        from: { row: headerRowNo, column: 1 },
        to: { row: headerRowNo, column: columns.length },
      };
      sheet.views = [{ state: 'frozen', ySplit: headerRowNo }];
    };

    const day = (iso: string | null) =>
      iso ? toMakassarDate(new Date(iso)) : null;
    const stackText = (stacks: SpkRelatedStack[]) =>
      stacks.length
        ? stacks.map((s) => `${s.locationName} (${s.quantity} ${s.uom})`).join('\n')
        : 'Tidak ada di kartu tumpukan';

    let no = 0;
    const spkRows = items.flatMap((spk) => {
      const common = [
        spk.name,
        day(spk.date),
        spk.state,
        spk.weeklyName,
        spk.locationName,
        spk.namaSuratPemohon,
        spk.jabatanPihakPertama,
        this.treatmentText(spk),
      ];
      if (!spk.lines.length) return [[++no, ...common, null, null, null, null]];
      return spk.lines.map((line) => [
        ++no,
        ...common,
        line.productName,
        line.lotName,
        line.jumlahStock,
        stackText(line.relatedStacks),
      ]);
    });

    writeSheet(
      'SPK Perawatan',
      'SPK PERAWATAN (USULAN)',
      [
        { header: 'No', width: 6 },
        { header: 'Nomor SPK', width: 24 },
        { header: 'Tanggal', width: 12 },
        { header: 'Status', width: 12 },
        { header: 'Mingguan', width: 22 },
        { header: 'Lokasi', width: 24 },
        { header: 'Nama Surat Pemohon', width: 26 },
        { header: 'Jabatan Pihak Pertama', width: 26 },
        { header: 'Jenis Perawatan', width: 22 },
        { header: 'Produk', width: 36 },
        { header: 'Lot', width: 36 },
        { header: 'Jumlah Stok', width: 14, numFmt: '#,##0.##' },
        { header: 'Tumpukan Terkait', width: 32 },
      ],
      spkRows,
    );

    // One row per related stack (location + product + lot) with its latest treatments
    const stacks = new Map<string, StackRow>();
    for (const spk of items) {
      for (const line of spk.lines) {
        for (const s of line.relatedStacks) {
          const key = [s.locationName, line.productName, line.lotName]
            .map(normalizeText)
            .join('|');
          if (!stacks.has(key)) {
            stacks.set(key, {
              productName: line.productName,
              sku: '',
              lot: line.lotName ?? '',
              locationName: s.locationName,
              quantity: s.quantity,
              uom: s.uom,
            });
          }
        }
      }
    }
    const stackList = Array.from(stacks.values()).sort(
      (a, b) =>
        a.locationName.localeCompare(b.locationName) ||
        a.productName.localeCompare(b.productName),
    );
    const dates = await findLatestTreatmentDates(
      this.prisma,
      warehouseId,
      stackList,
    );
    writeSheet(
      'Tumpukan Terkait',
      'TANGGAL PERAWATAN TERAKHIR PER TUMPUKAN',
      [
        { header: 'No', width: 6 },
        { header: 'Tumpukan', width: 26 },
        { header: 'Produk', width: 36 },
        { header: 'Lot', width: 36 },
        { header: 'Kuantitas', width: 14, numFmt: '#,##0.##' },
        { header: 'UoM', width: 12 },
        { header: 'Spraying', width: 13 },
        { header: 'Fumigasi', width: 13 },
        { header: 'Fogging', width: 13 },
      ],
      stackList.map((s, i) => [
        i + 1,
        s.locationName,
        s.productName,
        s.lot,
        s.quantity,
        s.uom,
        dates[i].spraying,
        dates[i].fumigasi,
        dates[i].fogging,
      ]),
    );

    return {
      filename: `spk-perawatan-${toMakassarDate(new Date())}.xlsx`,
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    };
  }

  private treatmentText(spk: SpkPerawatanItem): string {
    const raw: Record<SpkTreatmentType, string | null> = {
      SPRAYING: spk.typeSpraying,
      FUMIGASI: spk.typeFumigasi,
      FOGGING: spk.typeFogging,
    };
    return spk.treatmentTypes
      .map((t) =>
        raw[t] && normalizeText(raw[t]) !== normalizeText(TREATMENT_LABEL[t])
          ? `${TREATMENT_LABEL[t]} (${raw[t]})`
          : TREATMENT_LABEL[t],
      )
      .join(', ');
  }

  private buildWhere(
    warehouseId: number,
    query: SpkPerawatanExportQueryInput,
  ): Prisma.SpkPerawatanWhereInput {
    const where: Prisma.SpkPerawatanWhereInput = { warehouseId };
    const search = query.search?.trim();
    if (search) {
      const contains = { contains: search, mode: 'insensitive' as const };
      where.OR = [
        { name: contains },
        { weeklyName: contains },
        { locationName: contains },
        { namaSuratPemohon: contains },
        { lines: { some: { productName: contains } } },
        { lines: { some: { lotName: contains } } },
      ];
    }
    if (query.treatmentType) {
      where.treatmentTypes = { has: query.treatmentType };
    }
    if (query.dateFrom || query.dateTo) {
      where.date = {
        ...(query.dateFrom && {
          gte: new Date(`${query.dateFrom}T00:00:00+08:00`),
        }),
        ...(query.dateTo && {
          lte: new Date(`${query.dateTo}T23:59:59.999+08:00`),
        }),
      };
    }
    return where;
  }

  private async toItems(
    warehouseId: number,
    records: SpkWithLines[],
  ): Promise<SpkPerawatanItem[]> {
    const stacks = await this.findStacksByLot(
      warehouseId,
      records.flatMap((r) => r.lines.map((l) => l.lotName)),
    );

    return records.map((r) => ({
      uuid: r.uuid,
      name: r.name,
      state: r.state,
      date: r.date?.toISOString() ?? null,
      weeklyName: r.weeklyName,
      locationName: r.locationName,
      namaSuratPemohon: r.namaSuratPemohon,
      jabatanPihakPertama: r.jabatanPihakPertama,
      treatmentTypes: r.treatmentTypes as SpkTreatmentType[],
      typeSpraying: r.typeSpraying,
      typeFumigasi: r.typeFumigasi,
      typeFogging: r.typeFogging,
      syncedAt: r.syncedAt.toISOString(),
      lines: r.lines.map((l) => ({
        productName: l.productName,
        lotName: l.lotName,
        jumlahStock: l.jumlahStock,
        relatedStacks: (stacks.get(normalizeText(l.lotName)) ?? [])
          .filter((s) =>
            spkProductMatches(l.productName, {
              name: s.productName,
              sku: s.sku,
            }),
          )
          .map(({ locationName, quantity, uom }) => ({
            locationName,
            quantity,
            uom: uom ?? '-',
          })),
      })),
    }));
  }

  /**
   * Kartu tumpukan rows holding the given lots, grouped by normalized lot, from the
   * warehouse's kartu tumpukan source (real stock, or the latest CSV snapshot).
   */
  private async findStacksByLot(
    warehouseId: number,
    lotNames: (string | null)[],
  ): Promise<Map<string, StackRow[]>> {
    const lots = Array.from(
      new Set(lotNames.map((l) => l?.trim()).filter((l): l is string => !!l)),
    );
    const byLot = new Map<string, StackRow[]>();
    if (!lots.length) return byLot;

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { kartuTumpukanSource: true },
    });

    let rows: StackRow[] = [];
    if (warehouse?.kartuTumpukanSource === 'REAL_STOCK') {
      const quants = await this.prisma.quant.findMany({
        where: {
          quantity: { gt: 0 },
          location: { warehouseId },
          lotName: { in: lots, mode: 'insensitive' },
        },
        include: { inventory: true, location: true },
        orderBy: { location: { displayName: 'asc' } },
      });
      rows = quants.map((q) => ({
        productName: q.inventory.name,
        sku: q.inventory.sku,
        lot: q.lotName ?? '',
        locationName: q.location.displayName,
        quantity: q.quantity,
        uom: q.inventory.uom,
      }));
    } else {
      const latest = await this.prisma.stackCard.findFirst({
        where: { warehouseId },
        orderBy: { snapshotDate: 'desc' },
        select: { snapshotDate: true },
      });
      if (latest) {
        rows = await this.prisma.stackCard.findMany({
          where: {
            warehouseId,
            snapshotDate: latest.snapshotDate,
            lot: { in: lots, mode: 'insensitive' },
          },
          select: {
            productName: true,
            sku: true,
            lot: true,
            locationName: true,
            quantity: true,
            uom: true,
          },
          orderBy: { locationName: 'asc' },
        });
      }
    }

    for (const row of rows) {
      const key = normalizeText(row.lot);
      byLot.set(key, [...(byLot.get(key) ?? []), row]);
    }
    return byLot;
  }

  private async fetchFromOdoo(
    warehouseId: number,
    context: Record<string, unknown>,
  ): Promise<any[]> {
    const ids: number[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const res = await this.odooSyncService.safeOdooCall(
        warehouseId,
        ODOO_MODEL,
        'web_search_read',
        [],
        {
          specification: { id: {} },
          domain: [['type', '=', 'usulan']],
          offset,
          limit: PAGE_SIZE,
          order: 'id asc',
          count_limit: 999_999,
          context: { ...context, default_type: 'usulan' },
        },
      );
      const records: { id: number }[] = res?.records ?? [];
      ids.push(...records.map((r) => r.id));
      if (records.length < PAGE_SIZE) break;
    }

    const records: any[] = [];
    for (let i = 0; i < ids.length; i += READ_BATCH) {
      const batch = await this.odooSyncService.safeOdooCall(
        warehouseId,
        ODOO_MODEL,
        'web_read',
        [ids.slice(i, i + READ_BATCH)],
        {
          specification: READ_SPECIFICATION,
          context: { ...context, default_type: 'usulan' },
        },
      );
      if (Array.isArray(batch)) records.push(...batch);
    }
    return records;
  }

  private parseRecord(record: any): ParsedSpk {
    const text = (v: unknown): string | null =>
      typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
    const displayName = (v: any): string | null =>
      v && typeof v === 'object' ? text(v.display_name) : null;
    const isSet = (v: unknown) =>
      v !== false && v !== null && v !== undefined && v !== '';

    const treatmentTypes = SPK_TREATMENT_TYPES.filter((t) =>
      isSet(record[TREATMENT_ODOO_FIELD[t]]),
    );

    const lines = Array.isArray(record.spk_line_ids)
      ? record.spk_line_ids.map((l: any) => ({
          productName: displayName(l.product_id) ?? '-',
          lotName: displayName(l.lot_id),
          jumlahStock:
            typeof l.jumlah_stock === 'number' ? l.jumlah_stock : null,
        }))
      : [];

    return {
      odooId: Number(record.id),
      name: text(record.name) ?? text(record.display_name) ?? `SPK ${record.id}`,
      state: text(record.state),
      date: this.parseOdooDate(record.date),
      weeklyName: displayName(record.weekly_id),
      locationName: displayName(record.location_id),
      namaSuratPemohon: text(record.nama_surat_pemohon),
      jabatanPihakPertama: text(record.jabatan_pihak_pertama),
      treatmentTypes,
      typeSpraying: text(record.type_spraying),
      typeFumigasi: text(record.type_fumigasi),
      typeFogging: text(record.type_fogging),
      lines,
    };
  }

  /** Odoo sends Date fields as "YYYY-MM-DD" (warehouse day) and Datetime as UTC "YYYY-MM-DD HH:mm:ss" */
  private parseOdooDate(value: unknown): Date | null {
    if (typeof value !== 'string' || !value) return null;
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00+08:00`)
      : new Date(`${value.replace(' ', 'T')}Z`);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
}

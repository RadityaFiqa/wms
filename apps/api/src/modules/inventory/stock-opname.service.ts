import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ReconciliationService } from './reconciliation.service';
import PDFDocument from 'pdfkit';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import {
  getLocalStartOfDay,
  getLocalEndOfDay,
  formatDateInTimezone,
} from '@/core/utils/date';
import { Prisma } from '@prisma/client';
import {
  evaluateQuantityCalculation,
  type StockOpnameCalculationRow,
  type UpdateStockOpnameInput,
} from '@bulog-wms/schema';

/**
 * "Hitung Per Tumpukan / Lokasi" only lists stacks with a positive ERP
 * snapshot OR a positive reconciled physical stock (null counts as 0).
 * Stacks that already hold a counted quantity stay visible so every value
 * that feeds the item difference on submit remains reviewable.
 */
function isStackCountable(stack: {
  erpQty: number | null;
  calculatedPhysical: number | null;
  actualQty: number | null;
}): boolean {
  return (
    (stack.erpQty ?? 0) > 0 ||
    (stack.calculatedPhysical ?? 0) > 0 ||
    stack.actualQty !== null
  );
}

function parseCalculationRows(
  value: Prisma.JsonValue | null,
): StockOpnameCalculationRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows: StockOpnameCalculationRow[] = [];
  for (const r of value) {
    if (r && typeof r === 'object' && !Array.isArray(r)) {
      if (typeof r.expression === 'string') {
        rows.push({ expression: r.expression, result: Number(r.result) });
      }
    }
  }
  return rows;
}

@Injectable()
export class StockOpnameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliationService: ReconciliationService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  /**
   * Helper to generate unique sequential stock opname number.
   * Format: SO-YYYYMMDD-XXXX
   */
  private async generateOpnameNumber(tx: any): Promise<string> {
    const timezone = this.warehouseContext.getTimezone();
    const todayStr = formatDateInTimezone(new Date(), timezone);
    const [YYYY, MM, DD] = todayStr.split('-');
    const dateStr = `${YYYY}${MM}${DD}`;

    const start = getLocalStartOfDay(todayStr, timezone);
    const end = getLocalEndOfDay(todayStr, timezone);

    const count = await tx.stockOpname.count({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });

    const nextSeq = String(count + 1).padStart(4, '0');
    return `SO-${dateStr}-${nextSeq}`;
  }

  /**
   * List all Stock Opnames for the active warehouse.
   */
  async getList(
    warehouseId: number,
    query: {
      search?: string;
      status?: string;
      createdById?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      warehouseId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.createdById) {
      where.createdById = parseInt(query.createdById, 10);
    }

    const timezone = this.warehouseContext.getTimezone();
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = getLocalStartOfDay(query.startDate, timezone);
      }
      if (query.endDate) {
        where.createdAt.lte = getLocalEndOfDay(query.endDate, timezone);
      }
    }

    if (query.search) {
      where.opnameNumber = { contains: query.search, mode: 'insensitive' };
    }

    const [total, items] = await Promise.all([
      this.prisma.stockOpname.count({ where }),
      this.prisma.stockOpname.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: { name: true, email: true },
          },
          items: {
            include: {
              stacks: true,
            },
          },
          attachments: true,
        },
      }),
    ]);

    // Format output with total products and total variance
    const formattedItems = items.map((op) => {
      const totalProducts = op.items.length;
      let totalVariance = 0;
      for (const item of op.items) {
        if (item.difference !== null) {
          totalVariance += item.difference;
        }
      }

      return {
        uuid: op.uuid,
        opnameNumber: op.opnameNumber,
        status: op.status,
        notes: op.notes,
        createdAt: op.createdAt,
        updatedAt: op.updatedAt,
        completionDate: op.completionDate,
        createdBy: op.createdBy.name,
        totalProducts,
        totalVariance,
        attachments: op.attachments.map((a) => ({
          uuid: a.uuid,
          fileName: a.fileName,
          filePath: a.filePath,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
        })),
      };
    });

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: formattedItems,
    };
  }

  /**
   * Retrieve Stock Opname detail.
   */
  async getDetail(warehouseId: number, uuid: string) {
    const op = await this.prisma.stockOpname.findFirst({
      where: { uuid, warehouseId },
      include: {
        createdBy: { select: { name: true, email: true } },
        attachments: true,
        items: {
          include: {
            stacks: {
              orderBy: { locationName: 'asc' },
            },
          },
          orderBy: { productName: 'asc' },
        },
        warehouse: true,
      },
    });

    if (!op) {
      throw new NotFoundException('Stock Opname tidak ditemukan.');
    }

    const totalProducts = op.items.length;
    let totalVariance = 0;
    for (const item of op.items) {
      if (item.difference !== null) {
        totalVariance += item.difference;
      }
    }

    return {
      uuid: op.uuid,
      opnameNumber: op.opnameNumber,
      status: op.status,
      notes: op.notes,
      createdAt: op.createdAt,
      updatedAt: op.updatedAt,
      completionDate: op.completionDate,
      createdBy: op.createdBy.name,
      totalProducts,
      totalVariance,
      warehouseName: op.warehouse.name,
      warehouseCode: op.warehouse.code,
      attachments: op.attachments.map((a) => ({
        id: a.id,
        uuid: a.uuid,
        fileName: a.fileName,
        filePath: a.filePath,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      })),
      items: op.items.map((item) => ({
        uuid: item.uuid,
        productId: item.inventoryId,
        productSku: item.productSku,
        productName: item.productName,
        productUom: item.productUom,
        erpStock: item.erpStock,
        realtimeStock: item.realtimeStock,
        difference: item.difference,
        stacks: item.stacks.filter(isStackCountable).map((st) => ({
          uuid: st.uuid,
          locationId: st.locationId,
          locationName: st.locationName,
          erpQty: st.erpQty,
          calculatedPhysical: st.calculatedPhysical,
          actualQty: st.actualQty,
          variance: st.variance,
          calculationRows: parseCalculationRows(st.calculationRows),
        })),
      })),
    };
  }

  /**
   * Start a new Stock Opname (Takes Snapshot).
   */
  async createStockOpname(
    warehouseId: number,
    createdById: number,
    notes?: string,
  ) {
    // 1. Fetch current reconciliation details for all products (to get ERP stock and Realtime stock snapshots),
    //    plus per-location calculatedPhysical so it can be snapshotted on each stack
    const [reconList, locationReconMap, warehouseLocations] = await Promise.all(
      [
        this.reconciliationService.getReconciliationList(warehouseId),
        this.reconciliationService.getLocationCalculatedPhysicalMap(
          warehouseId,
        ),
        this.prisma.location.findMany({
          where: { warehouseId },
          select: { id: true, displayName: true },
        }),
      ],
    );
    const locationNames = new Map(
      warehouseLocations.map((l) => [l.id, l.displayName]),
    );

    // 2. Fetch all products current quants per location in this warehouse
    const products = await this.prisma.inventory.findMany({
      include: {
        quants: {
          where: {
            location: {
              warehouseId,
            },
          },
          include: {
            location: true,
          },
        },
      },
    });

    return this.prisma.$transaction(async (tx) => {
      // 3. Generate unique sequential stock opname number
      const opnameNumber = await this.generateOpnameNumber(tx);

      // 4. Create the Stock Opname header
      const stockOpname = await tx.stockOpname.create({
        data: {
          opnameNumber,
          warehouseId,
          createdById,
          notes,
          status: 'DRAFT',
        },
      });

      // 5. Build snapshots for each product that has stock or reconciliation info
      for (const recon of reconList) {
        const prod = products.find((p) => p.sku === recon.product.sku);
        if (!prod) continue;

        // Create StockOpnameItem
        const item = await tx.stockOpnameItem.create({
          data: {
            stockOpnameId: stockOpname.id,
            inventoryId: prod.id,
            productSku: prod.sku,
            productName: prod.name,
            productUom: prod.uom || 'Unit',
            erpStock: recon.erpStock,
            realtimeStock: recon.expectedStock,
          },
        });

        // Group quants by location for this product
        const locMap = new Map<number, { name: string; qty: number }>();
        for (const q of prod.quants) {
          const loc = q.location;
          const current = locMap.get(loc.id) || {
            name: loc.displayName,
            qty: 0,
          };
          current.qty += q.quantity;
          locMap.set(loc.id, current);
        }

        // Locations with reconciled physical stock but no ERP quant still need a stack to be counted
        const reconByLocation = locationReconMap.get(prod.id);
        for (const [locationId, calculatedPhysical] of reconByLocation ?? []) {
          const name = locationNames.get(locationId);
          if (calculatedPhysical > 0 && !locMap.has(locationId) && name) {
            locMap.set(locationId, { name, qty: 0 });
          }
        }

        // Create StockOpnameStack snapshots
        for (const [locationId, locData] of locMap.entries()) {
          await tx.stockOpnameStack.create({
            data: {
              stockOpnameItemId: item.id,
              locationId,
              locationName: locData.name,
              erpQty: locData.qty,
              calculatedPhysical:
                reconByLocation?.get(locationId) ?? locData.qty,
            },
          });
        }
      }

      return stockOpname;
    });
  }

  /**
   * Save Stock Opname progress (Draft mode).
   */
  async updateStockOpname(
    warehouseId: number,
    uuid: string,
    body: UpdateStockOpnameInput,
  ) {
    const op = await this.prisma.stockOpname.findFirst({
      where: { uuid, warehouseId },
    });

    if (!op) {
      throw new NotFoundException('Stock Opname tidak ditemukan.');
    }

    if (op.status !== 'DRAFT') {
      throw new BadRequestException(
        'Hanya draf Stock Opname yang dapat diedit.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update notes
      if (body.notes !== undefined) {
        await tx.stockOpname.update({
          where: { id: op.id },
          data: { notes: body.notes },
        });
      }

      // 2. Update actual quantities and calculate stack variances
      if (body.stacks && body.stacks.length > 0) {
        for (const st of body.stacks) {
          const dbStack = await tx.stockOpnameStack.findFirst({
            where: { uuid: st.uuid, item: { stockOpnameId: op.id } },
          });

          if (!dbStack) continue;

          // Calculator rows are re-evaluated here: the server, not the client total, decides actualQty
          let actualQty = st.actualQty;
          let calculationRows: Prisma.InputJsonValue | typeof Prisma.DbNull =
            Prisma.DbNull;
          const expressions = (st.calculationRows ?? []).filter(
            (e) => e.trim() !== '',
          );
          if (expressions.length > 0) {
            const calc = evaluateQuantityCalculation(expressions);
            if (calc.hasError || calc.total === null) {
              throw new BadRequestException(
                `Perhitungan kuantum pada lokasi ${dbStack.locationName} tidak valid.`,
              );
            }
            actualQty = calc.total;
            calculationRows = expressions.map((expression, i) => {
              const row = calc.rows[i];
              return {
                expression: expression.trim(),
                result: row.status === 'ok' ? row.value : 0,
              };
            });
          }

          // If actualQty is null/empty, variance is null
          const variance =
            actualQty !== null ? actualQty - dbStack.erpQty : null;

          await tx.stockOpnameStack.update({
            where: { id: dbStack.id },
            data: {
              actualQty,
              variance,
              calculationRows,
            },
          });
        }
      }

      // 3. Update attachments
      if (body.attachmentPaths) {
        // Unlink old attachments that are not in the new paths
        await tx.fileAttachment.updateMany({
          where: {
            stockOpnameId: op.id,
            filePath: { notIn: body.attachmentPaths },
          },
          data: { stockOpnameId: null },
        });

        // Link new attachments
        if (body.attachmentPaths.length > 0) {
          await tx.fileAttachment.updateMany({
            where: { filePath: { in: body.attachmentPaths } },
            data: { stockOpnameId: op.id },
          });
        }
      }

      return tx.stockOpname.findUnique({
        where: { id: op.id },
        include: { attachments: true },
      });
    });
  }

  /**
   * Delete a draft Stock Opname. Completed opnames are final and cannot be deleted.
   */
  async deleteStockOpname(warehouseId: number, uuid: string) {
    const op = await this.prisma.stockOpname.findFirst({
      where: { uuid, warehouseId },
    });

    if (!op) {
      throw new NotFoundException('Stock Opname tidak ditemukan.');
    }

    if (op.status !== 'DRAFT') {
      throw new BadRequestException(
        'Hanya draf Stock Opname yang dapat dihapus.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Unlink attachments instead of letting the FK cascade delete their records
      await tx.fileAttachment.updateMany({
        where: { stockOpnameId: op.id },
        data: { stockOpnameId: null },
      });

      // Items and stacks are removed via onDelete: Cascade
      await tx.stockOpname.delete({ where: { id: op.id } });
    });

    return { uuid: op.uuid, opnameNumber: op.opnameNumber };
  }

  /**
   * Finalize and Submit Stock Opname.
   */
  async submitStockOpname(warehouseId: number, uuid: string) {
    const op = await this.prisma.stockOpname.findFirst({
      where: { uuid, warehouseId },
      include: {
        items: {
          include: { stacks: true },
        },
      },
    });

    if (!op) {
      throw new NotFoundException('Stock Opname tidak ditemukan.');
    }

    if (op.status !== 'DRAFT') {
      throw new BadRequestException(
        'Stock Opname ini sudah disubmit sebelumnya.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Calculate difference for each product item
      for (const item of op.items) {
        let hasActualCount = false;
        let sumVariance = 0;

        for (const stack of item.stacks) {
          if (stack.actualQty !== null && stack.variance !== null) {
            hasActualCount = true;
            sumVariance += stack.variance;
          }
        }

        // Difference is only calculated if at least one stack contains actual counts
        const difference = hasActualCount ? sumVariance : null;

        await tx.stockOpnameItem.update({
          where: { id: item.id },
          data: {
            difference,
          },
        });
      }

      // 2. Mark stock opname as COMPLETED
      return tx.stockOpname.update({
        where: { id: op.id },
        data: {
          status: 'COMPLETED',
          completionDate: new Date(),
        },
      });
    });
  }

  /**
   * Generate Counting Sheet PDF.
   */
  async generateCountingSheetPdf(
    warehouseId: number,
    uuid: string,
  ): Promise<Buffer> {
    const op = await this.prisma.stockOpname.findFirst({
      where: { uuid, warehouseId },
      include: {
        warehouse: true,
        createdBy: true,
        items: {
          include: { stacks: true },
          orderBy: { productName: 'asc' },
        },
      },
    });

    if (!op) {
      throw new NotFoundException('Stock Opname tidak ditemukan.');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 20, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const drawHeader = () => {
        doc
          .fillColor('#1e293b')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('LEMBAR PERHITUNGAN FISIK (COUNTING SHEET)', 20, 20, {
            align: 'center',
            width: 555,
          });
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#64748b')
          .text(
            `No. Opname: ${op.opnameNumber}  |  Gudang: ${op.warehouse.name}  |  Tanggal Draf: ${op.createdAt.toLocaleDateString('id-ID')}`,
            20,
            36,
            { align: 'center', width: 555 },
          );

        doc.moveTo(20, 52).lineTo(575, 52).lineWidth(0.5).stroke('#475569');

        // Table Header
        doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold');
        doc.text('Produk (Nama & SKU)', 25, 60, { width: 230 });
        doc.text('Lokasi / Stack', 265, 60, { width: 140 });
        doc.text('Qty Sistem (ERP)', 415, 60, { width: 70, align: 'right' });
        doc.text('Perhitungan Aktual', 495, 60, { width: 75, align: 'center' });
        doc.font('Helvetica');

        doc.moveTo(20, 72).lineTo(575, 72).lineWidth(0.5).stroke('#475569');
        return 76;
      };

      let currentY = drawHeader();

      for (const item of op.items) {
        const rowHeight = Math.max(14, item.stacks.length * 15);
        if (currentY + rowHeight > 800) {
          doc.addPage();
          currentY = drawHeader();
        }

        // Draw product info
        doc.fillColor('#1e293b').fontSize(7).font('Helvetica-Bold');
        doc.text(`${item.productName}`, 25, currentY + 3, {
          width: 230,
          ellipsis: true,
        });
        doc.fillColor('#64748b').fontSize(6).font('Helvetica');
        doc.text(
          `SKU: ${item.productSku} | UOM: ${item.productUom || 'Unit'}`,
          25,
          currentY + 12,
          { width: 230 },
        );

        // Draw stacks
        let stackY = currentY;
        for (let i = 0; i < item.stacks.length; i++) {
          const st = item.stacks[i];
          doc.fillColor('#334155').fontSize(7).font('Helvetica');
          doc.text(st.locationName, 265, stackY + 3, {
            width: 140,
            ellipsis: true,
          });
          doc.text(st.erpQty.toLocaleString('id-ID'), 415, stackY + 3, {
            width: 70,
            align: 'right',
          });

          // Draw blank box/field for actual counting input
          doc
            .rect(500, stackY + 1, 60, 11)
            .lineWidth(0.4)
            .stroke('#cbd5e1');

          stackY += 15;
        }

        doc
          .moveTo(20, currentY + rowHeight)
          .lineTo(575, currentY + rowHeight)
          .lineWidth(0.2)
          .stroke('#e2e8f0');
        currentY += rowHeight;
      }

      doc.end();
    });
  }

  /**
   * Generate "Lembar Perhitungan Fisik" PDF, grouped by location area
   * (the part before "/", e.g. "GBB 01/C04.1.2" -> "GBB 01"), one area per page.
   * Saved calculator rows and totals are printed; uncounted stacks are left blank
   * so the sheet can be filled in by hand.
   */
  async generatePhysicalCountSheetPdf(
    warehouseId: number,
    uuid: string,
  ): Promise<Buffer> {
    const op = await this.prisma.stockOpname.findFirst({
      where: { uuid, warehouseId },
      include: {
        warehouse: true,
        items: { include: { stacks: true } },
      },
    });

    if (!op) {
      throw new NotFoundException('Stock Opname tidak ditemukan.');
    }

    type SheetRow = {
      productName: string;
      productSku: string;
      productUom: string;
      locationName: string;
      expressions: string[];
      actualQty: number | null;
    };

    // Same location visibility as "Hitung Per Tumpukan / Lokasi"
    const groups = new Map<string, SheetRow[]>();
    for (const item of op.items) {
      for (const st of item.stacks.filter(isStackCountable)) {
        const slash = st.locationName.indexOf('/');
        const area = (
          slash >= 0 ? st.locationName.slice(0, slash) : st.locationName
        ).trim();
        const rows = groups.get(area) ?? [];
        rows.push({
          productName: item.productName,
          productSku: item.productSku,
          productUom: item.productUom || 'Unit',
          locationName: st.locationName,
          expressions: (parseCalculationRows(st.calculationRows) ?? []).map(
            (r) => r.expression,
          ),
          actualQty: st.actualQty,
        });
        groups.set(area, rows);
      }
    }

    const collator = new Intl.Collator('id-ID', { numeric: true });
    const areas = Array.from(groups.keys()).sort(collator.compare);
    for (const rows of groups.values()) {
      rows.sort(
        (a, b) =>
          collator.compare(a.locationName, b.locationName) ||
          collator.compare(a.productName, b.productName),
      );
    }

    const formatQty = (n: number) =>
      n.toLocaleString('id-ID', { maximumFractionDigits: 3 });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 20, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const PAGE_BOTTOM = 800;
      const PAD = 4;
      const cols = {
        komoditas: { x: 20, w: 170 },
        tumpukan: { x: 190, w: 110 },
        hitungan: { x: 300, w: 195 },
        total: { x: 495, w: 80 },
      };

      const drawHeader = (area: string, continued: boolean) => {
        doc
          .fillColor('#1e293b')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('LEMBAR PERHITUNGAN FISIK', 20, 20, {
            align: 'center',
            width: 555,
          });
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#64748b')
          .text(
            `No. Opname: ${op.opnameNumber}  |  Gudang: ${op.warehouse.name}  |  Tanggal: ${op.createdAt.toLocaleDateString('id-ID')}`,
            20,
            36,
            { align: 'center', width: 555 },
          );
        doc
          .fillColor('#1e293b')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(`Lokasi: ${area}${continued ? ' (lanjutan)' : ''}`, 20, 54, {
            width: 555,
          });

        // Table header
        const top = 70;
        doc.rect(20, top, 555, 16).fill('#f1f5f9');
        doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold');
        doc.text('Komoditas', cols.komoditas.x + PAD, top + 5, {
          width: cols.komoditas.w - PAD * 2,
        });
        doc.text('Tumpukan', cols.tumpukan.x + PAD, top + 5, {
          width: cols.tumpukan.w - PAD * 2,
        });
        doc.text('Hitungan Perkalian', cols.hitungan.x + PAD, top + 5, {
          width: cols.hitungan.w - PAD * 2,
        });
        doc.text('Total', cols.total.x + PAD, top + 5, {
          width: cols.total.w - PAD * 2,
          align: 'right',
        });
        doc.rect(20, top, 555, 16).lineWidth(0.5).stroke('#94a3b8');
        return top + 16;
      };

      const drawSignatures = (y: number) => {
        doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica-Bold');
        doc.text('Petugas Penghitung,', 50, y, { width: 150, align: 'center' });
        doc.text('Kepala Gudang / Supervisor,', 375, y, {
          width: 150,
          align: 'center',
        });
        doc.font('Helvetica');
        doc.text('( ............................ )', 50, y + 45, {
          width: 150,
          align: 'center',
        });
        doc.text('( ............................ )', 375, y + 45, {
          width: 150,
          align: 'center',
        });
      };

      if (areas.length === 0) {
        drawHeader('-', false);
        doc
          .fillColor('#64748b')
          .fontSize(8)
          .font('Helvetica-Oblique')
          .text('Tidak ada lokasi untuk dihitung.', 20, 96, {
            width: 555,
            align: 'center',
          });
      }

      areas.forEach((area, areaIndex) => {
        if (areaIndex > 0) doc.addPage();
        let y = drawHeader(area, false);

        for (const row of groups.get(area)!) {
          const hitunganText = row.expressions.join('  +  ');
          doc.fontSize(7.5).font('Helvetica');
          const komoditasH =
            doc.heightOfString(row.productName, {
              width: cols.komoditas.w - PAD * 2,
            }) + 10;
          const hitunganH = hitunganText
            ? doc.heightOfString(hitunganText, {
                width: cols.hitungan.w - PAD * 2,
              })
            : 0;
          // Uncounted rows get extra room for handwriting
          const rowH = Math.max(
            hitunganText ? 20 : 26,
            komoditasH + PAD * 2,
            hitunganH + PAD * 2,
          );

          if (y + rowH > PAGE_BOTTOM) {
            doc.addPage();
            y = drawHeader(area, true);
          }

          doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica-Bold');
          doc.text(row.productName, cols.komoditas.x + PAD, y + PAD, {
            width: cols.komoditas.w - PAD * 2,
          });
          doc.fillColor('#64748b').fontSize(6).font('Helvetica');
          doc.text(
            `${row.productSku} | ${row.productUom}`,
            cols.komoditas.x + PAD,
            doc.y + 1,
            { width: cols.komoditas.w - PAD * 2 },
          );

          doc.fillColor('#334155').fontSize(7.5).font('Helvetica');
          doc.text(row.locationName, cols.tumpukan.x + PAD, y + PAD, {
            width: cols.tumpukan.w - PAD * 2,
          });

          if (hitunganText) {
            doc.text(hitunganText, cols.hitungan.x + PAD, y + PAD, {
              width: cols.hitungan.w - PAD * 2,
            });
          }

          if (row.actualQty !== null) {
            doc.font('Helvetica-Bold').text(
              formatQty(row.actualQty),
              cols.total.x + PAD,
              y + PAD,
              { width: cols.total.w - PAD * 2, align: 'right' },
            );
          }

          // Cell borders
          doc.lineWidth(0.4).strokeColor('#cbd5e1');
          for (const c of Object.values(cols)) {
            doc.rect(c.x, y, c.w, rowH).stroke();
          }
          y += rowH;
        }

        if (y + 80 > PAGE_BOTTOM) {
          doc.addPage();
          y = 20;
        }
        drawSignatures(y + 20);
      });

      doc.end();
    });
  }

  /**
   * Generate Final Stock Opname PDF.
   */
  async generateResultPdf(warehouseId: number, uuid: string): Promise<Buffer> {
    const op = await this.prisma.stockOpname.findFirst({
      where: { uuid, warehouseId },
      include: {
        warehouse: true,
        createdBy: true,
        items: {
          include: { stacks: true },
          orderBy: { productName: 'asc' },
        },
      },
    });

    if (!op) {
      throw new NotFoundException('Stock Opname tidak ditemukan.');
    }

    if (op.status === 'DRAFT') {
      return this.generateCountingSheetPdf(warehouseId, uuid);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 20, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const drawHeader = () => {
        doc
          .fillColor('#1e293b')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('LAPORAN HASIL STOCK OPNAME (STOCK COUNTING REPORT)', 20, 20, {
            align: 'center',
            width: 555,
          });
        doc
          .fontSize(7.5)
          .font('Helvetica')
          .fillColor('#64748b')
          .text(
            `No. Opname: ${op.opnameNumber}  |  Gudang: ${op.warehouse.name}  |  Selesai: ${op.completionDate?.toLocaleString('id-ID')}`,
            20,
            34,
            { align: 'center', width: 555 },
          );

        doc.moveTo(20, 48).lineTo(575, 48).lineWidth(0.5).stroke('#475569');

        // Table Header
        doc.fillColor('#475569').fontSize(7).font('Helvetica-Bold');
        doc.text('Produk (Nama & SKU)', 25, 54, { width: 175 });
        doc.text('Lokasi / Stack', 205, 54, { width: 110 });
        doc.text('Qty ERP', 320, 54, { width: 55, align: 'right' });
        doc.text('Qty Realtime', 380, 54, { width: 60, align: 'right' });
        doc.text('Qty Aktual', 445, 54, { width: 60, align: 'right' });
        doc.text('Selisih (Var)', 510, 54, { width: 60, align: 'right' });
        doc.font('Helvetica');

        doc.moveTo(20, 66).lineTo(575, 66).lineWidth(0.5).stroke('#475569');
        return 70;
      };

      let currentY = drawHeader();

      for (const item of op.items) {
        const rowHeight = Math.max(14, item.stacks.length * 14);
        if (currentY + rowHeight > 800) {
          doc.addPage();
          currentY = drawHeader();
        }

        // Draw product level summaries on the first stack row or separate
        doc.fillColor('#1e293b').fontSize(6.8).font('Helvetica-Bold');
        doc.text(item.productName, 25, currentY + 3, {
          width: 175,
          ellipsis: true,
        });
        doc.fillColor('#64748b').fontSize(5.8).font('Helvetica');
        doc.text(
          `SKU: ${item.productSku} | UOM: ${item.productUom || 'Unit'}`,
          25,
          currentY + 11,
          { width: 175 },
        );

        // Total columns
        doc.fillColor('#1e293b').fontSize(6.5).font('Helvetica-Bold');
        doc.text(item.erpStock.toLocaleString('id-ID'), 320, currentY + 3, {
          width: 55,
          align: 'right',
        });
        doc.text(
          item.realtimeStock.toLocaleString('id-ID'),
          380,
          currentY + 3,
          { width: 60, align: 'right' },
        );

        let actualSum = 0;
        let hasActual = false;
        for (const s of item.stacks) {
          if (s.actualQty !== null) {
            actualSum += s.actualQty;
            hasActual = true;
          }
        }
        doc.text(
          hasActual ? actualSum.toLocaleString('id-ID') : '-',
          445,
          currentY + 3,
          { width: 60, align: 'right' },
        );

        // Difference
        if (item.difference !== null) {
          const diffText =
            item.difference > 0 ? `+${item.difference}` : `${item.difference}`;
          const diffColor =
            item.difference < 0
              ? '#b91c1c'
              : item.difference > 0
                ? '#15803d'
                : '#1e293b';
          doc
            .fillColor(diffColor)
            .text(diffText, 510, currentY + 3, { width: 60, align: 'right' });
        } else {
          doc
            .fillColor('#64748b')
            .text('-', 510, currentY + 3, { width: 60, align: 'right' });
        }

        // Stacks breakdown
        let stackY = currentY;
        for (let i = 0; i < item.stacks.length; i++) {
          const st = item.stacks[i];
          doc.fillColor('#475569').fontSize(6.2).font('Helvetica');
          doc.text(st.locationName, 205, stackY + 3, {
            width: 110,
            ellipsis: true,
          });

          // Show stack levels
          doc.text(st.erpQty.toLocaleString('id-ID'), 320, stackY + 3, {
            width: 55,
            align: 'right',
            fill: false,
          });
          doc.text(
            st.actualQty !== null ? st.actualQty.toLocaleString('id-ID') : '-',
            445,
            stackY + 3,
            { width: 60, align: 'right' },
          );

          if (st.variance !== null) {
            const varText =
              st.variance > 0 ? `+${st.variance}` : `${st.variance}`;
            const varColor =
              st.variance < 0
                ? '#b91c1c'
                : st.variance > 0
                  ? '#15803d'
                  : '#475569';
            doc
              .fillColor(varColor)
              .text(varText, 510, stackY + 3, { width: 60, align: 'right' });
          } else {
            doc
              .fillColor('#64748b')
              .text('-', 510, stackY + 3, { width: 60, align: 'right' });
          }

          stackY += 13;
        }

        doc
          .moveTo(20, currentY + rowHeight)
          .lineTo(575, currentY + rowHeight)
          .lineWidth(0.2)
          .stroke('#cbd5e1');
        currentY += rowHeight;
      }

      // Add signature fields at the bottom
      if (currentY + 80 > 800) {
        doc.addPage();
        currentY = 20;
      }

      currentY += 25;
      doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica-Bold');
      doc.text('Dibuat Oleh,', 50, currentY, { width: 150, align: 'center' });
      doc.text('Disetujui Oleh,', 375, currentY, {
        width: 150,
        align: 'center',
      });

      currentY += 45;
      doc.text(`( ${op.createdBy.name} )`, 50, currentY, {
        width: 150,
        align: 'center',
      });
      doc.text('( Kepala Gudang / Supervisor )', 375, currentY, {
        width: 150,
        align: 'center',
      });

      doc.end();
    });
  }
}

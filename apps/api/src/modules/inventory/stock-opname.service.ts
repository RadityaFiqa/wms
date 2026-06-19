import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ReconciliationService } from './reconciliation.service';
import PDFDocument from 'pdfkit';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import { getLocalStartOfDay, getLocalEndOfDay, formatDateInTimezone } from '@/core/utils/date';

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
        stacks: item.stacks.map((st) => ({
          uuid: st.uuid,
          locationId: st.locationId,
          locationName: st.locationName,
          erpQty: st.erpQty,
          actualQty: st.actualQty,
          variance: st.variance,
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
    // 1. Fetch current reconciliation details for all products (to get ERP stock and Realtime stock snapshots)
    const reconList =
      await this.reconciliationService.getReconciliationList(warehouseId);

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

        // Create StockOpnameStack snapshots
        for (const [locationId, locData] of locMap.entries()) {
          await tx.stockOpnameStack.create({
            data: {
              stockOpnameItemId: item.id,
              locationId,
              locationName: locData.name,
              erpQty: locData.qty,
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
    body: {
      notes?: string;
      stacks?: Array<{ uuid: string; actualQty: number | null }>;
      attachmentPaths?: string[];
    },
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
          const dbStack = await tx.stockOpnameStack.findUnique({
            where: { uuid: st.uuid },
          });

          if (!dbStack) continue;

          // If actualQty is null/empty, variance is null
          const variance =
            st.actualQty !== null ? st.actualQty - dbStack.erpQty : null;

          await tx.stockOpnameStack.update({
            where: { id: dbStack.id },
            data: {
              actualQty: st.actualQty,
              variance,
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

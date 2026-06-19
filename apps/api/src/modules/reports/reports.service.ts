import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import PDFDocument from 'pdfkit';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import { getLocalStartOfDay, getLocalEndOfDay, formatDateInTimezone } from '@/core/utils/date';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  /**
   * Generates Daily Stock Movement Report rows for a date range and warehouse.
   */
  async getDailyStockMovementReport(
    warehouseId: number,
    query: {
      startDate: string;
      endDate: string;
      productId?: string;
    },
  ) {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('Start date dan End date harus diisi.');
    }

    const timezone = this.warehouseContext.getTimezone();
    const start = getLocalStartOfDay(query.startDate, timezone);
    const end = getLocalEndOfDay(query.endDate, timezone);

    if (start > end) {
      throw new BadRequestException('Start date tidak boleh setelah End date.');
    }

    // Today in local timezone end of day
    const todayStr = formatDateInTimezone(new Date(), timezone);
    const today = getLocalEndOfDay(todayStr, timezone);

    // 1. Fetch COMPLETED or VERIFIED Gate Operations from start date until TODAY
    const gateOps = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: { in: ['COMPLETED', 'VERIFIED'] },
        verification: {
          verifiedAt: {
            gte: start,
            lte: today,
          },
        },
      },
      include: {
        products: true,
        documentReference: true,
        verification: true,
      },
    });

    // 2. Identify products that had movement within the selected period
    const movedProductIdsSet = new Set<number>();
    const dateRangeStart = start;
    const dateRangeEnd = end;

    for (const op of gateOps) {
      const verifiedAt = op.verification?.verifiedAt;
      if (verifiedAt && verifiedAt >= dateRangeStart && verifiedAt <= dateRangeEnd) {
        for (const p of op.products) {
          movedProductIdsSet.add(p.inventoryId);
        }
      }
    }
    const movedProductIds = Array.from(movedProductIdsSet);

    if (movedProductIds.length === 0) {
      return [];
    }

    // 3. Fetch details for products with movement
    const products = await this.prisma.inventory.findMany({
      where: {
        id: { in: movedProductIds },
        ...(query.productId ? { uuid: query.productId } : {}),
      },
      include: {
        quants: {
          where: {
            location: { warehouseId },
          },
        },
      },
    });

    // 4. Load snapshots
    const snapshots = await this.prisma.dailyStockSnapshot.findMany({
      where: {
        warehouseId,
        inventoryId: { in: movedProductIds },
        date: {
          gte: start,
          lte: today,
        },
      },
    });

    const reportRows: any[] = [];
    const datesList = this.generateDatesList(start, end);
    const backwardDates = this.generateDatesList(start, today).reverse();

    for (const prod of products) {
      const erpStock = prod.quants.reduce((sum, q) => sum + q.quantity, 0);
      let currentStockTracker = erpStock;

      const transactionsByDate = new Map<
        string,
        { incoming: number; outgoing: number; list: any[] }
      >();

      for (const op of gateOps) {
        const opProd = op.products.find((p) => p.inventoryId === prod.id);
        if (!opProd) continue;

        const dateStr = formatDateInTimezone(op.verification!.verifiedAt!, timezone);
        const current = transactionsByDate.get(dateStr) || {
          incoming: 0,
          outgoing: 0,
          list: [],
        };

        if (op.cardType === 'IN') {
          current.incoming += opProd.quantity;
        } else {
          current.outgoing += opProd.quantity;
        }

        current.list.push({
          uuid: op.uuid,
          opNumber: op.opNumber,
          driverName: op.driverName,
          licensePlate: op.licensePlate,
          cardType: op.cardType,
          quantity: opProd.quantity,
          referenceDocument: op.documentReference?.documentNumber || '-',
        });

        transactionsByDate.set(dateStr, current);
      }

      const productDailyMetrics = new Map<
        string,
        { opening: number; incoming: number; outgoing: number; closing: number; list: any[] }
      >();

      const todayStr = formatDateInTimezone(new Date(), timezone);

      for (const dDate of backwardDates) {
        const dStr = formatDateInTimezone(dDate, timezone);
        const txs = transactionsByDate.get(dStr) || {
          incoming: 0,
          outgoing: 0,
          list: [],
        };

        let closing = 0;
        const snap = snapshots.find(
          (s) =>
            s.inventoryId === prod.id && formatDateInTimezone(s.date, timezone) === dStr,
        );

        if (dStr === todayStr) {
          closing = currentStockTracker;
        } else if (snap) {
          closing = snap.closingStock;
        } else {
          closing = currentStockTracker;
          await this.prisma.dailyStockSnapshot
            .create({
              data: {
                date: dDate,
                warehouseId,
                inventoryId: prod.id,
                closingStock: closing,
              },
            })
            .catch(() => {});
        }

        const opening = closing - txs.incoming + txs.outgoing;
        productDailyMetrics.set(dStr, {
          opening,
          incoming: txs.incoming,
          outgoing: txs.outgoing,
          closing,
          list: txs.list,
        });

        currentStockTracker = opening;
      }

      for (const dDate of datesList) {
        const dStr = formatDateInTimezone(dDate, timezone);
        const metrics = productDailyMetrics.get(dStr);
        if (!metrics) continue;

        if (metrics.incoming === 0 && metrics.outgoing === 0) {
          continue;
        }

        reportRows.push({
          date: dStr,
          product: {
            uuid: prod.uuid,
            sku: prod.sku,
            name: prod.name,
            uom: prod.uom || 'Unit',
          },
          openingStock: metrics.opening,
          incoming: metrics.incoming,
          outgoing: metrics.outgoing,
          closingStock: metrics.closing,
          transactions: metrics.list,
        });
      }
    }

    return reportRows.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return a.product.name.localeCompare(b.product.name);
    });
  }

  /**
   * Drill down details for daily stock movement transactions.
   */
  async getDailyStockMovementDetail(
    warehouseId: number,
    query: {
      date: string;
      productUuid: string;
    },
  ) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { uuid: query.productUuid },
    });

    if (!inventory) {
      throw new NotFoundException('Produk tidak ditemukan.');
    }

    const timezone = this.warehouseContext.getTimezone();
    const start = getLocalStartOfDay(query.date, timezone);
    const end = getLocalEndOfDay(query.date, timezone);

    // 1. Fetch ERP receipts and deliveries for this product on this day
    const erpItems = await this.prisma.documentReferenceItem.findMany({
      where: {
        inventoryId: inventory.id,
        documentReference: {
          warehouseId,
          state: 'done',
          dateDone: {
            gte: start,
            lte: end,
          },
        },
      },
      include: {
        documentReference: true,
      },
    });

    const erpTransactions = erpItems.map((item) => ({
      documentNumber: item.documentReference.documentNumber,
      partnerName:
        item.documentReference.partnerName ||
        item.documentReference.purchaseName ||
        'Tanpa Partner',
      pickingTypeCode: item.documentReference.pickingTypeCode, // incoming / outgoing
      quantity: item.quantity,
      scheduledDate: item.documentReference.scheduledDate,
      type: 'ERP_DOCUMENT',
    }));

    // 2. Fetch unreconciled gate operations for this product on this day
    const gateOps = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: { notIn: ['CANCELED', 'REJECTED'] },
        verification: {
          verifiedAt: {
            gte: start,
            lte: end,
          },
        },
        products: {
          some: {
            inventoryId: inventory.id,
          },
        },
      },
      include: {
        products: {
          where: {
            inventoryId: inventory.id,
          },
        },
        verification: {
          include: {
            references: true,
          },
        },
      },
    });

    const unreconciledGateOps = gateOps
      .filter((op) => {
        const hasPoRef =
          op.cardType === 'IN' && op.poReferences && op.poReferences.length > 0;
        const hasSoRef =
          op.cardType === 'OUT' &&
          op.soReferences &&
          op.soReferences.length > 0;
        if (hasPoRef || hasSoRef) return false;

        const hasErpAssignments =
          op.verification &&
          op.verification.references &&
          op.verification.references.length > 0;
        if (hasErpAssignments) return false;

        return true;
      })
      .map((op) => {
        const opProd = op.products[0];
        return {
          documentNumber: op.opNumber,
          partnerName: op.driverName + ' (' + op.licensePlate + ')',
          pickingTypeCode: op.cardType === 'IN' ? 'incoming' : 'outgoing',
          quantity: opProd?.quantity || 0,
          scheduledDate: op.verification?.verifiedAt || op.createdAt,
          type: 'GATE_OPERATION',
        };
      });

    const incomingTransactions = [
      ...erpTransactions.filter((tx) => tx.pickingTypeCode === 'incoming'),
      ...unreconciledGateOps.filter((tx) => tx.pickingTypeCode === 'incoming'),
    ];

    const outgoingTransactions = [
      ...erpTransactions.filter((tx) => tx.pickingTypeCode === 'outgoing'),
      ...unreconciledGateOps.filter((tx) => tx.pickingTypeCode === 'outgoing'),
    ];

    return {
      product: {
        sku: inventory.sku,
        name: inventory.name,
        uom: inventory.uom || 'Unit',
      },
      date: query.date,
      incoming: incomingTransactions,
      outgoing: outgoingTransactions,
    };
  }

  /**
   * Helper to format Date to YYYY-MM-DD.
   */
  private formatDateString(date: Date): string {
    const YYYY = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const DD = String(date.getDate()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD}`;
  }

  /**
   * Generate list of Dates between start and end.
   */
  private generateDatesList(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  /**
   * Exports Stock Movement Report as PDF.
   */
  async generatePdfReport(
    warehouseId: number,
    query: {
      startDate: string;
      endDate: string;
      productId?: string;
    },
  ): Promise<Buffer> {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    const warehouseName = warehouse ? warehouse.name : 'Gudang WMS';

    const rows = await this.getDailyStockMovementReport(warehouseId, query);

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
          .text('LAPORAN MUTASI PERSSEDIAAN HARIAN', 20, 20, {
            align: 'center',
            width: 555,
          });
        doc
          .fontSize(7.5)
          .font('Helvetica')
          .fillColor('#64748b')
          .text(
            `Gudang: ${warehouseName}  |  Periode: ${query.startDate} s/d ${query.endDate}`,
            20,
            34,
            { align: 'center', width: 555 },
          );

        doc.moveTo(20, 48).lineTo(575, 48).lineWidth(0.5).stroke('#475569');

        // Table Header
        doc.fillColor('#475569').fontSize(7.2).font('Helvetica-Bold');
        doc.text('Tanggal', 25, 54, { width: 85 });
        doc.text('Produk (SKU / Nama)', 125, 54, { width: 220 });
        doc.text('Masuk', 360, 54, { width: 90, align: 'right' });
        doc.text('Keluar', 470, 54, { width: 90, align: 'right' });
        doc.font('Helvetica');

        doc.moveTo(20, 66).lineTo(575, 66).lineWidth(0.5).stroke('#475569');
        return 70;
      };

      let currentY = drawHeader();

      for (const row of rows) {
        if (currentY + 18 > 800) {
          doc.addPage();
          currentY = drawHeader();
        }

        doc.fillColor('#334155').fontSize(6.8).font('Helvetica');
        doc.text(row.date, 25, currentY + 4, { width: 85 });
        doc.fillColor('#1e293b').font('Helvetica-Bold');
        doc.text(`${row.product.name}`, 125, currentY + 4, {
          width: 220,
          ellipsis: true,
        });

        doc.fillColor('#16a34a'); // green for incoming
        doc.text(
          row.incoming > 0 ? `+${row.incoming.toLocaleString('id-ID')}` : '0',
          360,
          currentY + 4,
          { width: 90, align: 'right' },
        );

        doc.fillColor('#dc2626'); // red for outgoing
        doc.text(
          row.outgoing > 0 ? `-${row.outgoing.toLocaleString('id-ID')}` : '0',
          470,
          currentY + 4,
          { width: 90, align: 'right' },
        );

        doc
          .moveTo(20, currentY + 16)
          .lineTo(575, currentY + 16)
          .lineWidth(0.15)
          .stroke('#e2e8f0');
        currentY += 16;
      }

      doc.end();
    });
  }

  /**
   * Exports Stock Movement Report as CSV string.
   */
  async generateCsvReport(
    warehouseId: number,
    query: {
      startDate: string;
      endDate: string;
      productId?: string;
    },
  ): Promise<string> {
    const rows = await this.getDailyStockMovementReport(warehouseId, query);

    // CSV Header
    let csv = '\ufeff'; // Add UTF-8 BOM so Excel opens it with correct encoding
    csv +=
      'Tanggal,SKU,Nama Produk,UOM,Masuk (Incoming),Keluar (Outgoing)\n';

    for (const r of rows) {
      const sanitizedName = r.product.name.replace(/"/g, '""');
      csv += `${r.date},${r.product.sku},"${sanitizedName}",${r.product.uom},${r.incoming},${r.outgoing}\n`;
    }

    return csv;
  }
}

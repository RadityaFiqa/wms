import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import PDFDocument from 'pdfkit';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const start = new Date(query.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(query.endDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      throw new BadRequestException('Start date tidak boleh setelah End date.');
    }

    // 1. Get products (Inventory) matching filters
    const productWhere: any = {};
    if (query.productId) {
      productWhere.uuid = query.productId;
    }

    const products = await this.prisma.inventory.findMany({
      where: productWhere,
      include: {
        quants: {
          where: {
            location: { warehouseId },
          },
        },
      },
    });

    // 2. Fetch all daily transactions (ERP receipts/deliveries and Gate Operations) from the startDate until TODAY
    // We walk backward from today to reconstruct opening/closing stock correctly
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Fetch ERP Document Reference items
    const erpItems = await this.prisma.documentReferenceItem.findMany({
      where: {
        documentReference: {
          warehouseId,
          state: 'done', // completed ERP documents
          dateDone: {
            gte: start,
            lte: today,
          },
        },
      },
      include: {
        documentReference: true,
      },
    });

    // Fetch Gate Operations and their products
    const gateOps = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: { notIn: ['CANCELED', 'REJECTED'] },
        verification: {
          verifiedAt: {
            gte: start,
            lte: today,
          },
        },
      },
      include: {
        products: true,
        verification: {
          include: {
            references: true,
          },
        },
      },
    });

    // Filter unreconciled gate operations in memory
    const unreconciledGateOps = gateOps.filter((op) => {
      const hasPoRef = op.cardType === 'IN' && op.poReferences && op.poReferences.length > 0;
      const hasSoRef = op.cardType === 'OUT' && op.soReferences && op.soReferences.length > 0;
      if (hasPoRef || hasSoRef) return false;

      const hasErpAssignments = op.verification && op.verification.references && op.verification.references.length > 0;
      if (hasErpAssignments) return false;

      return true;
    });

    // 3. Load existing snapshots
    const snapshots = await this.prisma.dailyStockSnapshot.findMany({
      where: {
        warehouseId,
        date: {
          gte: start,
          lte: today,
        },
      },
    });

    // 4. Run walk-backward reconstructor for each product
    const reportRows: any[] = [];
    const datesList = this.generateDatesList(start, end);

    // We also need to compute days from end to today for backward chain
    const backwardDates = this.generateDatesList(start, today).reverse();

    for (const prod of products) {
      // erpStock is sum of quants
      const erpStock = prod.quants.reduce((sum, q) => sum + q.quantity, 0);
      
      // We will trace the stock level backward from today's current stock
      let currentStockTracker = erpStock;

      // Group product transactions by Date (YYYY-MM-DD)
      const transactionsByDate = new Map<string, { incoming: number; outgoing: number }>();
      
      // Populate ERP transactions
      for (const item of erpItems.filter((i) => i.inventoryId === prod.id)) {
        const dateStr = this.formatDateString(item.documentReference.dateDone!);
        const current = transactionsByDate.get(dateStr) || { incoming: 0, outgoing: 0 };
        if (item.documentReference.pickingTypeCode === 'incoming') {
          current.incoming += item.quantity;
        } else {
          current.outgoing += item.quantity;
        }
        transactionsByDate.set(dateStr, current);
      }

      // Populate unreconciled gate operations
      for (const op of unreconciledGateOps) {
        const dateStr = this.formatDateString(op.verification!.verifiedAt!);
        const opProd = op.products.find((p) => p.inventoryId === prod.id);
        if (opProd) {
          const current = transactionsByDate.get(dateStr) || { incoming: 0, outgoing: 0 };
          if (op.cardType === 'IN') {
            current.incoming += opProd.quantity;
          } else {
            current.outgoing += opProd.quantity;
          }
          transactionsByDate.set(dateStr, current);
        }
      }

      // Map date to calculated opening/closing stock for this product
      const productDailyMetrics = new Map<string, { opening: number; incoming: number; outgoing: number; closing: number }>();

      const todayStr = this.formatDateString(new Date());

      for (const dDate of backwardDates) {
        const dStr = this.formatDateString(dDate);
        const txs = transactionsByDate.get(dStr) || { incoming: 0, outgoing: 0 };

        let closing = 0;
        const snap = snapshots.find((s) => s.inventoryId === prod.id && this.formatDateString(s.date) === dStr);

        if (dStr === todayStr) {
          closing = currentStockTracker;
        } else if (snap) {
          closing = snap.closingStock;
        } else {
          closing = currentStockTracker;
          
          // Cache snapshot for past dates to preserve history
          await this.prisma.dailyStockSnapshot.create({
            data: {
              date: dDate,
              warehouseId,
              inventoryId: prod.id,
              closingStock: closing,
            },
          }).catch((err) => {
            // Ignore unique constraint/race condition errors
          });
        }

        const opening = closing - txs.incoming + txs.outgoing;
        productDailyMetrics.set(dStr, {
          opening,
          incoming: txs.incoming,
          outgoing: txs.outgoing,
          closing,
        });

        // Set the tracker for the next iteration (yesterday) to this day's opening stock
        currentStockTracker = opening;
      }

      // Now populate final report rows for the requested date range
      for (const dDate of datesList) {
        const dStr = this.formatDateString(dDate);
        const metrics = productDailyMetrics.get(dStr) || {
          opening: currentStockTracker,
          incoming: 0,
          outgoing: 0,
          closing: currentStockTracker,
        };

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
        });
      }
    }

    // Sort report rows by date desc, then product name asc
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

    const targetDate = new Date(query.date);
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

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
      partnerName: item.documentReference.partnerName || item.documentReference.purchaseName || 'Tanpa Partner',
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
        const hasPoRef = op.cardType === 'IN' && op.poReferences && op.poReferences.length > 0;
        const hasSoRef = op.cardType === 'OUT' && op.soReferences && op.soReferences.length > 0;
        if (hasPoRef || hasSoRef) return false;

        const hasErpAssignments = op.verification && op.verification.references && op.verification.references.length > 0;
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
        doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text('LAPORAN MUTASI PERSSEDIAAN HARIAN', 20, 20, { align: 'center', width: 555 });
        doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text(`Gudang: ${warehouseName}  |  Periode: ${query.startDate} s/d ${query.endDate}`, 20, 34, { align: 'center', width: 555 });
        
        doc.moveTo(20, 48).lineTo(575, 48).lineWidth(0.5).stroke('#475569');

        // Table Header
        doc.fillColor('#475569').fontSize(7.2).font('Helvetica-Bold');
        doc.text('Tanggal', 25, 54, { width: 65 });
        doc.text('Produk (SKU / Nama)', 95, 54, { width: 195 });
        doc.text('Stok Awal', 295, 54, { width: 60, align: 'right' });
        doc.text('Masuk', 360, 54, { width: 65, align: 'right' });
        doc.text('Keluar', 430, 54, { width: 65, align: 'right' });
        doc.text('Stok Akhir', 500, 54, { width: 65, align: 'right' });
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
        doc.text(row.date, 25, currentY + 4, { width: 65 });
        doc.fillColor('#1e293b').font('Helvetica-Bold');
        doc.text(`${row.product.name}`, 95, currentY + 4, { width: 195, ellipsis: true });
        
        doc.fillColor('#475569').font('Helvetica');
        doc.text(row.openingStock.toLocaleString('id-ID'), 295, currentY + 4, { width: 60, align: 'right' });
        
        doc.fillColor('#16a34a'); // green for incoming
        doc.text(row.incoming > 0 ? `+${row.incoming.toLocaleString('id-ID')}` : '0', 360, currentY + 4, { width: 65, align: 'right' });
        
        doc.fillColor('#dc2626'); // red for outgoing
        doc.text(row.outgoing > 0 ? `-${row.outgoing.toLocaleString('id-ID')}` : '0', 430, currentY + 4, { width: 65, align: 'right' });
        
        doc.fillColor('#1e293b').font('Helvetica-Bold');
        doc.text(row.closingStock.toLocaleString('id-ID'), 500, currentY + 4, { width: 65, align: 'right' });

        doc.moveTo(20, currentY + 16).lineTo(575, currentY + 16).lineWidth(0.15).stroke('#e2e8f0');
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
    csv += 'Tanggal,SKU,Nama Produk,UOM,Stok Awal,Masuk (Incoming),Keluar (Outgoing),Stok Akhir\n';

    for (const r of rows) {
      const sanitizedName = r.product.name.replace(/"/g, '""');
      csv += `${r.date},${r.product.sku},"${sanitizedName}",${r.product.uom},${r.openingStock},${r.incoming},${r.outgoing},${r.closingStock}\n`;
    }

    return csv;
  }
}

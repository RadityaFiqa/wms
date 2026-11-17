import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {
  filterInboundProducts,
  type AnalyticsUnitGroup,
  type InboundGroup,
  type InboundLot,
  type InboundProduct,
  type InboundSender,
} from '@bulog-wms/schema';
import { PrismaService } from '@/core/prisma/prisma.service';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import { formatDateInTimezone } from '@/core/utils/date';
import { ReportsAnalyticsService } from '@/modules/reports/reports-analytics.service';
import { compareUnitGroups, round3 } from '@/modules/reports/analytics.utils';

export interface ExportFile {
  buffer: Buffer;
  filename: string;
}

type UnitTotal = AnalyticsUnitGroup & {
  displayQty: number;
  pendingDisplayQty: number;
};

interface StockInboundExportData {
  warehouseName: string;
  printedAt: string;
  fileDate: string;
  search: string;
  timezone: string;
  products: InboundProduct[];
  totals: UnitTotal[];
  stackCount: number;
}

type Cell = string | number | null;

const NO_FOLDER = 'Tanpa folder';

const decimal = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** Ton/KL keep one decimal; Kg, L and counted units are whole numbers, as on the page */
const isScaled = (unit: Pick<AnalyticsUnitGroup, 'displayUnit'>) =>
  unit.displayUnit === 'Ton' || unit.displayUnit === 'KL';

const formatNumber = (value: number, unit: AnalyticsUnitGroup) =>
  isScaled(unit) ? decimal.format(value) : integer.format(Math.round(value));

const formatGroupValue = (value: number, unit: AnalyticsUnitGroup) =>
  `${formatNumber(value, unit)} ${unit.displayUnit}`;

const qtyNumFmt = (unit: AnalyticsUnitGroup) =>
  isScaled(unit) ? '#,##0.0' : '#,##0';

/** "[B0010053Z] Beras Medium" → "BERAS MEDIUM" */
const formatProductName = (name: string) =>
  name
    .replace(/^\s*\[[^\]]*\]\s*/, '')
    .trim()
    .toUpperCase();

const sum = (values: number[]) =>
  round3(values.reduce((total, v) => total + v, 0));

/** Folder of a group, or "Tanpa folder" for the senders outside any folder */
const folderLabel = (group: InboundGroup) => group.folder?.name ?? NO_FOLDER;

/** "Stok ERP" or the gate not yet administered that the row comes from */
const lotStatus = (lot: InboundLot) =>
  lot.pendingGate
    ? `Belum diadministrasi (Gate ${lot.pendingGate.cardType})`
    : 'Stok ERP';

/**
 * Recomputes every subtotal from the lots that are left after the search, so an
 * exported folder, sender or stack never shows more than the rows listed under it.
 */
function rollUpFromLots(products: InboundProduct[]): InboundProduct[] {
  return products.map((p) => {
    const stackIds = new Set<string>();
    const senderNames = new Set<string>();
    const rollSender = (s: InboundSender): InboundSender => {
      senderNames.add(s.name);
      const stacks = s.stacks.map((st) => {
        stackIds.add(st.locationUuid);
        return { ...st, displayQty: sum(st.lots.map((l) => l.displayQty)) };
      });
      const lots = stacks.flatMap((st) => st.lots);
      const pendingLots = lots.filter((l) => l.pendingGate);
      return {
        ...s,
        stacks,
        displayQty: sum(stacks.map((st) => st.displayQty)),
        pendingDisplayQty: sum(pendingLots.map((l) => l.displayQty)),
        pendingGateCount: new Set(
          pendingLots.map((l) => l.pendingGate!.gateOperationUuid),
        ).size,
      };
    };
    const groups = p.groups.map((g) => {
      const senders = g.senders.map(rollSender);
      return {
        ...g,
        senders,
        summary: {
          ...g.summary,
          displayQty: sum(senders.map((s) => s.displayQty)),
          pendingDisplayQty: sum(senders.map((s) => s.pendingDisplayQty)),
        },
      };
    });
    const lots = groups.flatMap((g) =>
      g.senders.flatMap((s) => s.stacks.flatMap((st) => st.lots)),
    );
    const pendingLots = lots.filter((l) => l.pendingGate);
    return {
      ...p,
      groups,
      stackCount: stackIds.size,
      senderCount: senderNames.size,
      qty: sum(lots.map((l) => l.qty)),
      displayQty: sum(groups.map((g) => g.summary.displayQty)),
      pendingQty: sum(pendingLots.map((l) => l.qty)),
      pendingDisplayQty: sum(pendingLots.map((l) => l.displayQty)),
    };
  });
}

@Injectable()
export class ReportsAnalyticsExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseContext: WarehouseContextService,
    private readonly analytics: ReportsAnalyticsService,
  ) {}

  /**
   * Stock inbound grouping as a workbook: a summary per product, folder and sender,
   * and one row per lot with its incoming documents or pending gate.
   */
  async generateStockInboundXlsx(
    warehouseId: number,
    search?: string,
  ): Promise<ExportFile> {
    const data = await this.loadStockInbound(warehouseId, search);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bulog WMS';
    workbook.created = new Date();

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    const pendingFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEF3C7' },
    };
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    /** Title block, returns the row the table header goes on */
    const writeTitle = (sheet: ExcelJS.Worksheet, lastCol: string) => {
      const lines = [
        'STOK INBOUND GROUPING',
        `Gudang: ${data.warehouseName}`,
        `Dicetak: ${data.printedAt}`,
        ...(data.search ? [`Filter pencarian: "${data.search}"`] : []),
        `Total stok: ${this.formatTotals(data.totals)}  |  ${data.products.length} produk  |  ${data.stackCount} tumpukan`,
      ];
      lines.forEach((text, i) => {
        const row = i + 1;
        sheet.mergeCells(`A${row}:${lastCol}${row}`);
        const cell = sheet.getCell(`A${row}`);
        cell.value = text;
        cell.font = { name: 'Calibri', size: i === 0 ? 12 : 10, bold: i === 0 };
      });
      return lines.length + 2;
    };

    /**
     * Writes a filterable table; columns marked `qty` take the number format of the
     * row's unit, and rows from pending gates are highlighted
     */
    const writeTable = (
      sheet: ExcelJS.Worksheet,
      columns: { header: string; width: number; numFmt?: string; qty?: true }[],
      rows: { values: Cell[]; unit: AnalyticsUnitGroup; pending?: boolean }[],
    ) => {
      const lastCol = sheet.getColumn(columns.length).letter;
      const headerRowIndex = writeTitle(sheet, lastCol);

      columns.forEach((c, i) => {
        sheet.getColumn(i + 1).width = c.width;
      });
      const header = sheet.getRow(headerRowIndex);
      columns.forEach((c, i) => {
        const cell = header.getCell(i + 1);
        cell.value = c.header;
        cell.font = { name: 'Calibri', size: 10, bold: true };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
        cell.fill = headerFill;
        cell.border = thinBorder;
      });

      rows.forEach(({ values, unit, pending }, idx) => {
        const row = sheet.getRow(headerRowIndex + 1 + idx);
        values.forEach((value, i) => {
          const cell = row.getCell(i + 1);
          cell.value = value;
          cell.font = { name: 'Calibri', size: 9 };
          cell.border = thinBorder;
          cell.alignment = { vertical: 'top', wrapText: true };
          const numFmt = columns[i].qty ? qtyNumFmt(unit) : columns[i].numFmt;
          if (numFmt) cell.numFmt = numFmt;
          if (pending) cell.fill = pendingFill;
        });
      });

      sheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];
      sheet.autoFilter = {
        from: { row: headerRowIndex, column: 1 },
        to: { row: headerRowIndex + rows.length, column: columns.length },
      };
    };

    // Summary: one row per product, folder and sender
    const summary = workbook.addWorksheet('Ringkasan', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToWidth: 1 },
    });
    const summaryRows: Parameters<typeof writeTable>[2] = [];
    for (const p of data.products) {
      for (const g of p.groups) {
        for (const s of g.senders) {
          summaryRows.push({
            unit: p.unit,
            values: [
              summaryRows.length + 1,
              p.category,
              p.sku,
              formatProductName(p.name),
              folderLabel(g),
              s.name,
              s.originCategory,
              s.stacks.length,
              s.stacks.reduce((n, st) => n + st.lots.length, 0),
              s.pendingDisplayQty,
              s.displayQty,
              p.unit.displayUnit,
            ],
          });
        }
      }
    }
    writeTable(
      summary,
      [
        { header: 'No', width: 6 },
        { header: 'Kategori', width: 12 },
        { header: 'SKU', width: 14 },
        { header: 'Produk', width: 42 },
        { header: 'Folder', width: 18 },
        { header: 'Pengirim', width: 32 },
        { header: 'Asal', width: 14 },
        { header: 'Tumpukan', width: 10, numFmt: '#,##0' },
        { header: 'Lot', width: 8, numFmt: '#,##0' },
        { header: 'Belum Diadministrasi', width: 14, qty: true },
        { header: 'Qty', width: 15, qty: true },
        { header: 'Satuan', width: 9 },
      ],
      summaryRows,
    );

    // Detail: one row per lot
    const detail = workbook.addWorksheet('Detail Lot', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToWidth: 1 },
    });
    const detailRows: Parameters<typeof writeTable>[2] = [];
    for (const p of data.products) {
      for (const g of p.groups) {
        for (const s of g.senders) {
          for (const st of s.stacks) {
            for (const lot of st.lots) {
              const refs = this.lotReferences(lot, data.timezone);
              detailRows.push({
                unit: p.unit,
                pending: Boolean(lot.pendingGate),
                values: [
                  detailRows.length + 1,
                  p.category,
                  p.sku,
                  formatProductName(p.name),
                  folderLabel(g),
                  s.name,
                  s.originCategory,
                  st.locationName,
                  lot.lotName || 'Tanpa lot',
                  lotStatus(lot),
                  refs.numbers.join('\n') || '-',
                  refs.dates.join('\n') || '-',
                  lot.displayQty,
                  p.unit.displayUnit,
                ],
              });
            }
          }
        }
      }
    }
    writeTable(
      detail,
      [
        { header: 'No', width: 6 },
        { header: 'Kategori', width: 12 },
        { header: 'SKU', width: 14 },
        { header: 'Produk', width: 38 },
        { header: 'Folder', width: 16 },
        { header: 'Pengirim', width: 28 },
        { header: 'Asal', width: 13 },
        { header: 'Tumpukan', width: 18 },
        { header: 'Lot', width: 20 },
        { header: 'Status', width: 18 },
        { header: 'Dokumen / Gate', width: 24 },
        { header: 'Tanggal', width: 14 },
        { header: 'Qty', width: 14, qty: true },
        { header: 'Satuan', width: 9 },
      ],
      detailRows,
    );

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { buffer, filename: `stok-inbound-${data.fileDate}.xlsx` };
  }

  /**
   * Stock inbound grouping as a landscape A4 PDF: product → folder → sender → lot
   * rows, with the stack and the incoming documents or pending gate of each lot.
   */
  async generateStockInboundPdf(
    warehouseId: number,
    search?: string,
  ): Promise<ExportFile> {
    const data = await this.loadStockInbound(warehouseId, search);

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 30,
        size: 'A4',
        layout: 'landscape',
        bufferPages: true,
      });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const left = 30;
      const right = doc.page.width - 30;
      const width = right - left;
      const bottom = doc.page.height - 40;
      const qtyX = right - 190;

      // Lot table columns, indented under the sender
      const cols = {
        stack: { x: 60, w: 140 },
        lot: { x: 205, w: 130 },
        refs: { x: 340, w: 200 },
        date: { x: 545, w: 85 },
        qty: { x: 635, w: right - 635 },
      };

      const drawPageHeader = () => {
        doc
          .fillColor('#1e293b')
          .font('Helvetica-Bold')
          .fontSize(12)
          .text('STOK INBOUND GROUPING', left, 30, { width, align: 'center' });
        const subtitle = [
          `Gudang: ${data.warehouseName}`,
          `Dicetak: ${data.printedAt}`,
          ...(data.search ? [`Filter: "${data.search}"`] : []),
        ].join('  |  ');
        doc
          .fillColor('#64748b')
          .font('Helvetica')
          .fontSize(8)
          .text(subtitle, left, 46, { width, align: 'center' });
        doc.moveTo(left, 60).lineTo(right, 60).lineWidth(0.5).stroke('#475569');

        doc.fillColor('#475569').font('Helvetica-Bold').fontSize(7.5);
        doc.text('Tumpukan', cols.stack.x, 66, { width: cols.stack.w });
        doc.text('Lot', cols.lot.x, 66, { width: cols.lot.w });
        doc.text('Dokumen masuk / Gate', cols.refs.x, 66, {
          width: cols.refs.w,
        });
        doc.text('Tanggal', cols.date.x, 66, { width: cols.date.w });
        doc.text('Qty', cols.qty.x, 66, { width: cols.qty.w, align: 'right' });
        doc.moveTo(left, 78).lineTo(right, 78).lineWidth(0.5).stroke('#475569');
        return 84;
      };

      let y = drawPageHeader();

      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(9);
      doc.text(
        `Total stok: ${this.formatTotals(data.totals)}     ${data.products.length} produk  ·  ${data.stackCount} tumpukan`,
        left,
        y,
        { width },
      );
      y += 18;

      /** Moves to a new page when the next block does not fit */
      const ensureSpace = (height: number, onNewPage?: () => void) => {
        if (y + height <= bottom) return;
        doc.addPage();
        y = drawPageHeader();
        onNewPage?.();
      };

      if (data.products.length === 0) {
        doc
          .fillColor('#94a3b8')
          .font('Helvetica')
          .fontSize(9)
          .text('Tidak ada stok yang cocok.', left, y, {
            width,
            align: 'center',
          });
      }

      for (const p of data.products) {
        const productName = formatProductName(p.name);
        const hasFolders = p.groups.some((g) => g.folder);

        const drawProductBand = (continued = false) => {
          doc.rect(left, y, width, 26).fill('#f1f5f9');
          doc
            .fillColor('#1e293b')
            .font('Helvetica-Bold')
            .fontSize(9)
            .text(
              continued ? `${productName} (lanjutan)` : productName,
              left + 6,
              y + 4,
              { width: width - 200, lineBreak: false, ellipsis: true },
            );
          doc
            .fillColor('#64748b')
            .font('Helvetica')
            .fontSize(7)
            .text(
              `${p.sku}  ·  ${p.category}  ·  ${p.senderCount} pengirim  ·  ${p.stackCount} tumpukan`,
              left + 6,
              y + 15,
              { width: width - 200 },
            );
          doc
            .fillColor('#1e293b')
            .font('Helvetica-Bold')
            .fontSize(9)
            .text(formatGroupValue(p.displayQty, p.unit), qtyX, y + 4, {
              width: 184,
              align: 'right',
            });
          if (p.pendingDisplayQty !== 0) {
            doc
              .fillColor('#b45309')
              .font('Helvetica')
              .fontSize(7)
              .text(
                `${formatGroupValue(p.pendingDisplayQty, p.unit)} belum diadministrasi`,
                qtyX,
                y + 15,
                { width: 184, align: 'right' },
              );
          }
          y += 30;
        };

        ensureSpace(30 + 16 + 16);
        drawProductBand();

        for (const g of p.groups) {
          const drawFolderRow = () => {
            doc
              .fillColor('#1d4ed8')
              .font('Helvetica-Bold')
              .fontSize(8)
              .text(`Folder: ${folderLabel(g)}`, left + 6, y + 3, {
                width: width - 220,
                lineBreak: false,
                ellipsis: true,
              });
            doc.text(
              formatGroupValue(g.summary.displayQty, p.unit),
              qtyX,
              y + 3,
              { width: 184, align: 'right' },
            );
            y += 15;
          };

          if (hasFolders) {
            ensureSpace(15 + 16 + 16, () => drawProductBand(true));
            drawFolderRow();
          }

          for (const s of g.senders) {
            const drawSenderRow = () => {
              doc
                .fillColor('#334155')
                .font('Helvetica-Bold')
                .fontSize(8)
                .text(`${s.name}  [${s.originCategory}]`, left + 16, y + 3, {
                  width: width - 230,
                  lineBreak: false,
                  ellipsis: true,
                });
              doc.text(formatGroupValue(s.displayQty, p.unit), qtyX, y + 3, {
                width: 184,
                align: 'right',
              });
              doc
                .moveTo(left + 16, y + 15)
                .lineTo(right, y + 15)
                .lineWidth(0.3)
                .stroke('#cbd5e1');
              y += 16;
            };

            ensureSpace(16 + 16, () => {
              drawProductBand(true);
              if (hasFolders) drawFolderRow();
            });
            drawSenderRow();

            for (const st of s.stacks) {
              for (const lot of st.lots) {
                const refs = this.lotReferences(lot, data.timezone);
                const refText = lot.pendingGate
                  ? `${refs.numbers.join('\n')} (belum diadministrasi)`
                  : refs.numbers.join('\n') ||
                    'Lot tidak ditemukan di dokumen masuk';
                const dateText = refs.dates.join('\n') || '-';

                doc.font('Helvetica').fontSize(7);
                const textHeight = Math.max(
                  doc.heightOfString(st.locationName, { width: cols.stack.w }),
                  doc.heightOfString(lot.lotName || 'Tanpa lot', {
                    width: cols.lot.w,
                  }),
                  doc.heightOfString(refText, { width: cols.refs.w }),
                );
                const rowHeight = Math.max(textHeight + 6, 14);

                ensureSpace(rowHeight, () => {
                  drawProductBand(true);
                  if (hasFolders) drawFolderRow();
                  drawSenderRow();
                });

                if (lot.pendingGate) {
                  doc
                    .rect(
                      cols.stack.x - 4,
                      y,
                      right - cols.stack.x + 4,
                      rowHeight,
                    )
                    .fill('#fffbeb');
                }

                doc.fillColor('#475569').font('Helvetica').fontSize(7);
                doc.text(st.locationName, cols.stack.x, y + 3, {
                  width: cols.stack.w,
                });
                doc
                  .fillColor('#334155')
                  .text(lot.lotName || 'Tanpa lot', cols.lot.x, y + 3, {
                    width: cols.lot.w,
                  });
                doc
                  .fillColor(
                    lot.pendingGate
                      ? '#b45309'
                      : lot.documents.length
                        ? '#334155'
                        : '#94a3b8',
                  )
                  .text(refText, cols.refs.x, y + 3, { width: cols.refs.w });
                doc
                  .fillColor('#64748b')
                  .text(dateText, cols.date.x, y + 3, { width: cols.date.w });
                doc
                  .fillColor('#1e293b')
                  .font('Helvetica-Bold')
                  .text(
                    formatGroupValue(lot.displayQty, p.unit),
                    cols.qty.x,
                    y + 3,
                    { width: cols.qty.w, align: 'right' },
                  );
                doc
                  .moveTo(cols.stack.x, y + rowHeight)
                  .lineTo(right, y + rowHeight)
                  .lineWidth(0.15)
                  .stroke('#e2e8f0');
                y += rowHeight;
              }
            }
          }
        }
        y += 8;
      }

      // Page numbers; drop the bottom margin so the footer does not open a new page
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.page.margins.bottom = 0;
        doc
          .fillColor('#94a3b8')
          .font('Helvetica')
          .fontSize(7)
          .text(
            `Halaman ${i + 1} dari ${range.count}`,
            left,
            doc.page.height - 25,
            { width, align: 'right', lineBreak: false },
          );
      }

      doc.end();
    });

    return { buffer, filename: `stok-inbound-${data.fileDate}.pdf` };
  }

  private async loadStockInbound(
    warehouseId: number,
    search?: string,
  ): Promise<StockInboundExportData> {
    const timezone = this.warehouseContext.getTimezone();
    const [warehouse, stock] = await Promise.all([
      this.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { name: true },
      }),
      this.analytics.getStockInbound(warehouseId),
    ]);

    const products = search
      ? rollUpFromLots(filterInboundProducts(stock.products, search))
      : stock.products;

    // Totals in the product units (Kg) rather than the response totals (Ton), so the
    // header matches the rows; also keeps a filtered file consistent
    const totals = new Map<string, UnitTotal>();
    const stackIds = new Set<string>();
    for (const p of products) {
      const total = totals.get(p.unit.key) || {
        ...p.unit,
        displayQty: 0,
        pendingDisplayQty: 0,
      };
      total.displayQty += p.displayQty;
      total.pendingDisplayQty += p.pendingDisplayQty;
      totals.set(p.unit.key, total);
      for (const g of p.groups) {
        for (const s of g.senders) {
          for (const st of s.stacks) stackIds.add(st.locationUuid);
        }
      }
    }

    const now = new Date();
    return {
      warehouseName: warehouse?.name || 'Gudang WMS',
      printedAt: new Intl.DateTimeFormat('id-ID', {
        timeZone: timezone,
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(now),
      fileDate: formatDateInTimezone(now, timezone),
      search: search?.trim() || '',
      timezone,
      products,
      totals: Array.from(totals.values())
        .sort(compareUnitGroups)
        .map((t) => ({
          ...t,
          displayQty: round3(t.displayQty),
          pendingDisplayQty: round3(t.pendingDisplayQty),
        })),
      stackCount: search ? stackIds.size : stock.stackCount,
    };
  }

  /** "12.345 Kg (termasuk 500 Kg belum diadministrasi) · 20 Lembar" */
  private formatTotals(totals: UnitTotal[]) {
    if (totals.length === 0) return '0';
    return totals
      .map((t) =>
        t.pendingDisplayQty !== 0
          ? `${formatGroupValue(t.displayQty, t)} (termasuk ${formatGroupValue(t.pendingDisplayQty, t)} belum diadministrasi)`
          : formatGroupValue(t.displayQty, t),
      )
      .join(' · ');
  }

  /** Incoming document numbers and dates of a lot, or its pending gate */
  private lotReferences(lot: InboundLot, timezone: string) {
    if (lot.pendingGate) {
      return {
        numbers: [lot.pendingGate.opNumber],
        dates: [this.formatDate(lot.pendingGate.date, timezone)],
      };
    }
    return {
      numbers: lot.documents.map((d) => d.documentNumber),
      dates: lot.documents.map((d) => this.formatDate(d.dateDone, timezone)),
    };
  }

  private formatDate(iso: string | null, timezone: string) {
    if (!iso) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: timezone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  }
}

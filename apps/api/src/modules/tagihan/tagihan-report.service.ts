import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { OdooClient } from '@/modules/odoo/odoo-client';
import { OdooSessionManager } from '@/modules/odoo/odoo-session.manager';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import {
  getSecondaryQty,
  type TagihanReportType,
  type TagihanReportJobStatus,
} from '@bulog-wms/schema';

export interface ReportStatusResponse {
  fingerprint: string;
  tagihanType: string;
  reports: Record<
    TagihanReportType,
    {
      status: 'IDLE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
      file: {
        uuid: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
        downloadUrl: string;
        generatedAt?: Date | null;
      } | null;
      jobUuid?: string | null;
      progress: number;
      errorMessage?: string | null;
    }
  >;
}

@Injectable()
export class TagihanReportService {
  private readonly logger = new Logger(TagihanReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly odooClient: OdooClient,
    private readonly odooSessionManager: OdooSessionManager,
    private readonly warehouseContext: WarehouseContextService,
    @InjectQueue('tagihan-reports') private readonly reportQueue: Queue,
  ) {}

  /**
   * Computes a deterministic SHA-256 fingerprint from related ERP commodity documents.
   * Invalidates whenever documents are added, removed, or their items/quantities change.
   */
  public computeTagihanFingerprint(tagihan: any): string {
    const docRefs = (tagihan.documentReferences || [])
      .map((r: any) => {
        const doc = r.documentReference;
        if (!doc) return null;
        return {
          id: doc.id,
          number: doc.documentNumber,
          type: doc.pickingTypeCode,
          dateDone: doc.dateDone ? new Date(doc.dateDone).toISOString() : null,
          scheduledDate: doc.scheduledDate
            ? new Date(doc.scheduledDate).toISOString()
            : null,
          updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
          items: (doc.items || [])
            .map((it: any) => ({
              name: it.productName,
              qty: Number(it.quantity || it.productQty || 0),
              uom: it.uom,
            }))
            .sort((a: any, b: any) => a.name.localeCompare(b.name)),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.id - b.id);

    const payload = {
      tagihanId: tagihan.id,
      tagihanType: tagihan.type,
      warehouseId: tagihan.warehouseId,
      documentNumber: tagihan.documentNumber,
      documents: docRefs,
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  /**
   * Formats Indonesian date range string for report header (e.g. "18 - 23 Agustus 2026")
   */
  public formatIndonesianPeriod(dates: Date[]): string {
    const validDates = dates
      .filter((d) => d && !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (validDates.length === 0) return '-';

    const monthNames = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];

    const minDate = validDates[0];
    const maxDate = validDates[validDates.length - 1];

    const d1 = minDate.getDate();
    const m1 = minDate.getMonth();
    const y1 = minDate.getFullYear();

    const d2 = maxDate.getDate();
    const m2 = maxDate.getMonth();
    const y2 = maxDate.getFullYear();

    if (d1 === d2 && m1 === m2 && y1 === y2) {
      return `${d1} ${monthNames[m1]} ${y1}`;
    }

    if (m1 === m2 && y1 === y2) {
      return `${d1} - ${d2} ${monthNames[m1]} ${y1}`;
    }

    if (y1 === y2) {
      return `${d1} ${monthNames[m1]} - ${d2} ${monthNames[m2]} ${y1}`;
    }

    return `${d1} ${monthNames[m1]} ${y1} - ${d2} ${monthNames[m2]} ${y2}`;
  }

  /**
   * Formats single date to Indonesian string (e.g. "18 August 2026" or "18 Agustus 2026")
   */
  public formatSingleDate(d?: Date | null): string {
    if (!d || isNaN(d.getTime())) return '-';
    const monthNames = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  }

  /**
   * Helper to format Kanwil and Kompleks Gudang headers
   */
  public getReportHeaderLabels(warehouse: any) {
    const wName = (warehouse?.name || 'Landasan Ulin').trim();
    const location = (warehouse?.location || 'KANTOR WILAYAH KALSEL').trim();

    const kanwil = location.toUpperCase().includes('KANWIL')
      ? location.toUpperCase()
      : `KANTOR WILAYAH KALSEL`;

    const cleanedName = wName.replace(/^Gudang\s+/i, '').toUpperCase();
    const kompleksGudang = cleanedName.startsWith('KOMPLEKS')
      ? cleanedName
      : `KOMPLEKS PERGUDANGAN ${cleanedName}`;

    return { kanwil, kompleksGudang };
  }

  /**
   * Get real-time status of all report types for a Tagihan.
   */
  async getReportsStatus(
    warehouseId: number,
    tagihanUuid: string,
  ): Promise<ReportStatusResponse> {
    const tagihan = await this.prisma.tagihan.findFirst({
      where: { uuid: tagihanUuid, warehouseId },
      include: {
        warehouse: true,
        documentReferences: {
          include: {
            documentReference: {
              include: { items: true },
            },
          },
        },
        files: {
          orderBy: { uploadedAt: 'desc' },
        },
        reportJobs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!tagihan) {
      throw new NotFoundException('Data Tagihan tidak ditemukan.');
    }

    const currentFingerprint = this.computeTagihanFingerprint(tagihan);
    const reportTypes: TagihanReportType[] = [
      'COMMODITY_RECAP_EXCEL',
      'COMMODITY_RECAP_PDF',
      'ODOO_REPORT_PDF',
    ];

    const reportsResult: any = {};

    for (const rType of reportTypes) {
      // 1. Check for existing cached TagihanFile with matching fingerprint
      const cachedFile = tagihan.files.find(
        (f) => f.fileType === rType && f.fingerprint === currentFingerprint,
      );

      if (cachedFile) {
        // Validate physical presence in MinIO storage
        const exists = await this.storageService.checkFileExists(cachedFile.filePath);
        if (exists) {
          const downloadUrl = await this.storageService.getFilePrivateUrl(
            cachedFile.filePath,
            3600,
          );
          reportsResult[rType] = {
            status: 'COMPLETED',
            file: {
              uuid: cachedFile.uuid,
              fileName: cachedFile.fileName,
              fileSize: cachedFile.fileSize,
              mimeType: cachedFile.mimeType,
              downloadUrl,
              generatedAt: cachedFile.generatedAt,
            },
            jobUuid: cachedFile.jobId || null,
            progress: 100,
            errorMessage: null,
          };
          continue;
        }
      }

      // 2. Check for active or recent job for this report type
      const latestJob = tagihan.reportJobs.find(
        (j) => j.reportType === rType && j.fingerprint === currentFingerprint,
      );

      if (latestJob) {
        // Check for stuck job (> 5 minutes in PENDING/PROCESSING)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (
          (latestJob.status === 'PENDING' || latestJob.status === 'PROCESSING') &&
          latestJob.createdAt < fiveMinutesAgo
        ) {
          this.logger.warn(
            `Job ${latestJob.uuid} stuck for tagihan ${tagihan.documentNumber}. Marking as FAILED.`,
          );
          await this.prisma.tagihanReportJob.update({
            where: { id: latestJob.id },
            data: {
              status: 'FAILED',
              errorMessage: 'Proses generate melebihi batas waktu (timeout).',
              completedAt: new Date(),
            },
          });
          reportsResult[rType] = {
            status: 'FAILED',
            file: null,
            jobUuid: latestJob.uuid,
            progress: 0,
            errorMessage: 'Proses generate melebihi batas waktu (timeout).',
          };
          continue;
        }

        if (latestJob.status === 'COMPLETED' && latestJob.tagihanFileId) {
          const fileRecord = await this.prisma.tagihanFile.findUnique({
            where: { id: latestJob.tagihanFileId },
          });
          if (fileRecord) {
            const exists = await this.storageService.checkFileExists(fileRecord.filePath);
            if (exists) {
              const downloadUrl = await this.storageService.getFilePrivateUrl(
                fileRecord.filePath,
                3600,
              );
              reportsResult[rType] = {
                status: 'COMPLETED',
                file: {
                  uuid: fileRecord.uuid,
                  fileName: fileRecord.fileName,
                  fileSize: fileRecord.fileSize,
                  mimeType: fileRecord.mimeType,
                  downloadUrl,
                  generatedAt: fileRecord.generatedAt,
                },
                jobUuid: latestJob.uuid,
                progress: 100,
                errorMessage: null,
              };
              continue;
            }
          }
        }

        reportsResult[rType] = {
          status: latestJob.status,
          file: null,
          jobUuid: latestJob.uuid,
          progress: latestJob.progress,
          errorMessage: latestJob.errorMessage,
        };
        continue;
      }

      // Default: IDLE
      reportsResult[rType] = {
        status: 'IDLE',
        file: null,
        jobUuid: null,
        progress: 0,
        errorMessage: null,
      };
    }

    return {
      fingerprint: currentFingerprint,
      tagihanType: tagihan.type,
      reports: reportsResult,
    };
  }

  /**
   * Request background report generation with atomic anti-duplicate check.
   */
  async requestReportGeneration(
    warehouseId: number,
    tagihanUuid: string,
    reportType: TagihanReportType,
    userId: number,
  ) {
    const tagihan = await this.prisma.tagihan.findFirst({
      where: { uuid: tagihanUuid, warehouseId },
      include: {
        warehouse: true,
        documentReferences: {
          include: {
            documentReference: {
              include: { items: true },
            },
          },
        },
        files: true,
        reportJobs: true,
      },
    });

    if (!tagihan) {
      throw new NotFoundException('Data Tagihan tidak ditemukan.');
    }

    if (tagihan.type !== 'LOADING' && tagihan.type !== 'UNLOADING') {
      throw new BadRequestException(
        'Fitur ini hanya tersedia untuk tagihan kategori Loading dan Unloading.',
      );
    }

    if (!tagihan.documentReferences || tagihan.documentReferences.length === 0) {
      throw new BadRequestException(
        'Tagihan belum memiliki dokumen ERP Commodity terkait.',
      );
    }

    const currentFingerprint = this.computeTagihanFingerprint(tagihan);

    // 1. Direct cache check: Valid file exists with matching fingerprint & physically present
    const cachedFile = tagihan.files.find(
      (f) => f.fileType === reportType && f.fingerprint === currentFingerprint,
    );

    if (cachedFile) {
      const exists = await this.storageService.checkFileExists(cachedFile.filePath);
      if (exists) {
        const downloadUrl = await this.storageService.getFilePrivateUrl(
          cachedFile.filePath,
          3600,
        );
        return {
          status: 'COMPLETED',
          isCached: true,
          file: {
            uuid: cachedFile.uuid,
            fileName: cachedFile.fileName,
            downloadUrl,
            fileSize: cachedFile.fileSize,
            mimeType: cachedFile.mimeType,
          },
        };
      }
    }

    // 2. Atomic duplicate check: Find active job (PENDING or PROCESSING)
    const activeJob = await this.prisma.tagihanReportJob.findFirst({
      where: {
        tagihanId: tagihan.id,
        reportType,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    if (activeJob) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (activeJob.createdAt < fiveMinutesAgo) {
        this.logger.warn(`Stuck job ${activeJob.uuid} detected. Cancelling...`);
        await this.prisma.tagihanReportJob.update({
          where: { id: activeJob.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Timeout: Pekerjaan sebelumnya dibatalkan karena tidak merespon.',
            completedAt: new Date(),
          },
        });
      } else {
        // Return existing running job, avoid duplicate!
        return {
          status: activeJob.status,
          isCached: false,
          jobUuid: activeJob.uuid,
          progress: activeJob.progress,
          message: 'Pekerjaan sedang berlangsung.',
        };
      }
    }

    // 3. Create new TagihanReportJob in database
    const newJob = await this.prisma.tagihanReportJob.create({
      data: {
        tagihanId: tagihan.id,
        reportType,
        status: 'PENDING',
        fingerprint: currentFingerprint,
        progress: 10,
      },
    });

    // 4. Enqueue BullMQ job
    try {
      await this.reportQueue.add(
        'process-report',
        {
          jobUuid: newJob.uuid,
          tagihanId: tagihan.id,
          tagihanUuid: tagihan.uuid,
          reportType,
          fingerprint: currentFingerprint,
          warehouseId,
          userId,
        },
        {
          jobId: newJob.uuid,
          attempts: 2,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch (enqueueErr: any) {
      this.logger.error(
        `Failed to enqueue report job ${newJob.uuid}: ${enqueueErr.message}`,
        enqueueErr.stack,
      );
      await this.prisma.tagihanReportJob.update({
        where: { id: newJob.id },
        data: {
          status: 'FAILED',
          errorMessage: enqueueErr.message || 'Gagal menambahkan antrean job.',
          completedAt: new Date(),
        },
      });
      throw enqueueErr;
    }

    return {
      status: 'PENDING',
      isCached: false,
      jobUuid: newJob.uuid,
      progress: 10,
      message: 'Permintaan generate laporan telah dijadwalkan.',
    };
  }

  /**
   * Generates Rekapitulasi Commodity Excel (.xlsx) matching reference format.
   */
  async generateCommodityRecapExcel(tagihan: any): Promise<Buffer> {
    const isOut = tagihan.type === 'LOADING';
    const title = isOut
      ? 'LAPORAN REKAPITULASI PENGELUARAN'
      : 'LAPORAN REKAPITULASI PEMASUKAN';
    const dateColTitle = isOut ? 'Tanggal Pengeluaran' : 'Tanggal Pemasukan';
    const docNoColTitle = isOut
      ? 'Nomor Dokumen Pengeluaran'
      : 'Nomor Dokumen Pemasukan';

    const { kanwil, kompleksGudang } = this.getReportHeaderLabels(tagihan.warehouse);

    // Prepare sorted rows from ERP documents
    const rows = (tagihan.documentReferences || [])
      .map((r: any) => r.documentReference)
      .filter(Boolean)
      .map((doc: any) => {
        const docDate = doc.dateDone ? new Date(doc.dateDone) : doc.scheduledDate ? new Date(doc.scheduledDate) : null;
        let primaryQtyTotal = 0;
        let secondaryQtyTotal = 0;

        for (const it of doc.items || []) {
          const pQty = Number(it.quantity || it.productQty || 0);
          const sQty = getSecondaryQty(pQty, it.uom);
          primaryQtyTotal += pQty;
          secondaryQtyTotal += sQty;
        }

        return {
          id: doc.id,
          date: docDate,
          documentNumber: doc.documentNumber,
          quantity: Math.round(primaryQtyTotal * 100) / 100,
          quantum: Math.round(secondaryQtyTotal * 100) / 100,
        };
      })
      .sort((a: any, b: any) => {
        const timeA = a.date ? a.date.getTime() : 0;
        const timeB = b.date ? b.date.getTime() : 0;
        return timeA - timeB;
      });

    const dates = rows.map((r: any) => r.date).filter(Boolean);
    const periodStr = this.formatIndonesianPeriod(dates);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bulog WMS';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Rekapitulasi', {
      pageSetup: { paperSize: 9, orientation: 'portrait' },
    });

    // Header Information
    sheet.mergeCells('A1:E1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { name: 'Calibri', size: 12, bold: true };

    sheet.mergeCells('A2:E2');
    const kanwilCell = sheet.getCell('A2');
    kanwilCell.value = `Kanwil :${kanwil}`;
    kanwilCell.font = { name: 'Calibri', size: 10, bold: true };

    sheet.mergeCells('A3:E3');
    const gudangCell = sheet.getCell('A3');
    gudangCell.value = `Kompleks Gudang :${kompleksGudang}`;
    gudangCell.font = { name: 'Calibri', size: 10, bold: true };

    sheet.mergeCells('A4:E4');
    const periodeCell = sheet.getCell('A4');
    periodeCell.value = `Periode :${periodStr}`;
    periodeCell.font = { name: 'Calibri', size: 10 };

    // Empty Row
    sheet.addRow([]);

    // Table Headers (Rows 6 & 7)
    sheet.mergeCells('A6:A7');
    sheet.getCell('A6').value = 'No';

    sheet.mergeCells('B6:B7');
    sheet.getCell('B6').value = dateColTitle;

    sheet.mergeCells('C6:C7');
    sheet.getCell('C6').value = docNoColTitle;

    sheet.mergeCells('D6:E6');
    sheet.getCell('D6').value = 'Jumlah';

    sheet.getCell('D7').value = 'Kuantitas';
    sheet.getCell('E7').value = 'Kuantum';

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    ['A6', 'B6', 'C6', 'D6', 'E6', 'A7', 'B7', 'C7', 'D7', 'E7'].forEach(
      (cellKey) => {
        const c = sheet.getCell(cellKey);
        c.font = { name: 'Calibri', size: 10, bold: true };
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        c.fill = headerFill;
        c.border = thinBorder;
      },
    );

    let totalQuantity = 0;
    let totalQuantum = 0;

    // Data Rows starting at Row 8
    rows.forEach((row: any, idx: number) => {
      const rowIndex = 8 + idx;
      totalQuantity += row.quantity;
      totalQuantum += row.quantum;

      sheet.addRow([
        idx + 1,
        this.formatSingleDate(row.date),
        row.documentNumber,
        row.quantity,
        row.quantum,
      ]);

      const r = sheet.getRow(rowIndex);
      r.getCell(1).alignment = { horizontal: 'center' };
      r.getCell(2).alignment = { horizontal: 'center' };
      r.getCell(3).alignment = { horizontal: 'left' };
      r.getCell(4).alignment = { horizontal: 'right' };
      r.getCell(5).alignment = { horizontal: 'right' };

      r.getCell(4).numFmt = '#,##0.00';
      r.getCell(5).numFmt = '#,##0.00';

      for (let c = 1; c <= 5; c++) {
        r.getCell(c).font = { name: 'Calibri', size: 9 };
        r.getCell(c).border = thinBorder;
      }
    });

    // Summary / Total Row
    const totalRowIndex = 8 + rows.length;
    sheet.mergeCells(`A${totalRowIndex}:C${totalRowIndex}`);
    const sumLabelCell = sheet.getCell(`A${totalRowIndex}`);
    sumLabelCell.value = 'Jumlah';
    sumLabelCell.font = { name: 'Calibri', size: 10, bold: true };
    sumLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const sumQtyCell = sheet.getCell(`D${totalRowIndex}`);
    sumQtyCell.value = totalQuantity;
    sumQtyCell.font = { name: 'Calibri', size: 10, bold: true };
    sumQtyCell.alignment = { horizontal: 'right' };
    sumQtyCell.numFmt = '#,##0.00';

    const sumQtmCell = sheet.getCell(`E${totalRowIndex}`);
    sumQtmCell.value = totalQuantum;
    sumQtmCell.font = { name: 'Calibri', size: 10, bold: true };
    sumQtmCell.alignment = { horizontal: 'right' };
    sumQtmCell.numFmt = '#,##0.00';

    const thickBottomBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' },
    };

    [`A${totalRowIndex}`, `B${totalRowIndex}`, `C${totalRowIndex}`, `D${totalRowIndex}`, `E${totalRowIndex}`].forEach(
      (cKey) => {
        const c = sheet.getCell(cKey);
        c.border = thickBottomBorder;
        c.fill = headerFill;
      },
    );

    // Signature Block (4 rows after table)
    const sigRow1 = totalRowIndex + 3;
    const sigRow2 = totalRowIndex + 8;
    sheet.getCell(`E${sigRow1}`).value = '';
    sheet.getCell(`E${sigRow2}`).value = 'EFDY AFDIANOOR\nKepala Gudang';
    sheet.getCell(`E${sigRow2}`).font = { name: 'Calibri', size: 10, bold: true };
    sheet.getCell(`E${sigRow2}`).alignment = { horizontal: 'center', wrapText: true };

    // Column widths
    sheet.getColumn(1).width = 6;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 38;
    sheet.getColumn(4).width = 16;
    sheet.getColumn(5).width = 18;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generates Rekapitulasi Commodity PDF matching reference PDF format.
   */
  async generateCommodityRecapPdf(tagihan: any): Promise<Buffer> {
    const isOut = tagihan.type === 'LOADING';
    const title = isOut
      ? 'LAPORAN REKAPITULASI PENGELUARAN'
      : 'LAPORAN REKAPITULASI PEMASUKAN';
    const dateColTitle = isOut ? 'Tanggal Pengeluaran' : 'Tanggal Pemasukan';
    const docNoColTitle = isOut
      ? 'Nomor Dokumen Pengeluaran'
      : 'Nomor Dokumen Pemasukan';

    const { kanwil, kompleksGudang } = this.getReportHeaderLabels(tagihan.warehouse);

    const rows = (tagihan.documentReferences || [])
      .map((r: any) => r.documentReference)
      .filter(Boolean)
      .map((doc: any) => {
        const docDate = doc.dateDone ? new Date(doc.dateDone) : doc.scheduledDate ? new Date(doc.scheduledDate) : null;
        let primaryQtyTotal = 0;
        let secondaryQtyTotal = 0;

        for (const it of doc.items || []) {
          const pQty = Number(it.quantity || it.productQty || 0);
          const sQty = getSecondaryQty(pQty, it.uom);
          primaryQtyTotal += pQty;
          secondaryQtyTotal += sQty;
        }

        return {
          id: doc.id,
          date: docDate,
          documentNumber: doc.documentNumber,
          quantity: Math.round(primaryQtyTotal * 100) / 100,
          quantum: Math.round(secondaryQtyTotal * 100) / 100,
        };
      })
      .sort((a: any, b: any) => {
        const timeA = a.date ? a.date.getTime() : 0;
        const timeB = b.date ? b.date.getTime() : 0;
        return timeA - timeB;
      });

    const dates = rows.map((r: any) => r.date).filter(Boolean);
    const periodStr = this.formatIndonesianPeriod(dates);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 36,
        size: 'A4',
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const pageWidth = 595.28;
      const leftMargin = 36;
      const contentWidth = pageWidth - leftMargin * 2; // ~523pt

      // Column widths: No: 30, Tanggal: 100, No Dok: 223, Kuantitas: 85, Kuantum: 85
      const colWidths = [30, 100, 223, 85, 85];
      const colX = [
        leftMargin,
        leftMargin + colWidths[0],
        leftMargin + colWidths[0] + colWidths[1],
        leftMargin + colWidths[0] + colWidths[1] + colWidths[2],
        leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
      ];

      const drawHeader = () => {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000');
        doc.text(title, leftMargin, 30);

        doc.fontSize(8.5);
        doc.text(`Kanwil :${kanwil}`, leftMargin, 45);
        doc.text(`Kompleks Gudang :${kompleksGudang}`, leftMargin, 58);
        doc.font('Helvetica').text(`Periode :${periodStr}`, leftMargin, 71);

        // Table Header
        const startY = 86;
        const headerHeight = 24;

        // Draw header background
        doc
          .rect(leftMargin, startY, contentWidth, headerHeight)
          .fillAndStroke('#f1f5f9', '#000000');

        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8);

        // Column lines
        doc.moveTo(colX[1], startY).lineTo(colX[1], startY + headerHeight).stroke();
        doc.moveTo(colX[2], startY).lineTo(colX[2], startY + headerHeight).stroke();
        doc.moveTo(colX[3], startY).lineTo(colX[3], startY + headerHeight).stroke();
        doc.moveTo(colX[4], startY + 12).lineTo(colX[4], startY + headerHeight).stroke();
        // Horizontal divider in Jumlah column
        doc.moveTo(colX[3], startY + 12).lineTo(leftMargin + contentWidth, startY + 12).stroke();

        // Header labels
        doc.text('No', colX[0], startY + 8, { width: colWidths[0], align: 'center' });
        doc.text(dateColTitle, colX[1], startY + 8, { width: colWidths[1], align: 'center' });
        doc.text(docNoColTitle, colX[2], startY + 8, { width: colWidths[2], align: 'center' });
        doc.text('Jumlah', colX[3], startY + 2, { width: colWidths[3] + colWidths[4], align: 'center' });
        doc.text('Kuantitas', colX[3], startY + 14, { width: colWidths[3], align: 'center' });
        doc.text('Kuantum', colX[4], startY + 14, { width: colWidths[4], align: 'center' });

        return startY + headerHeight;
      };

      let currentY = drawHeader();
      let totalQty = 0;
      let totalQtm = 0;

      rows.forEach((row: any, idx: number) => {
        totalQty += row.quantity;
        totalQtm += row.quantum;

        const rowHeight = 13.5;
        if (currentY + rowHeight > 780) {
          doc.addPage();
          currentY = drawHeader();
        }

        // Draw row borders
        doc.rect(leftMargin, currentY, contentWidth, rowHeight).stroke('#cbd5e1');
        doc.moveTo(colX[1], currentY).lineTo(colX[1], currentY + rowHeight).stroke('#cbd5e1');
        doc.moveTo(colX[2], currentY).lineTo(colX[2], currentY + rowHeight).stroke('#cbd5e1');
        doc.moveTo(colX[3], currentY).lineTo(colX[3], currentY + rowHeight).stroke('#cbd5e1');
        doc.moveTo(colX[4], currentY).lineTo(colX[4], currentY + rowHeight).stroke('#cbd5e1');

        doc.font('Helvetica').fontSize(7.5).fillColor('#1e293b');
        doc.text(String(idx + 1), colX[0], currentY + 3, { width: colWidths[0], align: 'center' });
        doc.text(this.formatSingleDate(row.date), colX[1], currentY + 3, { width: colWidths[1], align: 'center' });
        doc.text(row.documentNumber, colX[2] + 4, currentY + 3, { width: colWidths[2] - 8, align: 'left' });
        doc.text(
          row.quantity.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
          colX[3],
          currentY + 3,
          { width: colWidths[3] - 6, align: 'right' },
        );
        doc.text(
          row.quantum.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
          colX[4],
          currentY + 3,
          { width: colWidths[4] - 6, align: 'right' },
        );

        currentY += rowHeight;
      });

      // Total / Summary row
      const totalRowHeight = 17;
      if (currentY + totalRowHeight > 780) {
        doc.addPage();
        currentY = drawHeader();
      }

      doc.rect(leftMargin, currentY, contentWidth, totalRowHeight).fillAndStroke('#f8fafc', '#000000');
      doc.moveTo(colX[3], currentY).lineTo(colX[3], currentY + totalRowHeight).stroke('#000000');
      doc.moveTo(colX[4], currentY).lineTo(colX[4], currentY + totalRowHeight).stroke('#000000');

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
      doc.text('Jumlah', leftMargin, currentY + 5, {
        width: colWidths[0] + colWidths[1] + colWidths[2],
        align: 'center',
      });
      doc.text(
        totalQty.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        colX[3],
        currentY + 5,
        { width: colWidths[3] - 6, align: 'right' },
      );
      doc.text(
        totalQtm.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        colX[4],
        currentY + 5,
        { width: colWidths[4] - 6, align: 'right' },
      );

      // Signature Block on bottom right
      currentY += totalRowHeight + 15;
      if (currentY + 50 > 805) {
        doc.addPage();
        currentY = 40;
      }

      const sigWidth = 140;
      const sigX = leftMargin + contentWidth - sigWidth;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
      doc.text('EFDY AFDIANOOR', sigX, currentY + 20, { width: sigWidth, align: 'center' });
      doc.font('Helvetica').fontSize(8.5);
      doc.text('Kepala Gudang', sigX, currentY + 32, { width: sigWidth, align: 'center' });

      doc.end();
    });
  }

  /**
   * Downloads original consolidated PDF from Odoo using /report/download.
   */
  async downloadOdooReportPdf(tagihan: any): Promise<Buffer> {
    const isOut = tagihan.type === 'LOADING';
    const isIn = tagihan.type === 'UNLOADING';

    if (!isOut && !isIn) {
      throw new BadRequestException(
        'Download Odoo Report hanya tersedia untuk tagihan Loading dan Unloading.',
      );
    }

    // 1. Gather picking IDs from related ERP documents
    const pickingIds = Array.from(
      new Set(
        (tagihan.documentReferences || [])
          .map((r: any) => r.documentReference?.id || r.documentReferenceId)
          .filter(Boolean),
      ),
    );

    if (pickingIds.length === 0) {
      throw new BadRequestException(
        'Tidak ada ID dokumen ERP Commodity yang valid untuk mengunduh laporan Odoo.',
      );
    }

    // 2. Fetch active Odoo account for this warehouse
    const odooAccount = await this.prisma.odooAccount.findFirst({
      where: {
        warehouseId: tagihan.warehouseId,
        isNonCommodity: false,
        isActive: true,
      },
    });

    if (!odooAccount) {
      throw new NotFoundException(
        'Akun Odoo untuk gudang ini belum dikonfigurasi atau tidak aktif.',
      );
    }

    // Ensure session is fresh and valid
    await this.odooSessionManager.validateAndRefreshSession(odooAccount.id);
    const account = await this.prisma.odooAccount.findUnique({
      where: { id: odooAccount.id },
    });

    if (!account || !account.sessionId) {
      throw new BadRequestException('Sesi Odoo tidak dapat diverifikasi.');
    }

    // 3. Dynamically fetch session info to build complete context
    let sessionInfo: any = {};
    let activeAccount = account;
    try {
      sessionInfo = await this.odooClient.getSessionInfo(
        activeAccount.baseUrl,
        activeAccount.sessionId!,
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to get session info, triggering session re-login: ${err.message}`,
      );
      await this.odooSessionManager.invalidateSession(activeAccount.id);
      await this.odooSessionManager.validateAndRefreshSession(activeAccount.id);
      const reAccount = await this.prisma.odooAccount.findUnique({
        where: { id: activeAccount.id },
      });
      if (!reAccount || !reAccount.sessionId) {
        throw new BadRequestException(
          'Sesi Odoo tidak dapat diverifikasi setelah login ulang.',
        );
      }
      activeAccount = reAccount;
      sessionInfo = await this.odooClient.getSessionInfo(
        activeAccount.baseUrl,
        activeAccount.sessionId!,
      );
    }

    const uid = sessionInfo?.uid || 2;
    const userContext = sessionInfo?.user_context || {};
    const companyId = sessionInfo?.company_id || 1;
    const allowedCompanyIds: number[] = sessionInfo?.user_companies?.allowed_companies
      ? Object.keys(sessionInfo.user_companies.allowed_companies).map(Number)
      : [companyId];

    // Always fetch a fresh, session-bound CSRF token from Odoo web client
    let csrfToken = await this.odooClient.getWebCsrfToken(
      activeAccount.baseUrl,
      activeAccount.sessionId!,
    );
    if (!csrfToken) {
      csrfToken = sessionInfo?.csrf_token || activeAccount.csrfToken || '';
    } else {
      // Keep DB synchronized with latest valid token
      await this.prisma.odooAccount
        .update({
          where: { id: activeAccount.id },
          data: { csrfToken },
        })
        .catch(() => {});
    }

    // 4. Construct Odoo report path and dynamic context
    const reportTemplate = isOut
      ? 'bulog_stock.bulog_picking_operation_template'
      : 'stock.report_deliveryslip';

    const idListStr = pickingIds.join(',');
    const reportPath = `/report/pdf/${reportTemplate}/${idListStr}`;

    const reportContext = {
      ...userContext,
      lang: userContext.lang || 'en_US',
      tz: userContext.tz || 'Asia/Jakarta',
      uid,
      allowed_company_ids: allowedCompanyIds,
      active_model: 'stock.picking',
      active_id: pickingIds[0],
      active_ids: pickingIds,
    };

    // 5. Build multipart/form-data request using native Node.js FormData
    const formData = new FormData();
    formData.append('data', JSON.stringify([reportPath, 'qweb-pdf']));
    formData.append('context', JSON.stringify(reportContext));
    formData.append('token', String(Date.now()));
    if (csrfToken) {
      formData.append('csrf_token', csrfToken);
    }

    const downloadEndpoint = `${activeAccount.baseUrl.replace(/\/$/, '')}/report/download`;

    this.logger.log(
      `Sending Odoo report request: endpoint=${downloadEndpoint}, report=${reportPath}, count=${pickingIds.length}`,
    );

    try {
      const response = await axios.post(downloadEndpoint, formData, {
        headers: {
          Cookie: `session_id=${activeAccount.sessionId}`,
          'User-Agent': 'Bulog-WMS/1.0',
        },
        responseType: 'arraybuffer',
        timeout: 90000,
      });

      const contentType = String(response.headers['content-type'] || '').toLowerCase();
      const buffer = Buffer.from(response.data);

      // Validate response is a real PDF
      if (
        response.status !== 200 ||
        !contentType.includes('application/pdf') ||
        buffer.length < 5 ||
        buffer.subarray(0, 4).toString() !== '%PDF'
      ) {
        let errorSnippet = 'Bukan berkas PDF yang valid dari Odoo.';
        try {
          const text = buffer.toString('utf8');
          if (text.includes('error') || text.includes('Traceback') || text.includes('Exception')) {
            errorSnippet = text.slice(0, 400);
          }
        } catch {}
        this.logger.error(`Odoo report download failed response: ${errorSnippet}`);
        throw new Error(`Gagal mengunduh laporan dari Odoo: ${errorSnippet}`);
      }

      return buffer;
    } catch (err: any) {
      let errorSnippet = err.message;
      if (err.response?.data) {
        try {
          const bodyStr = Buffer.from(err.response.data).toString('utf8');
          errorSnippet = `${err.message}: ${bodyStr.slice(0, 300)}`;
        } catch {}
      }
      this.logger.error(`Odoo report HTTP error: ${errorSnippet}`);
      throw new Error(`Gagal mengunduh laporan dari Odoo: ${errorSnippet}`);
    }
  }

  /**
   * Internal job execution invoked by BullMQ Worker.
   */
  async processJobExecution(jobData: {
    jobUuid: string;
    tagihanId: number;
    tagihanUuid: string;
    reportType: TagihanReportType;
    fingerprint: string;
    warehouseId: number;
    userId: number;
  }) {
    const { jobUuid, tagihanId, reportType, fingerprint, warehouseId, userId } = jobData;

    this.logger.log(`Starting report job ${jobUuid} for type ${reportType}`);

    // Update job to PROCESSING
    await this.prisma.tagihanReportJob.update({
      where: { uuid: jobUuid },
      data: {
        status: 'PROCESSING',
        progress: 25,
        startedAt: new Date(),
      },
    });

    const tagihan = await this.prisma.tagihan.findUnique({
      where: { id: tagihanId },
      include: {
        warehouse: true,
        documentReferences: {
          include: {
            documentReference: {
              include: { items: true },
            },
          },
        },
      },
    });

    if (!tagihan) {
      throw new Error('Data Tagihan tidak ditemukan.');
    }

    let buffer: Buffer;
    let fileName: string;
    let mimeType: string;

    const safeDocNumber = tagihan.documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');

    if (reportType === 'COMMODITY_RECAP_EXCEL') {
      fileName = `Rekapitulasi_${safeDocNumber}_${timestampStr}.xlsx`;
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      buffer = await this.generateCommodityRecapExcel(tagihan);
    } else if (reportType === 'COMMODITY_RECAP_PDF') {
      fileName = `Rekapitulasi_${safeDocNumber}_${timestampStr}.pdf`;
      mimeType = 'application/pdf';
      buffer = await this.generateCommodityRecapPdf(tagihan);
    } else if (reportType === 'ODOO_REPORT_PDF') {
      fileName = `Odoo_Report_${safeDocNumber}_${timestampStr}.pdf`;
      mimeType = 'application/pdf';
      buffer = await this.downloadOdooReportPdf(tagihan);
    } else {
      throw new Error(`Tipe laporan ${reportType} tidak didukung.`);
    }

    // Update progress to 75%
    await this.prisma.tagihanReportJob.update({
      where: { uuid: jobUuid },
      data: { progress: 75 },
    });

    // Upload to MinIO Storage
    const uniqueId = crypto.randomUUID();
    const filePath = `tagihan/${tagihan.uuid}/reports/${uniqueId}-${fileName}`;
    await this.storageService.uploadBuffer(buffer, filePath, mimeType);

    // Save as TagihanFile in Supporting Files
    const tagihanFile = await this.prisma.tagihanFile.create({
      data: {
        tagihanId: tagihan.id,
        filePath,
        fileName,
        fileSize: buffer.length,
        mimeType,
        fileType: reportType,
        fingerprint,
        generatedAt: new Date(),
        jobId: jobUuid,
        uploadedById: userId,
      },
    });

    // Update job to COMPLETED
    await this.prisma.tagihanReportJob.update({
      where: { uuid: jobUuid },
      data: {
        status: 'COMPLETED',
        progress: 100,
        tagihanFileId: tagihanFile.id,
        completedAt: new Date(),
      },
    });

    this.logger.log(
      `Report job ${jobUuid} completed successfully. File saved with UUID: ${tagihanFile.uuid}`,
    );

    return { tagihanFileId: tagihanFile.id, fileUuid: tagihanFile.uuid };
  }
}

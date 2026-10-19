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
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import {
  PDFDocument as PdfLibDocument,
  PDFEmbeddedPage,
  PDFPage,
  degrees,
} from 'pdf-lib';
import * as ExcelJS from 'exceljs';
import {
  getSecondaryQty,
  type TagihanReportType,
  type TagihanReportJobStatus,
  type TagihanReportStage,
} from '@bulog-wms/schema';

const ODOO_PDF_TIMEOUT_MS = 60_000;
const ODOO_PDF_MAX_ATTEMPTS = 3;
const ODOO_PDF_RETRY_DELAY_MS = 2_000;
const TWO_UP_MARGIN = 12;
const TWO_UP_GAP = 12;

// A job whose progress has not been updated for this long is considered stuck
const STUCK_JOB_THRESHOLD_MS = 5 * 60 * 1000;

// Progress boundaries (percent) for each stage of the Odoo report pipeline
const PROGRESS = {
  PREPARING: 5,
  DOWNLOADED: 50,
  OPTIMIZED: 80,
  MERGED: 90,
  SAVING: 95,
} as const;

export interface OdooReportProgress {
  stage: TagihanReportStage;
  progress: number;
  processedCount: number;
  totalCount: number;
  currentItem: string | null;
}

interface OdooReportRequestContext {
  baseUrl: string;
  sessionId: string;
  csrfToken: string;
  uid: number;
  userContext: Record<string, any>;
  allowedCompanyIds: number[];
  reportTemplate: string;
}

class OdooReportDownloadError extends Error {
  constructor(
    message: string,
    public readonly isSessionError = false,
  ) {
    super(message);
  }
}

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
      stage?: string | null;
      processedCount?: number;
      totalCount?: number;
      currentItem?: string | null;
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
        // Check for stuck job (no progress heartbeat for > 5 minutes in PENDING/PROCESSING)
        const stuckThreshold = new Date(Date.now() - STUCK_JOB_THRESHOLD_MS);
        if (
          (latestJob.status === 'PENDING' || latestJob.status === 'PROCESSING') &&
          latestJob.updatedAt < stuckThreshold
        ) {
          this.logger.warn(
            `Job ${latestJob.uuid} stuck for tagihan ${tagihan.documentNumber}. Marking as FAILED.`,
          );
          await this.prisma.tagihanReportJob.update({
            where: { id: latestJob.id },
            data: {
              status: 'FAILED',
              stage: 'FAILED',
              errorMessage: 'Proses generate melebihi batas waktu (timeout).',
              completedAt: new Date(),
            },
          });
          reportsResult[rType] = {
            status: 'FAILED',
            file: null,
            jobUuid: latestJob.uuid,
            progress: 0,
            stage: 'FAILED',
            processedCount: latestJob.processedCount,
            totalCount: latestJob.totalCount,
            currentItem: latestJob.currentItem,
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
          stage: latestJob.stage,
          processedCount: latestJob.processedCount,
          totalCount: latestJob.totalCount,
          currentItem: latestJob.currentItem,
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

    // 2 & 3. Atomic duplicate check + job creation, serialized per (tagihan, reportType)
    // with a transaction-scoped advisory lock so concurrent requests cannot both create a job.
    const isOdooReport = reportType === 'ODOO_REPORT_PDF';
    const { activeJob, newJob } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${tagihan.id}::int, hashtext(${reportType}))`;

      const existing = await tx.tagihanReportJob.findFirst({
        where: {
          tagihanId: tagihan.id,
          reportType,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      });

      if (existing) {
        const stuckThreshold = new Date(Date.now() - STUCK_JOB_THRESHOLD_MS);
        if (existing.updatedAt >= stuckThreshold) {
          return { activeJob: existing, newJob: null };
        }
        this.logger.warn(`Stuck job ${existing.uuid} detected. Cancelling...`);
        await tx.tagihanReportJob.update({
          where: { id: existing.id },
          data: {
            status: 'FAILED',
            stage: 'FAILED',
            errorMessage: 'Timeout: Pekerjaan sebelumnya dibatalkan karena tidak merespon.',
            completedAt: new Date(),
          },
        });
      }

      const created = await tx.tagihanReportJob.create({
        data: {
          tagihanId: tagihan.id,
          reportType,
          status: 'PENDING',
          fingerprint: currentFingerprint,
          progress: isOdooReport ? 0 : 10,
          stage: 'PREPARING',
          totalCount: isOdooReport ? tagihan.documentReferences.length : 0,
        },
      });
      return { activeJob: null, newJob: created };
    });

    if (activeJob || !newJob) {
      // Return existing running job, avoid duplicate!
      return {
        status: activeJob!.status,
        isCached: false,
        jobUuid: activeJob!.uuid,
        progress: activeJob!.progress,
        message: 'Pekerjaan sedang berlangsung.',
      };
    }

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
          // Odoo downloads already retry per document; a failed job must stay failed
          attempts: isOdooReport ? 1 : 2,
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
          stage: 'FAILED',
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
      progress: newJob.progress,
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
   * Resolves a fresh Odoo session, CSRF token, and user context for report downloads.
   * Set `forceRelogin` to discard the current session (e.g. after an expired-session response).
   */
  private async prepareOdooReportContext(
    warehouseId: number,
    isOut: boolean,
    forceRelogin = false,
  ): Promise<OdooReportRequestContext> {
    const odooAccount = await this.prisma.odooAccount.findFirst({
      where: {
        warehouseId,
        isNonCommodity: false,
        isActive: true,
      },
    });

    if (!odooAccount) {
      throw new NotFoundException(
        'Akun Odoo untuk gudang ini belum dikonfigurasi atau tidak aktif.',
      );
    }

    if (forceRelogin) {
      await this.odooSessionManager.invalidateSession(odooAccount.id);
    }

    // Ensure session is fresh and valid
    await this.odooSessionManager.validateAndRefreshSession(odooAccount.id);
    const account = await this.prisma.odooAccount.findUnique({
      where: { id: odooAccount.id },
    });

    if (!account || !account.sessionId) {
      throw new BadRequestException('Sesi Odoo tidak dapat diverifikasi.');
    }

    // Dynamically fetch session info to build complete context
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

    return {
      baseUrl: activeAccount.baseUrl,
      sessionId: activeAccount.sessionId!,
      csrfToken: csrfToken || '',
      uid,
      userContext,
      allowedCompanyIds,
      reportTemplate: isOut
        ? 'bulog_stock.bulog_picking_operation_template'
        : 'stock.report_deliveryslip',
    };
  }

  /**
   * Downloads a single stock.picking report PDF from Odoo using /report/download
   * and validates that the response is a real, parseable PDF.
   */
  private async fetchOdooPickingPdf(
    ctx: OdooReportRequestContext,
    pickingId: number,
  ): Promise<Buffer> {
    const reportPath = `/report/pdf/${ctx.reportTemplate}/${pickingId}`;

    const reportContext = {
      ...ctx.userContext,
      lang: ctx.userContext.lang || 'en_US',
      tz: ctx.userContext.tz || 'Asia/Jakarta',
      uid: ctx.uid,
      allowed_company_ids: ctx.allowedCompanyIds,
      active_model: 'stock.picking',
      active_id: pickingId,
      active_ids: [pickingId],
    };

    // Build multipart/form-data request using native Node.js FormData
    const formData = new FormData();
    formData.append('data', JSON.stringify([reportPath, 'qweb-pdf']));
    formData.append('context', JSON.stringify(reportContext));
    formData.append('token', String(Date.now()));
    if (ctx.csrfToken) {
      formData.append('csrf_token', ctx.csrfToken);
    }

    const downloadEndpoint = `${ctx.baseUrl.replace(/\/$/, '')}/report/download`;

    let response;
    try {
      response = await axios.post(downloadEndpoint, formData, {
        headers: {
          Cookie: `session_id=${ctx.sessionId}`,
          'User-Agent': 'Bulog-WMS/1.0',
        },
        responseType: 'arraybuffer',
        timeout: ODOO_PDF_TIMEOUT_MS,
      });
    } catch (err: any) {
      let errorSnippet = err.code === 'ECONNABORTED' ? 'Timeout' : err.message;
      let bodyStr = '';
      if (err.response?.data) {
        try {
          bodyStr = Buffer.from(err.response.data).toString('utf8');
          errorSnippet = `${err.message}: ${bodyStr.slice(0, 300)}`;
        } catch {}
      }
      const status = err.response?.status;
      throw new OdooReportDownloadError(
        errorSnippet,
        status === 401 || status === 403 || /session.?expired/i.test(bodyStr),
      );
    }

    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    const buffer = Buffer.from(response.data);

    if (
      response.status !== 200 ||
      !contentType.includes('application/pdf') ||
      buffer.length < 5 ||
      buffer.subarray(0, 4).toString() !== '%PDF'
    ) {
      let errorSnippet = 'Bukan berkas PDF yang valid dari Odoo.';
      let isSessionError = false;
      try {
        const text = buffer.toString('utf8');
        // Odoo answers expired sessions with a login page or a SessionExpired JSON error
        isSessionError =
          /session.?expired/i.test(text) || text.includes('/web/login');
        if (text.includes('error') || text.includes('Traceback') || text.includes('Exception')) {
          errorSnippet = text.slice(0, 400);
        }
      } catch {}
      throw new OdooReportDownloadError(errorSnippet, isSessionError);
    }

    // Ensure the PDF is structurally valid (guards against truncated responses)
    try {
      const parsed = await PdfLibDocument.load(buffer);
      if (parsed.getPageCount() === 0) {
        throw new Error('PDF tidak memiliki halaman.');
      }
    } catch (err: any) {
      throw new OdooReportDownloadError(`PDF rusak atau tidak lengkap: ${err.message}`);
    }

    return buffer;
  }

  /**
   * Converts a PDF into a 2-up layout (2 original pages per output sheet).
   * Portrait pages are placed side by side on a landscape sheet; landscape pages are
   * stacked on a portrait sheet. Pages are scaled to fit without cropping and keep
   * their display rotation. An odd trailing page is placed alone on the last sheet.
   */
  private async convertPdfToTwoUp(source: PdfLibDocument): Promise<PdfLibDocument> {
    const output = await PdfLibDocument.create();
    const sourcePages = source.getPages();

    // Use one sheet layout per document, based on its dominant page orientation
    const displaySizes = sourcePages.map((p) => {
      const rotation = this.normalizePageRotation(p.getRotation().angle);
      const { width, height } = p.getSize();
      const swapped = rotation === 90 || rotation === 270;
      return swapped ? { width: height, height: width } : { width, height };
    });
    const portraitCount = displaySizes.filter((s) => s.height >= s.width).length;
    const isPortrait = portraitCount * 2 >= displaySizes.length;
    const reference =
      displaySizes.find((s) => s.height >= s.width === isPortrait) || displaySizes[0];

    // Sheet keeps the source paper size, rotated by 90 degrees
    const sheetWidth = reference.height;
    const sheetHeight = reference.width;

    for (let i = 0; i < sourcePages.length; i += 2) {
      const pairPages = sourcePages.slice(i, i + 2);
      const embeddedPair = await Promise.all(
        pairPages.map((p) =>
          // Pages without a content stream cannot be embedded; they render as blank
          output.embedPage(p).catch(() => null),
        ),
      );

      const sheet = output.addPage([sheetWidth, sheetHeight]);

      const m = TWO_UP_MARGIN;
      const g = TWO_UP_GAP;
      const slots = isPortrait
        ? [
            { x: m, y: m, width: (sheetWidth - 2 * m - g) / 2, height: sheetHeight - 2 * m },
            {
              x: m + (sheetWidth - 2 * m - g) / 2 + g,
              y: m,
              width: (sheetWidth - 2 * m - g) / 2,
              height: sheetHeight - 2 * m,
            },
          ]
        : [
            {
              x: m,
              y: m + (sheetHeight - 2 * m - g) / 2 + g,
              width: sheetWidth - 2 * m,
              height: (sheetHeight - 2 * m - g) / 2,
            },
            { x: m, y: m, width: sheetWidth - 2 * m, height: (sheetHeight - 2 * m - g) / 2 },
          ];

      embeddedPair.forEach((embedded, k) => {
        if (!embedded) return;
        this.drawPageInSlot(
          sheet,
          embedded,
          this.normalizePageRotation(pairPages[k].getRotation().angle),
          slots[k],
        );
      });
    }

    return output;
  }

  private normalizePageRotation(angle: number): 0 | 90 | 180 | 270 {
    const normalized = (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
    return normalized as 0 | 90 | 180 | 270;
  }

  /**
   * Draws an embedded page centered inside a slot, preserving aspect ratio and the
   * page's clockwise display rotation (PDF /Rotate).
   */
  private drawPageInSlot(
    sheet: PDFPage,
    embedded: PDFEmbeddedPage,
    rotation: 0 | 90 | 180 | 270,
    slot: { x: number; y: number; width: number; height: number },
  ) {
    const swapped = rotation === 90 || rotation === 270;
    const displayWidth = swapped ? embedded.height : embedded.width;
    const displayHeight = swapped ? embedded.width : embedded.height;
    const scale = Math.min(slot.width / displayWidth, slot.height / displayHeight);

    const scaledWidth = embedded.width * scale;
    const scaledHeight = embedded.height * scale;
    const boxX = slot.x + (slot.width - displayWidth * scale) / 2;
    const boxY = slot.y + (slot.height - displayHeight * scale) / 2;

    // pdf-lib rotates counter-clockwise around (x, y); PDF /Rotate is clockwise
    const placement = {
      0: { x: boxX, y: boxY, rotate: 0 },
      90: { x: boxX, y: boxY + scaledWidth, rotate: -90 },
      180: { x: boxX + scaledWidth, y: boxY + scaledHeight, rotate: 180 },
      270: { x: boxX + scaledHeight, y: boxY, rotate: 90 },
    }[rotation];

    sheet.drawPage(embedded, {
      x: placement.x,
      y: placement.y,
      xScale: scale,
      yScale: scale,
      rotate: degrees(placement.rotate),
    });
  }

  /**
   * Downloads Odoo report PDFs for every related ERP document sequentially (in document
   * order), converts PDFs with more than 2 pages into a 2-up layout, and merges them into
   * a single PDF. Intermediate files live in a temporary directory that is always removed.
   * Any document that still fails after retries fails the whole process.
   */
  async downloadOdooReportPdf(
    tagihan: any,
    onProgress?: (progress: OdooReportProgress) => Promise<void>,
  ): Promise<Buffer> {
    const isOut = tagihan.type === 'LOADING';
    const isIn = tagihan.type === 'UNLOADING';

    if (!isOut && !isIn) {
      throw new BadRequestException(
        'Download Odoo Report hanya tersedia untuk tagihan Loading dan Unloading.',
      );
    }

    const report = async (p: OdooReportProgress) => {
      if (onProgress) await onProgress(p);
    };

    // 1. Gather picking IDs from related ERP documents, preserving document order
    const documents: { pickingId: number; name: string }[] = [];
    const seen = new Set<number>();
    for (const r of tagihan.documentReferences || []) {
      const pickingId = r.documentReference?.id || r.documentReferenceId;
      if (!pickingId || seen.has(pickingId)) continue;
      seen.add(pickingId);
      documents.push({
        pickingId,
        name: r.documentReference?.documentNumber || `#${pickingId}`,
      });
    }

    if (documents.length === 0) {
      throw new BadRequestException(
        'Tidak ada ID dokumen ERP Commodity yang valid untuk mengunduh laporan Odoo.',
      );
    }

    const total = documents.length;
    const pct = (start: number, end: number, done: number) =>
      Math.round(start + ((end - start) * done) / total);

    await report({
      stage: 'PREPARING',
      progress: PROGRESS.PREPARING,
      processedCount: 0,
      totalCount: total,
      currentItem: null,
    });

    let ctx = await this.prepareOdooReportContext(tagihan.warehouseId, isOut);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bulog-odoo-report-'));
    try {
      // 2. Sequential download with timeout + retry
      const rawPaths: string[] = [];
      for (let i = 0; i < total; i++) {
        const doc = documents[i];
        let buffer: Buffer | null = null;
        let lastError: OdooReportDownloadError | null = null;

        for (let attempt = 1; attempt <= ODOO_PDF_MAX_ATTEMPTS; attempt++) {
          // Also acts as a heartbeat for stuck-job detection
          await report({
            stage: 'DOWNLOADING',
            progress: pct(PROGRESS.PREPARING, PROGRESS.DOWNLOADED, i),
            processedCount: i,
            totalCount: total,
            currentItem:
              attempt > 1
                ? `${doc.name} (percobaan ${attempt}/${ODOO_PDF_MAX_ATTEMPTS})`
                : doc.name,
          });

          try {
            buffer = await this.fetchOdooPickingPdf(ctx, doc.pickingId);
            break;
          } catch (err: any) {
            lastError =
              err instanceof OdooReportDownloadError
                ? err
                : new OdooReportDownloadError(err.message);
            this.logger.warn(
              `Odoo PDF download failed for ${doc.name} (attempt ${attempt}/${ODOO_PDF_MAX_ATTEMPTS}): ${lastError.message}`,
            );
            if (attempt < ODOO_PDF_MAX_ATTEMPTS) {
              await new Promise((resolve) =>
                setTimeout(resolve, ODOO_PDF_RETRY_DELAY_MS * attempt),
              );
              if (lastError.isSessionError) {
                ctx = await this.prepareOdooReportContext(tagihan.warehouseId, isOut, true);
              }
            }
          }
        }

        if (!buffer) {
          throw new Error(
            `Gagal mengunduh laporan Odoo untuk dokumen ${doc.name} setelah ${ODOO_PDF_MAX_ATTEMPTS} percobaan: ${lastError?.message || 'Unknown error'}`,
          );
        }

        const rawPath = path.join(tempDir, `${String(i + 1).padStart(4, '0')}-raw.pdf`);
        await fs.writeFile(rawPath, buffer);
        rawPaths.push(rawPath);
      }

      // 3. Page optimization (2-up for PDFs with more than 2 pages)
      const processedPaths: string[] = [];
      for (let i = 0; i < total; i++) {
        await report({
          stage: 'OPTIMIZING',
          progress: pct(PROGRESS.DOWNLOADED, PROGRESS.OPTIMIZED, i),
          processedCount: i,
          totalCount: total,
          currentItem: documents[i].name,
        });

        const source = await PdfLibDocument.load(await fs.readFile(rawPaths[i]));
        if (source.getPageCount() > 2) {
          const optimized = await this.convertPdfToTwoUp(source);
          const processedPath = path.join(
            tempDir,
            `${String(i + 1).padStart(4, '0')}-processed.pdf`,
          );
          await fs.writeFile(processedPath, await optimized.save());
          processedPaths.push(processedPath);
        } else {
          processedPaths.push(rawPaths[i]);
        }
      }

      // 4. Merge all processed PDFs in document order
      const merged = await PdfLibDocument.create();
      let expectedPages = 0;
      for (let i = 0; i < total; i++) {
        await report({
          stage: 'MERGING',
          progress: pct(PROGRESS.OPTIMIZED, PROGRESS.MERGED, i),
          processedCount: i,
          totalCount: total,
          currentItem: documents[i].name,
        });

        const part = await PdfLibDocument.load(await fs.readFile(processedPaths[i]));
        const copied = await merged.copyPages(part, part.getPageIndices());
        copied.forEach((p) => merged.addPage(p));
        expectedPages += copied.length;
      }

      const finalBytes = await merged.save();

      // Validate final PDF before it is reported as successful
      const verify = await PdfLibDocument.load(finalBytes);
      if (verify.getPageCount() !== expectedPages || expectedPages === 0) {
        throw new Error('Validasi PDF gabungan gagal: jumlah halaman tidak sesuai.');
      }

      await report({
        stage: 'MERGING',
        progress: PROGRESS.MERGED,
        processedCount: total,
        totalCount: total,
        currentItem: null,
      });

      return Buffer.from(finalBytes);
    } finally {
      await fs
        .rm(tempDir, { recursive: true, force: true })
        .catch((e) =>
          this.logger.warn(`Failed to clean temp dir ${tempDir}: ${e.message}`),
        );
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
        progress: reportType === 'ODOO_REPORT_PDF' ? 0 : 25,
        stage: 'PREPARING',
        startedAt: new Date(),
      },
    });

    const tagihan = await this.prisma.tagihan.findUnique({
      where: { id: tagihanId },
      include: {
        warehouse: true,
        documentReferences: {
          // Preserve the order in which documents were linked to the tagihan
          orderBy: { id: 'asc' },
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
      buffer = await this.downloadOdooReportPdf(tagihan, (p) =>
        this.prisma.tagihanReportJob
          .update({
            where: { uuid: jobUuid },
            data: {
              stage: p.stage,
              progress: p.progress,
              processedCount: p.processedCount,
              totalCount: p.totalCount,
              currentItem: p.currentItem,
            },
          })
          .then(() => undefined),
      );
    } else {
      throw new Error(`Tipe laporan ${reportType} tidak didukung.`);
    }

    await this.prisma.tagihanReportJob.update({
      where: { uuid: jobUuid },
      data: {
        stage: 'SAVING',
        progress: reportType === 'ODOO_REPORT_PDF' ? PROGRESS.SAVING : 75,
        currentItem: fileName,
      },
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
        stage: 'COMPLETED',
        progress: 100,
        currentItem: null,
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

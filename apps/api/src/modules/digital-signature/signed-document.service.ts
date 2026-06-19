import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { PDFDocument, rgb } from 'pdf-lib';
import * as QRCode from 'qrcode';
import PDFKitDocument from 'pdfkit';
import * as crypto from 'crypto';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import type { SignDocumentInput } from '@bulog-wms/schema';
import { getLocalStartOfDay, getLocalEndOfDay } from '@/core/utils/date';

@Injectable()
export class SignedDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  /**
   * Helper to extract MinIO key from a public URL.
   */
  private extractKeyFromUrl(url: string): string {
    const bucketName =
      this.configService.get<string>('MINIO_BUCKET') || 'wms-bucket';
    const parts = url.split(`/${bucketName}/`);
    return parts.length > 1 ? parts[1] : url;
  }

  private async resolveCategoryId(categoryIdOrName: any): Promise<number> {
    if (!categoryIdOrName) {
      throw new NotFoundException('Kategori dokumen tidak boleh kosong.');
    }

    const parsedId = Number(categoryIdOrName);
    if (!isNaN(parsedId) && Number.isInteger(parsedId)) {
      const category = await this.prisma.documentCategory.findFirst({
        where: { id: parsedId, deletedAt: null },
      });
      if (category) {
        return category.id;
      }
    }

    const nameStr = String(categoryIdOrName).trim();
    if (!nameStr) {
      throw new NotFoundException('Kategori dokumen tidak boleh kosong.');
    }

    let category = await this.prisma.documentCategory.findFirst({
      where: {
        name: { equals: nameStr, mode: 'insensitive' },
        deletedAt: null,
      },
    });

    if (!category) {
      category = await this.prisma.documentCategory.create({
        data: {
          name: nameStr,
          isActive: true,
        },
      });
    }

    return category.id;
  }

  /**
   * Generates a clean PDF of an ERP Document (DocumentReference) using PDFKit.
   */
  async generateErpPdfBuffer(id: number): Promise<Buffer> {
    const docRef = await this.prisma.documentReference.findUnique({
      where: { id },
      include: {
        items: true,
        warehouse: true,
      },
    });

    if (!docRef) {
      throw new NotFoundException(
        `Dokumen ERP dengan ID ${id} tidak ditemukan.`,
      );
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFKitDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Title & Logo Area
      doc
        .fillColor('#1e3a8a')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('BULOG WMS - DOKUMEN ERP', { align: 'center' });
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#4b5563')
        .text(`Nomor Dokumen: ${docRef.documentNumber}`, { align: 'center' });
      doc.moveDown(1.5);

      // Metadata Info Box
      const initialY = doc.y;
      doc.rect(40, initialY, 515, 120).lineWidth(1).stroke('#e5e7eb');

      doc.fillColor('#1f2937').fontSize(9);
      doc.font('Helvetica-Bold').text('INFORMASI DOKUMEN', 50, initialY + 10);

      doc.font('Helvetica').text(`Tipe Dokumen:`, 55, initialY + 30);
      doc
        .font('Helvetica-Bold')
        .text(
          docRef.pickingTypeCode === 'incoming'
            ? 'Incoming (PO)'
            : 'Outgoing (SO)',
          160,
          initialY + 30,
        );

      doc.font('Helvetica').text(`Gudang:`, 55, initialY + 45);
      doc
        .font('Helvetica-Bold')
        .text(docRef.warehouse?.name || '-', 160, initialY + 45);

      doc.font('Helvetica').text(`Mitra / Partner:`, 55, initialY + 60);
      doc
        .font('Helvetica-Bold')
        .text(docRef.partnerName || '-', 160, initialY + 60);

      doc.font('Helvetica').text(`Referensi PO/SO:`, 55, initialY + 75);
      doc
        .font('Helvetica-Bold')
        .text(docRef.purchaseName || docRef.origin || '-', 160, initialY + 75);

      doc.font('Helvetica').text(`Tanggal Dijadwalkan:`, 55, initialY + 90);
      doc
        .font('Helvetica-Bold')
        .text(
          docRef.scheduledDate
            ? new Date(docRef.scheduledDate).toLocaleString('id-ID')
            : '-',
          160,
          initialY + 90,
        );

      doc.font('Helvetica').text(`Tanggal Selesai:`, 55, initialY + 105);
      doc
        .font('Helvetica-Bold')
        .text(
          docRef.dateDone
            ? new Date(docRef.dateDone).toLocaleString('id-ID')
            : '-',
          160,
          initialY + 105,
        );

      doc.y = initialY + 140;

      // Items Table Header
      const tableY = doc.y;
      doc.rect(40, tableY, 515, 20).fill('#f3f4f6');
      doc.fillColor('#374151').fontSize(8.5).font('Helvetica-Bold');
      doc.text('No', 50, tableY + 5);
      doc.text('Nama Produk', 80, tableY + 5);
      doc.text('Analytic Account', 320, tableY + 5);
      doc.text('Kuantitas', 450, tableY + 5, { width: 60, align: 'right' });
      doc.text('UOM', 520, tableY + 5);

      doc.y = tableY + 20;

      // Table Rows
      doc.font('Helvetica').fillColor('#4b5563');
      docRef.items.forEach((item, index) => {
        const rowY = doc.y;
        if (rowY > 700) {
          doc.addPage();
          doc.y = 40;
        }

        // Zebra striping
        if (index % 2 === 1) {
          doc.rect(40, doc.y, 515, 20).fill('#f9fafb');
        }

        doc.fillColor('#4b5563');
        doc.text(String(index + 1), 50, doc.y + 5);
        doc.text(item.productName, 80, doc.y + 5, {
          width: 230,
          ellipsis: true,
        });
        doc.text(item.analyticAccountName || '-', 320, doc.y + 5, {
          width: 120,
        });
        doc.text(item.quantity.toLocaleString('id-ID'), 450, doc.y + 5, {
          width: 60,
          align: 'right',
        });
        doc.text(item.uom.toUpperCase(), 520, doc.y + 5);

        doc.y = rowY + 20;
      });

      doc.end();
    });
  }

  /**
   * List all signed documents.
   */
  async findAll(query: {
    search?: string;
    categoryId?: number;
    sourceType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    const where: any = {
      deletedAt: null,
      warehouseId,
    };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.sourceType) {
      where.sourceType = query.sourceType;
    }

    if (query.status) {
      where.status = query.status;
    }

    const timezone = this.warehouseContext.getTimezone();
    if (query.startDate || query.endDate) {
      where.signedAt = {};
      if (query.startDate) {
        where.signedAt.gte = getLocalStartOfDay(query.startDate, timezone);
      }
      if (query.endDate) {
        where.signedAt.lte = getLocalEndOfDay(query.endDate, timezone);
      }
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { verificationToken: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const docs = await this.prisma.signedDocument.findMany({
      where,
      include: {
        category: true,
        signer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        template: true,
      },
      orderBy: { signedAt: 'desc' },
    });

    // Sign URLs dynamically on fetch for private buckets
    return Promise.all(
      docs.map(async (doc) => {
        let signedPdfUrl = doc.signedPdfUrl;
        if (doc.fileKey) {
          signedPdfUrl = await this.storageService.getFilePrivateUrl(
            doc.fileKey,
          );
        }
        return {
          ...doc,
          signedPdfUrl,
        };
      }),
    );
  }

  async findOne(uuid: string) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    const doc = await this.prisma.signedDocument.findFirst({
      where: { uuid, warehouseId, deletedAt: null },
      include: {
        category: true,
        signer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        template: true,
        verificationLogs: {
          orderBy: { verifiedAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!doc) {
      throw new NotFoundException(
        `Dokumen digital dengan UUID ${uuid} tidak ditemukan.`,
      );
    }

    // Sign URL dynamically
    if (doc.fileKey) {
      doc.signedPdfUrl = await this.storageService.getFilePrivateUrl(
        doc.fileKey,
      );
    }

    return doc;
  }

  /**
   * Publicly verify a document token, validating cryptographically against actual storage hash.
   */
  async verifyToken(token: string, ipAddress?: string, userAgent?: string) {
    const doc = await this.prisma.signedDocument.findFirst({
      where: { verificationToken: token, deletedAt: null },
      include: {
        category: true,
        signer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!doc) {
      await this.logActivity(null, 'VERIFY_FAILED', null, {
        token,
        ipAddress,
        userAgent,
      });
      throw new NotFoundException('Document verification failed.');
    }

    // Verify SHA-256 hash by fetching the actual file from MinIO and computing hash
    let integrityValid = true;
    let computedHash = '';
    try {
      if (doc.fileKey) {
        const fileBuffer = await this.storageService.getFileBuffer(doc.fileKey);
        computedHash = crypto
          .createHash('sha256')
          .update(fileBuffer)
          .digest('hex');
        if (computedHash !== doc.fileHash) {
          integrityValid = false;
        }
      } else {
        integrityValid = false;
      }
    } catch (err) {
      integrityValid = false;
    }

    // Log verification attempt
    await this.prisma.documentVerificationLog.create({
      data: {
        signedDocumentId: doc.id,
        verificationToken: token,
        ipAddress,
        userAgent,
      },
    });

    if (!integrityValid) {
      await this.logActivity(null, 'VERIFY_INTEGRITY_FAILED', doc.id, {
        token,
        ipAddress,
        userAgent,
        docHash: doc.fileHash,
        actualHash: computedHash,
      });

      // Update local record status to alert administrators
      await this.prisma.signedDocument.update({
        where: { id: doc.id },
        data: { status: 'INVALID' },
      });

      return {
        message: 'Document integrity validation failed.',
        document: {
          id: doc.id,
          title: doc.title,
          documentNumber:
            doc.sourceType === 'ERP'
              ? doc.title.split(' - ')[1] || doc.title
              : doc.title,
          category: doc.category.name,
          signedBy: doc.signer.name,
          signedDate: doc.signedAt,
          verificationStatus: 'INVALID',
          originalSignedPdf: await this.storageService.getFilePrivateUrl(
            doc.fileKey || '',
          ),
          fileHash: doc.fileHash || 'N/A',
        },
      };
    }

    await this.logActivity(null, 'VERIFY_SUCCESS', doc.id, {
      token,
      ipAddress,
      userAgent,
    });

    return {
      message:
        'This document has been verified and digitally signed within the WMS system.',
      document: {
        id: doc.id,
        title: doc.title,
        documentNumber:
          doc.sourceType === 'ERP'
            ? doc.title.split(' - ')[1] || doc.title
            : doc.title,
        category: doc.category.name,
        signedBy: doc.signer.name,
        signedDate: doc.signedAt,
        verificationStatus: doc.status,
        originalSignedPdf: await this.storageService.getFilePrivateUrl(
          doc.fileKey || '',
        ),
        fileHash: doc.fileHash || 'N/A',
      },
    };
  }

  /**
   * Core sign action for both ERP and Manual Documents embedding signatures and generating checksums.
   */
  async generateErpPdfBufferByUuid(uuid: string): Promise<Buffer> {
    const warehouseId = this.warehouseContext.getWarehouseId();
    const docRef = await this.prisma.documentReference.findFirst({
      where: { uuid, warehouseId },
    });
    if (!docRef) {
      throw new NotFoundException(
        `Dokumen ERP dengan UUID ${uuid} tidak ditemukan.`,
      );
    }
    return this.generateErpPdfBuffer(docRef.id);
  }

  async signDocument(
    sourceType: 'ERP' | 'MANUAL',
    sourceIdOrUuid: string,
    userId: number,
    data: SignDocumentInput,
    ipAddress?: string,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();

    let sourceId: number;
    let originalPdfBuffer: Buffer;
    let title = '';
    let originalFileKey = '';

    if (sourceType === 'ERP') {
      const docRef = await this.prisma.documentReference.findFirst({
        where: { uuid: sourceIdOrUuid, warehouseId },
      });
      if (!docRef) {
        throw new NotFoundException('Dokumen ERP tidak ditemukan.');
      }
      sourceId = docRef.id;
      originalPdfBuffer = await this.generateErpPdfBuffer(sourceId);
      title = `ERP - ${docRef.documentNumber}`;

      // Upload original ERP PDF to MinIO
      originalFileKey = `documents/original/erp_${docRef.documentNumber}.pdf`;
      await this.storageService.uploadBuffer(
        originalPdfBuffer,
        originalFileKey,
        'application/pdf',
      );
    } else {
      const manualDoc = await this.prisma.manualDocument.findFirst({
        where: { uuid: sourceIdOrUuid, warehouseId, deletedAt: null },
      });
      if (!manualDoc) {
        throw new NotFoundException('Dokumen manual tidak ditemukan.');
      }
      sourceId = manualDoc.id;
      originalFileKey =
        manualDoc.fileKey || this.extractKeyFromUrl(manualDoc.fileUrl);
      title = manualDoc.title;

      try {
        originalPdfBuffer =
          await this.storageService.getFileBuffer(originalFileKey);
      } catch (err) {
        throw new BadRequestException(
          `Gagal mengunduh file dokumen manual: ${originalFileKey}`,
        );
      }
    }

    // 1. Validate if already signed
    const existing = await this.prisma.signedDocument.findFirst({
      where: {
        sourceType,
        sourceDocumentId: sourceId,
        status: 'VALID',
        deletedAt: null,
      },
    });

    if (existing) {
      throw new BadRequestException('Dokumen ini sudah ditandatangani.');
    }

    // 2. Validate Category
    const resolvedCategoryId = await this.resolveCategoryId(data.categoryId);

    // 3. Validate User and fetch their active signature file
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User penandatangan tidak valid.');
    }

    const activeSignature = await this.prisma.userSignature.findFirst({
      where: { userId, isActive: true },
    });
    if (!activeSignature) {
      throw new BadRequestException(
        'Anda belum mengunggah gambar tanda tangan aktif. Silakan unggah tanda tangan di profil Anda terlebih dahulu.',
      );
    }

    // 5. Generate verification token and URLs
    const verificationToken = crypto.randomUUID();
    const appDomain = this.configService.get<string>('FRONTEND_URL');
    const verificationUrl = `${appDomain}/document-verification/${verificationToken}`;

    // 6. Generate QR code buffer and upload standalone image
    const qrBuffer = await QRCode.toBuffer(verificationUrl, {
      type: 'png',
      width: 200,
      margin: 1,
    });
    const qrKey = `documents/qrcodes/${verificationToken}.png`;
    await this.storageService.uploadBuffer(qrBuffer, qrKey, 'image/png');

    // 7. Get signature image buffer from MinIO
    let sigImageBuffer: Buffer;
    try {
      sigImageBuffer = await this.storageService.getFileBuffer(
        activeSignature.fileKey,
      );
    } catch (err) {
      throw new BadRequestException(
        'Gagal mengambil gambar tanda tangan Anda dari storage.',
      );
    }

    // 8. Load PDF and embed images
    const pdfDoc = await PDFDocument.load(originalPdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    const pageIndex = Math.min(Math.max(0, data.pageNumber - 1), pageCount - 1);
    const page = pdfDoc.getPage(pageIndex);
    const { width: pageW, height: pageH } = page.getSize();

    // Embed QR image
    const qrImage = await pdfDoc.embedPng(qrBuffer);

    // Embed user signature image
    let sigImage: any;
    try {
      if (activeSignature.fileKey.endsWith('.png')) {
        sigImage = await pdfDoc.embedPng(sigImageBuffer);
      } else if (
        activeSignature.fileKey.endsWith('.jpg') ||
        activeSignature.fileKey.endsWith('.jpeg')
      ) {
        sigImage = await pdfDoc.embedJpg(sigImageBuffer);
      } else {
        // Fallback checks
        try {
          sigImage = await pdfDoc.embedPng(sigImageBuffer);
        } catch {
          sigImage = await pdfDoc.embedJpg(sigImageBuffer);
        }
      }
    } catch (err) {
      throw new BadRequestException(
        'Format gambar tanda tangan tidak valid untuk kompilasi PDF.',
      );
    }

    // Translate relative percentages (0-100) to PDF coordinates
    const sigX = (data.posX / 100) * pageW;
    const sigY =
      pageH - (data.posY / 100) * pageH - (data.height / 100) * pageH;
    const sigW = (data.width / 100) * pageW;
    const sigH = (data.height / 100) * pageH;

    const qrX = (data.qrPosX / 100) * pageW;
    const qrY =
      pageH - (data.qrPosY / 100) * pageH - (data.qrHeight / 100) * pageH;
    const qrW = (data.qrWidth / 100) * pageW;
    const qrH = (data.qrHeight / 100) * pageH;

    // A. Embed user signature image directly
    page.drawImage(sigImage, {
      x: sigX,
      y: sigY,
      width: sigW,
      height: sigH,
    });

    // Draw small text credentials overlay beside signature image for verification auditing
    const signatureDate = data.clientTime ? new Date(data.clientTime) : new Date();
    const timezone = data.clientTimeZone || 'UTC';
    const formattedDate = signatureDate.toLocaleString('id-ID', {
      timeZone: timezone,
    });

    page.drawText(
      `Digitally Signed by ${user.name}\nDate: ${formattedDate}`,
      {
        x: sigX,
        y: Math.max(5, sigY - 18),
        size: 5.5,
        color: rgb(0.12, 0.43, 0.76),
        lineHeight: 7,
      },
    );

    // B. Draw QR code image
    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrW,
      height: qrH,
    });

    // 9. Save PDF and calculate SHA-256 hash
    const signedPdfBytes = await pdfDoc.save();
    const signedPdfBuffer = Buffer.from(signedPdfBytes);
    const fileHash = crypto
      .createHash('sha256')
      .update(signedPdfBuffer)
      .digest('hex');

    // 10. Automatic versioning: determine file name
    const versionCount = await this.prisma.signedDocument.count({
      where: { sourceType, sourceDocumentId: sourceId },
    });
    const versionSuffix = versionCount > 0 ? `_v${versionCount + 1}` : '';
    const fileKey = `documents/signed/${sourceType.toLowerCase()}_${sourceId}${versionSuffix}.pdf`;

    // 11. Upload final signed PDF to MinIO
    const signedPdfUrl = await this.storageService.uploadBuffer(
      signedPdfBuffer,
      fileKey,
      'application/pdf',
    );

    // 12. Create SignedDocument record
    const signedDoc = await this.prisma.signedDocument.create({
      data: {
        sourceType,
        sourceDocumentId: sourceId,
        title,
        categoryId: resolvedCategoryId,
        warehouseId,
        signedPdfUrl,
        fileKey,
        fileHash,
        originalFileKey,
        verificationToken,
        signedBy: userId,
        signatureTemplateId: data.templateId || null,
        status: 'VALID',
        signedAt: data.clientTime ? new Date(data.clientTime) : new Date(),
      },
      include: {
        category: true,
        signer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 13. Log standard audit log
    await this.logActivity(userId, 'SIGN_DOCUMENT', signedDoc.id, {
      sourceType,
      sourceId,
      title,
      ipAddress,
      fileHash,
    });

    return {
      ...signedDoc,
      signedPdfUrl,
    };
  }

  private async logActivity(
    userId: number | null,
    action: string,
    documentId: number | null,
    metadata?: any,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action,
        details: JSON.stringify({
          documentId,
          ...metadata,
        }),
      },
    });
  }
}

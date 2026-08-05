import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import type { GenerateDocumentInput } from '@bulog-wms/schema';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';

@Injectable()
export class DocumentGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly warehouseContext: WarehouseContextService,
    @InjectQueue('document-generation') private readonly documentQueue: Queue,
  ) {}

  /**
   * Request document generation
   */
  async generate(body: GenerateDocumentInput, userId: number) {
    const warehouseId = this.warehouseContext.getWarehouseId();

    // Find template
    const template = await this.prisma.documentTemplate.findFirst({
      where: {
        OR: [
          { uuid: String(body.templateId) },
          { id: isNaN(Number(body.templateId)) ? -1 : Number(body.templateId) },
        ],
        deletedAt: null,
      },
    });

    if (!template) {
      throw new NotFoundException('Template tidak ditemukan.');
    }

    if (!template.isActive) {
      throw new BadRequestException('Template sedang tidak aktif.');
    }

    // Generate unique verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create initial DOCUMENT_GENERATED record
    const documentGenerated = await this.prisma.documentGenerated.create({
      data: {
        templateId: template.id,
        categoryId: template.categoryId,
        title: body.title,
        documentNumber: body.documentNumber,
        verificationToken,
        generatedBy: userId,
        status: 'PROCESSING',
        warehouseId,
      },
    });

    // Enqueue BullMQ job
    await this.documentQueue.add(
      'generate-job',
      {
        id: documentGenerated.id,
        templateId: template.id,
        placeholder: body.placeholder,
        attachments: body.attachments || [],
        userId,
        warehouseId,
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return {
      uuid: documentGenerated.uuid,
      status: documentGenerated.status,
    };
  }

  /**
   * Find history of generated documents
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    templateId?: string;
    categoryId?: string;
    status?: string;
    generatedBy?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { documentNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.templateId) {
      const template = await this.prisma.documentTemplate.findFirst({
        where: {
          OR: [
            { uuid: params.templateId },
            { id: isNaN(Number(params.templateId)) ? -1 : Number(params.templateId) },
          ],
          deletedAt: null,
        },
      });
      if (template) {
        where.templateId = template.id;
      } else {
        return { data: [], pagination: { total: 0, page, limit, totalPages: 0 } };
      }
    }

    if (params.categoryId) {
      const category = await this.prisma.documentCategory.findFirst({
        where: {
          OR: [
            { uuid: params.categoryId },
            { id: isNaN(Number(params.categoryId)) ? -1 : Number(params.categoryId) },
          ],
          deletedAt: null,
        },
      });
      if (category) {
        where.categoryId = category.id;
      } else {
        return { data: [], pagination: { total: 0, page, limit, totalPages: 0 } };
      }
    }

    if (params.generatedBy) {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { uuid: params.generatedBy },
            { id: isNaN(Number(params.generatedBy)) ? -1 : Number(params.generatedBy) },
          ],
        },
      });
      if (user) {
        where.generatedBy = user.id;
      } else {
        return { data: [], pagination: { total: 0, page, limit, totalPages: 0 } };
      }
    }

    if (params.startDate || params.endDate) {
      where.generatedAt = {};
      if (params.startDate) {
        where.generatedAt.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        // Set to end of day
        const end = new Date(params.endDate);
        end.setHours(23, 59, 59, 999);
        where.generatedAt.lte = end;
      }
    }

    const [total, data] = await Promise.all([
      this.prisma.documentGenerated.count({ where }),
      this.prisma.documentGenerated.findMany({
        where,
        skip,
        take: limit,
        orderBy: { generatedAt: 'desc' },
        include: {
          template: {
            select: { id: true, uuid: true, name: true, code: true, version: true },
          },
          category: {
            select: { id: true, uuid: true, name: true, code: true },
          },
          generator: {
            select: { id: true, uuid: true, name: true, email: true },
          },
        },
      }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single generated detail
   */
  async findOne(uuid: string) {
    const doc = await this.prisma.documentGenerated.findFirst({
      where: { uuid, deletedAt: null },
      include: {
        template: {
          select: { id: true, uuid: true, name: true, code: true, version: true },
        },
        category: {
          select: { id: true, uuid: true, name: true, code: true },
        },
        generator: {
          select: { id: true, uuid: true, name: true, email: true },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException('Dokumen tidak ditemukan.');
    }

    return doc;
  }

  /**
   * Generate preview URL (PDF)
   */
  async getPreviewUrl(uuid: string) {
    const doc = await this.findOne(uuid);
    if (!doc.pdfObjectKey) {
      throw new BadRequestException('File PDF belum siap atau proses generate gagal.');
    }
    return this.storageService.getFilePrivateUrl(doc.pdfObjectKey);
  }

  /**
   * Generate DOCX download URL
   */
  async getDownloadDocxUrl(uuid: string) {
    const doc = await this.findOne(uuid);
    if (!doc.docxObjectKey) {
      throw new BadRequestException('File DOCX belum siap.');
    }
    return this.storageService.getFilePrivateUrl(doc.docxObjectKey);
  }

  /**
   * Generate PDF download URL
   */
  async getDownloadPdfUrl(uuid: string) {
    const doc = await this.findOne(uuid);
    if (!doc.pdfObjectKey) {
      throw new BadRequestException('File PDF belum siap.');
    }
    return this.storageService.getFilePrivateUrl(doc.pdfObjectKey);
  }

  /**
   * Soft delete generated document
   */
  async remove(uuid: string) {
    const doc = await this.findOne(uuid);

    return this.prisma.documentGenerated.update({
      where: { id: doc.id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}

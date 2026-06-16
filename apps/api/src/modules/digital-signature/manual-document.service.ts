import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import type { CreateManualDocumentInput } from '@bulog-wms/schema';

@Injectable()
export class ManualDocumentService {
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

  async create(data: any, uploadedBy: number) {
    const resolvedCategoryId = await this.resolveCategoryId(data.categoryId);
    const warehouseId = this.warehouseContext.getWarehouseId();

    const fileKey = data.fileKey || this.extractKeyFromUrl(data.fileUrl);

    return this.prisma.manualDocument.create({
      data: {
        title: data.title,
        categoryId: resolvedCategoryId,
        description: data.description,
        fileUrl: data.fileUrl,
        fileKey,
        uploadedBy,
        warehouseId,
      },
      include: {
        category: true,
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async findAll(query: { search?: string; categoryId?: number }) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    const where: any = {
      deletedAt: null,
      warehouseId,
    };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const docs = await this.prisma.manualDocument.findMany({
      where,
      include: {
        category: true,
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Sign URLs dynamically on fetch for private buckets
    return Promise.all(
      docs.map(async (doc) => {
        let fileUrl = doc.fileUrl;
        if (doc.fileKey) {
          fileUrl = await this.storageService.getFilePrivateUrl(doc.fileKey);
        }
        return {
          ...doc,
          fileUrl,
        };
      }),
    );
  }

  async findOne(uuid: string) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    const doc = await this.prisma.manualDocument.findFirst({
      where: { uuid, warehouseId, deletedAt: null },
      include: {
        category: true,
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException(
        `Dokumen manual dengan UUID ${uuid} tidak ditemukan.`,
      );
    }

    // Sign URL dynamically
    if (doc.fileKey) {
      doc.fileUrl = await this.storageService.getFilePrivateUrl(doc.fileKey);
    }

    return doc;
  }

  async remove(uuid: string) {
    const doc = await this.findOne(uuid);

    // Delete file from MinIO
    if (doc.fileKey) {
      try {
        await this.storageService.deleteFileByKey(doc.fileKey);
      } catch (err: any) {
        // Log warning, continue
      }
    }

    return this.prisma.manualDocument.update({
      where: { id: doc.id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}

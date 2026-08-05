import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import type { CreateDocumentTemplateInput, UpdateDocumentTemplateInput, UpdateAssemblyInput, UpdatePlaceholdersInput } from '@bulog-wms/schema';
import PizZip = require('pizzip');
import Docxtemplater = require('docxtemplater');

const InspectModule = require('docxtemplater/js/inspect-module.js');

@Injectable()
export class DocumentTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  /**
   * Helper to parse DOCX buffer and extract placeholders
   */
  private extractPlaceholders(docxBuffer: Buffer) {
    try {
      const zip = new PizZip(docxBuffer);
      const inspectModule = InspectModule();
      const doc = new Docxtemplater(zip, {
        modules: [inspectModule],
      });
      doc.compile();
      const tags = inspectModule.getAllTags();

      const placeholders: Array<{ key: string; label: string; type: string; required: boolean }> = [];
      const processTags = (obj: any, prefix = '') => {
        for (const key of Object.keys(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          const val = obj[key];
          if (typeof val === 'object' && val !== null) {
            placeholders.push({
              key: fullKey,
              label: this.formatLabel(key),
              type: 'TABLE',
              required: false,
            });
            processTags(val, fullKey);
          } else {
            placeholders.push({
              key: fullKey,
              label: this.formatLabel(key),
              type: this.formatType(key),
              required: true,
            });
          }
        }
      };

      processTags(tags);
      return placeholders;
    } catch (e: any) {
      throw new BadRequestException(`Gagal membaca template DOCX: ${e.message}`);
    }
  }

  private formatLabel(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  private formatType(key: string): string {
    const lower = key.toLowerCase();
    if (lower.includes('date') || lower.includes('tanggal')) return 'DATE';
    if (lower.includes('time') || lower.includes('jam')) return 'TIME';
    if (lower.includes('email')) return 'TEXT';
    if (lower.includes('amount') || lower.includes('price') || lower.includes('harga') || lower.includes('total')) return 'CURRENCY';
    if (lower.includes('qty') || lower.includes('quantity') || lower.includes('jumlah') || lower.includes('count')) return 'NUMBER';
    if (lower.includes('is_') || lower.includes('has_') || lower.includes('status')) return 'BOOLEAN';
    return 'TEXT';
  }

  /**
   * Find templates with pagination and filters
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    active?: boolean;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.categoryId) {
      // Find category first to get its numeric ID if UUID is passed
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

    if (params.active !== undefined) {
      where.isActive = params.active;
    }

    const [total, data] = await Promise.all([
      this.prisma.documentTemplate.count({ where }),
      this.prisma.documentTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: {
            select: { id: true, uuid: true, name: true, code: true },
          },
          creator: {
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
   * Get template detail
   */
  async findOne(uuid: string) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { uuid, deletedAt: null },
      include: {
        category: {
          select: { id: true, uuid: true, name: true, code: true },
        },
        creator: {
          select: { id: true, uuid: true, name: true, email: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template tidak ditemukan.');
    }

    return template;
  }

  /**
   * Create template and auto detect placeholders
   */
  async create(body: CreateDocumentTemplateInput, file: Express.Multer.File, userId: number) {
    // Check if code is unique
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { code: body.code, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException('Kode template sudah digunakan.');
    }

    // Resolve category ID
    const category = await this.prisma.documentCategory.findFirst({
      where: {
        OR: [
          { uuid: String(body.categoryId) },
          { id: isNaN(Number(body.categoryId)) ? -1 : Number(body.categoryId) },
        ],
        deletedAt: null,
      },
    });
    if (!category) {
      throw new NotFoundException('Kategori dokumen tidak ditemukan.');
    }

    // Upload template DOCX to MinIO
    const warehouseId = this.warehouseContext.getWarehouseId();
    const folder = warehouseId ? `templates/wh-${warehouseId}` : 'templates/global';
    
    // Auto-detect placeholders
    const placeholders = this.extractPlaceholders(file.buffer);

    const attachment = await this.storageService.uploadFile(file, folder, userId);

    return this.prisma.documentTemplate.create({
      data: {
        code: body.code,
        name: body.name,
        description: body.description,
        categoryId: category.id,
        objectKey: attachment.filePath,
        placeholderSchema: placeholders as any,
        createdBy: userId,
        warehouseId,
        isActive: body.isActive ?? true,
      },
    });
  }

  /**
   * Update template metadata
   */
  async update(uuid: string, body: UpdateDocumentTemplateInput) {
    const template = await this.findOne(uuid);

    return this.prisma.documentTemplate.update({
      where: { id: template.id },
      data: {
        name: body.name,
        description: body.description,
        isActive: body.isActive,
      },
    });
  }

  /**
   * Upload new version of template
   */
  async uploadNewVersion(uuid: string, file: Express.Multer.File, userId: number) {
    const template = await this.findOne(uuid);

    // Auto-detect placeholders of the new file
    const placeholders = this.extractPlaceholders(file.buffer);

    // Upload new template DOCX to MinIO
    const warehouseId = this.warehouseContext.getWarehouseId();
    const folder = warehouseId ? `templates/wh-${warehouseId}` : 'templates/global';
    const attachment = await this.storageService.uploadFile(file, folder, userId);

    return this.prisma.documentTemplate.update({
      where: { id: template.id },
      data: {
        objectKey: attachment.filePath,
        placeholderSchema: placeholders as any,
        version: template.version + 1,
      },
    });
  }

  /**
   * Soft delete template
   */
  async remove(uuid: string) {
    const template = await this.findOne(uuid);

    return this.prisma.documentTemplate.update({
      where: { id: template.id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Get assembly config
   */
  async getAssembly(uuid: string) {
    const template = await this.findOne(uuid);
    return template.assemblySchema || [];
  }

  /**
   * Update assembly config
   */
  async updateAssembly(uuid: string, body: UpdateAssemblyInput) {
    const template = await this.findOne(uuid);

    // Optional: Validate that templateCodes in assembly schema exist in database
    for (const item of body) {
      if (item.type === 'TEMPLATE' && item.templateCode) {
        const exist = await this.prisma.documentTemplate.findFirst({
          where: { code: item.templateCode, deletedAt: null },
        });
        if (!exist) {
          throw new BadRequestException(`Template dengan kode "${item.templateCode}" di assembly tidak ditemukan.`);
        }
      }
    }

    return this.prisma.documentTemplate.update({
      where: { id: template.id },
      data: {
        assemblySchema: body as any,
      },
    });
  }

  /**
   * Get extracted placeholder schemas
   */
  async getPlaceholders(uuid: string) {
    const template = await this.findOne(uuid);
    return template.placeholderSchema || [];
  }

  /**
   * Update placeholder schema configuration
   */
  async updatePlaceholders(uuid: string, body: UpdatePlaceholdersInput) {
    const template = await this.findOne(uuid);

    return this.prisma.documentTemplate.update({
      where: { id: template.id },
      data: {
        placeholderSchema: body as any,
      },
    });
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import { WarehouseContextService } from '@/core/warehouse-context/warehouse-context.service';
import { getLocalStartOfDay, getLocalEndOfDay } from '@/core/utils/date';
import {
  validateTagihanTypeRules,
  getSecondaryQty,
  getSecondaryUnit,
  type CreateTagihanInput,
  type UpdateTagihanInput,
  type TagihanQueryInput,
  type TagihanType,
} from '@bulog-wms/schema';
import * as crypto from 'crypto';

@Injectable()
export class TagihanService {
  private readonly logger = new Logger(TagihanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  /**
   * Helper to map pickingTypeCode to standard Document Type (IN / OUT / INT)
   */
  private mapPickingTypeToDocType(pickingTypeCode: string): string {
    const code = (pickingTypeCode || '').toLowerCase();
    if (code === 'incoming') return 'IN';
    if (code === 'outgoing') return 'OUT';
    return 'INT';
  }

  /**
   * List Tagihan records with comprehensive filtering, search, pagination and summary totals.
   */
  async findAll(warehouseId: number, query: TagihanQueryInput) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = { warehouseId };
    const andConditions: any[] = [];

    // Filter by Tagihan Type
    if (query.type) {
      andConditions.push({ type: query.type as any });
    }

    // Filter by Status UUID
    if (query.statusUuid) {
      andConditions.push({ status: { uuid: query.statusUuid } });
    }

    // Filter specifically by No. Dokumen / SDI
    if (query.documentNumber) {
      andConditions.push({
        documentNumber: { contains: query.documentNumber, mode: 'insensitive' },
      });
    }

    // Filter by related documents / unified search across 4 document types:
    // 1. Tagihan documentNumber
    // 2. DocumentReference documentNumber
    // 3. DocumentPurchaseOrder documentNumber
    // 4. TagihanManualDocument documentNumber
    const searchTerm = query.relatedDocumentNumber || query.search;
    if (searchTerm) {
      andConditions.push({
        OR: [
          { documentNumber: { contains: searchTerm, mode: 'insensitive' } },
          {
            documentReferences: {
              some: {
                documentReference: {
                  documentNumber: { contains: searchTerm, mode: 'insensitive' },
                },
              },
            },
          },
          {
            nonCommodityDocuments: {
              some: {
                documentPurchaseOrder: {
                  documentNumber: { contains: searchTerm, mode: 'insensitive' },
                },
              },
            },
          },
          {
            manualDocuments: {
              some: {
                documentNumber: { contains: searchTerm, mode: 'insensitive' },
              },
            },
          },
        ],
      });
    }

    // Filter by Commodity / Product in related ERP documents
    if (query.productName) {
      andConditions.push({
        documentReferences: {
          some: {
            documentReference: {
              items: {
                some: {
                  productName: { contains: query.productName, mode: 'insensitive' },
                },
              },
            },
          },
        },
      });
    }

    // Date range filter
    const timezone = this.warehouseContext.getTimezone();
    if (query.startDate || query.endDate) {
      const dateCondition: any = {};
      if (query.startDate) {
        dateCondition.gte = getLocalStartOfDay(query.startDate, timezone);
      }
      if (query.endDate) {
        dateCondition.lte = getLocalEndOfDay(query.endDate, timezone);
      }
      andConditions.push({ tagihanDate: dateCondition });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Sorting
    let orderBy: any = [{ tagihanDate: 'desc' }, { id: 'desc' }];
    if (query.sortBy) {
      const direction = query.sortOrder === 'asc' ? 'asc' : 'desc';
      if (['tagihanDate', 'documentNumber', 'totalAmount', 'type'].includes(query.sortBy)) {
        orderBy = [{ [query.sortBy]: direction }, { id: 'desc' }];
      }
    }

    const [total, data, totalAmountAgg, countByType, countByStatus] = await Promise.all([
      this.prisma.tagihan.count({ where }),
      this.prisma.tagihan.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          status: true,
          createdBy: {
            select: { uuid: true, name: true, email: true },
          },
          documentReferences: {
            include: {
              documentReference: {
                include: {
                  items: true,
                },
              },
            },
          },
          nonCommodityDocuments: {
            include: {
              documentPurchaseOrder: true,
            },
          },
          manualDocuments: true,
          summaries: true,
          files: true,
        },
      }),
      this.prisma.tagihan.aggregate({
        where,
        _sum: { totalAmount: true },
      }),
      this.prisma.tagihan.groupBy({
        by: ['type'],
        where: { warehouseId },
        _count: { _all: true },
      }),
      this.prisma.tagihan.groupBy({
        by: ['statusId'],
        where: { warehouseId },
        _count: { _all: true },
      }),
    ]);

    const sanitizedData = data.map((item) => this.sanitize(item));

    return {
      data: sanitizedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalDocuments: total,
        totalAmount: totalAmountAgg._sum.totalAmount || 0,
        countByType: countByType.reduce((acc: any, curr) => {
          acc[curr.type] = curr._count._all;
          return acc;
        }, {}),
        countByStatus: countByStatus.reduce((acc: any, curr) => {
          acc[curr.statusId ?? 0] = curr._count._all;
          return acc;
        }, {}),
      },
    };
  }

  /**
   * Find single Tagihan by UUID with all relations and presigned file URLs.
   */
  async findOne(warehouseId: number, uuid: string) {
    const tagihan = await this.prisma.tagihan.findFirst({
      where: { uuid, warehouseId },
      include: {
        status: true,
        createdBy: {
          select: { uuid: true, name: true, email: true },
        },
        documentReferences: {
          include: {
            documentReference: {
              include: {
                items: true,
              },
            },
          },
        },
        nonCommodityDocuments: {
          include: {
            documentPurchaseOrder: true,
          },
        },
        manualDocuments: {
          orderBy: { id: 'asc' },
        },
        summaries: {
          orderBy: [{ documentType: 'asc' }, { uom: 'asc' }],
        },
        files: {
          orderBy: { uploadedAt: 'desc' },
          include: {
            uploadedBy: {
              select: { uuid: true, name: true },
            },
          },
        },
        warehouse: {
          select: { uuid: true, code: true, name: true },
        },
      },
    });

    if (!tagihan) {
      throw new NotFoundException('Data Tagihan tidak ditemukan.');
    }

    // Generate presigned private URLs for supporting files
    const filesWithUrls = await Promise.all(
      tagihan.files.map(async (file) => {
        let downloadUrl = '';
        try {
          downloadUrl = await this.storageService.getFilePrivateUrl(file.filePath, 3600);
        } catch (err: any) {
          this.logger.warn(`Failed to generate presigned URL for file ${file.uuid}: ${err.message}`);
        }
        return {
          ...file,
          downloadUrl,
        };
      }),
    );

    return this.sanitize({ ...tagihan, files: filesWithUrls });
  }

  /**
   * Create Tagihan with validation of ERP document rules and recalculation of TagihanSummary.
   */
  async create(
    warehouseId: number,
    userId: number,
    dto: CreateTagihanInput,
    currentUser?: any,
  ) {
    const userRole = currentUser?.role?.name || currentUser?.role;
    if (userRole === 'FINANCE') {
      throw new ForbiddenException(
        'Role Finance tidak memiliki izin untuk membuat tagihan baru.',
      );
    }

    // 1. Check unique documentNumber
    const existingDoc = await this.prisma.tagihan.findFirst({
      where: { documentNumber: dto.documentNumber },
    });
    if (existingDoc) {
      throw new BadRequestException(
        `Nomor Dokumen / SDI "${dto.documentNumber}" sudah terdaftar.`,
      );
    }

    // 2. Fetch and validate ERP Commodity Documents
    let selectedErpDocs: any[] = [];
    if (dto.erpDocumentUuids && dto.erpDocumentUuids.length > 0) {
      selectedErpDocs = await this.prisma.documentReference.findMany({
        where: {
          uuid: { in: dto.erpDocumentUuids },
          warehouseId,
        },
        include: { items: true },
      });

      if (selectedErpDocs.length !== dto.erpDocumentUuids.length) {
        throw new BadRequestException('Satu atau lebih Dokumen ERP tidak ditemukan.');
      }

      // Validate Tagihan Type Rules
      const validation = validateTagihanTypeRules(dto.type as TagihanType, selectedErpDocs);
      if (!validation.isValid) {
        throw new BadRequestException(validation.error);
      }
    }

    // 3. Fetch Non-Commodity Documents (Purchase Orders)
    let selectedPoDocs: any[] = [];
    if (dto.nonCommodityDocumentUuids && dto.nonCommodityDocumentUuids.length > 0) {
      selectedPoDocs = await this.prisma.documentPurchaseOrder.findMany({
        where: {
          uuid: { in: dto.nonCommodityDocumentUuids },
          OR: [{ warehouseId }, { warehouseId: null }],
        },
      });

      if (selectedPoDocs.length !== dto.nonCommodityDocumentUuids.length) {
        throw new BadRequestException(
          'Satu atau lebih Dokumen Non-Commodity PO tidak ditemukan.',
        );
      }
    }

    // 4. Calculate TagihanSummary from selected ERP Commodity Documents using Secondary Quantity
    // Group by: Document Type (IN/OUT/INT) + Secondary UOM
    const summaryMap = new Map<string, { documentType: string; uom: string; quantity: number }>();

    for (const erpDoc of selectedErpDocs) {
      const docType = this.mapPickingTypeToDocType(erpDoc.pickingTypeCode);
      for (const item of erpDoc.items || []) {
        const primaryQty = Number(item.quantity || item.productQty || 0);
        const secQty = getSecondaryQty(primaryQty, item.uom);
        const secUnit = getSecondaryUnit(item.uom).toUpperCase();
        const key = `${docType}__${secUnit}`;

        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            documentType: docType,
            uom: secUnit,
            quantity: 0,
          });
        }

        const current = summaryMap.get(key)!;
        current.quantity += secQty;
      }
    }

    // Map user-provided cost per unit to summary groups
    const userCostMap = new Map<string, number>();
    for (const s of dto.summaries || []) {
      const key = `${s.documentType.trim().toUpperCase()}__${s.uom.trim().toUpperCase()}`;
      userCostMap.set(key, Number(s.costPerUnit) || 0);
    }

    let calculatedTotalAmount = 0;
    const summariesToCreate: Array<{
      documentType: string;
      uom: string;
      quantity: number;
      costPerUnit: number;
      subtotal: number;
    }> = [];

    summaryMap.forEach((val, key) => {
      const costPerUnit = userCostMap.get(key) ?? userCostMap.get(val.uom) ?? 0;
      const subtotal = val.quantity * costPerUnit;
      calculatedTotalAmount += subtotal;

      summariesToCreate.push({
        documentType: val.documentType,
        uom: val.uom,
        quantity: Math.round(val.quantity * 1000) / 1000,
        costPerUnit,
        subtotal: Math.round(subtotal * 100) / 100,
      });
    });

    // 5. Lookup Status
    let statusId: number | null = null;
    if (dto.statusUuid) {
      const status = await this.prisma.masterTagihanStatus.findUnique({
        where: { uuid: dto.statusUuid },
      });
      if (status) {
        statusId = status.id;
      }
    } else {
      const defaultStatus = await this.prisma.masterTagihanStatus.findFirst({
        where: { isDefault: true },
      });
      if (defaultStatus) {
        statusId = defaultStatus.id;
      }
    }

    // 6. Execute Transaction
    const newTagihan = await this.prisma.$transaction(async (tx) => {
      const createdTagihan = await tx.tagihan.create({
        data: {
          warehouseId,
          documentNumber: dto.documentNumber,
          type: dto.type as any,
          statusId,
          totalAmount: Math.round(calculatedTotalAmount * 100) / 100,
          notes: dto.notes,
          tagihanDate: dto.tagihanDate ? new Date(dto.tagihanDate) : new Date(),
          createdById: userId,
        },
      });

      // Link ERP Commodity Documents
      if (selectedErpDocs.length > 0) {
        await tx.tagihanDocumentReference.createMany({
          data: selectedErpDocs.map((doc) => ({
            tagihanId: createdTagihan.id,
            documentReferenceId: doc.id,
          })),
        });
      }

      // Link Non-Commodity Documents
      if (selectedPoDocs.length > 0) {
        await tx.tagihanNonCommodityDocument.createMany({
          data: selectedPoDocs.map((po) => ({
            tagihanId: createdTagihan.id,
            documentPurchaseOrderId: po.id,
          })),
        });
      }

      // Create Manual Documents
      if (dto.manualDocuments && dto.manualDocuments.length > 0) {
        await tx.tagihanManualDocument.createMany({
          data: dto.manualDocuments.map((m) => ({
            tagihanId: createdTagihan.id,
            documentNumber: m.documentNumber,
            description: m.description,
          })),
        });
      }

      // Create Summaries
      if (summariesToCreate.length > 0) {
        await tx.tagihanSummary.createMany({
          data: summariesToCreate.map((s) => ({
            tagihanId: createdTagihan.id,
            documentType: s.documentType,
            uom: s.uom,
            quantity: s.quantity,
            costPerUnit: s.costPerUnit,
            subtotal: s.subtotal,
          })),
        });
      }

      return createdTagihan;
    });

    return this.findOne(warehouseId, newTagihan.uuid);
  }

  /**
   * Update existing Tagihan, recalculating summaries and updating relationships safely.
   */
  async update(
    warehouseId: number,
    uuid: string,
    dto: UpdateTagihanInput,
    currentUser?: any,
  ) {
    const existing = await this.prisma.tagihan.findFirst({
      where: { uuid, warehouseId },
      include: {
        documentReferences: true,
        summaries: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Data Tagihan tidak ditemukan.');
    }

    const userRole = currentUser?.role?.name || currentUser?.role;
    const isFinance = userRole === 'FINANCE';

    // Role Finance Field-Level Authorization checks:
    if (isFinance) {
      if (dto.type && dto.type !== existing.type) {
        throw new ForbiddenException(
          'Role Finance tidak memiliki izin untuk mengubah tipe/kategori tagihan.',
        );
      }
      if (dto.documentNumber && dto.documentNumber !== existing.documentNumber) {
        throw new ForbiddenException(
          'Role Finance tidak memiliki izin untuk mengubah nomor dokumen / SDI.',
        );
      }
      if (
        dto.tagihanDate &&
        new Date(dto.tagihanDate).getTime() !== new Date(existing.tagihanDate).getTime()
      ) {
        throw new ForbiddenException(
          'Role Finance tidak memiliki izin untuk mengubah tanggal/waktu tagihan.',
        );
      }
      const existingNotes = existing.notes ?? '';
      const incomingNotes = dto.notes !== undefined ? (dto.notes ?? '') : existingNotes;
      if (dto.notes !== undefined && incomingNotes !== existingNotes) {
        throw new ForbiddenException(
          'Role Finance tidak memiliki izin untuk mengubah catatan atau informasi utama tagihan.',
        );
      }
    }

    // 1. If documentNumber changed, check uniqueness
    if (dto.documentNumber && dto.documentNumber !== existing.documentNumber) {
      const dup = await this.prisma.tagihan.findFirst({
        where: { documentNumber: dto.documentNumber },
      });
      if (dup) {
        throw new BadRequestException(
          `Nomor Dokumen / SDI "${dto.documentNumber}" sudah terdaftar.`,
        );
      }
    }

    const currentType = (dto.type || existing.type) as TagihanType;

    // 2. Resolve ERP Documents (if updated or re-evaluated)
    let selectedErpDocs: any[] = [];
    const erpUuids = dto.erpDocumentUuids;
    if (erpUuids !== undefined) {
      if (erpUuids.length > 0) {
        selectedErpDocs = await this.prisma.documentReference.findMany({
          where: {
            uuid: { in: erpUuids },
            warehouseId,
          },
          include: { items: true },
        });

        if (selectedErpDocs.length !== erpUuids.length) {
          throw new BadRequestException('Satu atau lebih Dokumen ERP tidak ditemukan.');
        }

        const validation = validateTagihanTypeRules(currentType, selectedErpDocs);
        if (!validation.isValid) {
          throw new BadRequestException(validation.error);
        }
      }
    } else {
      // Keep existing ERP docs
      const existingDocIds = existing.documentReferences.map((r) => r.documentReferenceId);
      selectedErpDocs = await this.prisma.documentReference.findMany({
        where: { id: { in: existingDocIds } },
        include: { items: true },
      });
    }

    // 3. Resolve Non-Commodity Documents (if updated)
    let selectedPoDocs: any[] | null = null;
    if (dto.nonCommodityDocumentUuids !== undefined) {
      if (dto.nonCommodityDocumentUuids.length > 0) {
        selectedPoDocs = await this.prisma.documentPurchaseOrder.findMany({
          where: {
            uuid: { in: dto.nonCommodityDocumentUuids },
            OR: [{ warehouseId }, { warehouseId: null }],
          },
        });
      } else {
        selectedPoDocs = [];
      }
    }

    // 4. Calculate Summaries using Secondary Quantity
    const summaryMap = new Map<string, { documentType: string; uom: string; quantity: number }>();
    for (const erpDoc of selectedErpDocs) {
      const docType = this.mapPickingTypeToDocType(erpDoc.pickingTypeCode);
      for (const item of erpDoc.items || []) {
        const primaryQty = Number(item.quantity || item.productQty || 0);
        const secQty = getSecondaryQty(primaryQty, item.uom);
        const secUnit = getSecondaryUnit(item.uom).toUpperCase();
        const key = `${docType}__${secUnit}`;

        if (!summaryMap.has(key)) {
          summaryMap.set(key, { documentType: docType, uom: secUnit, quantity: 0 });
        }
        summaryMap.get(key)!.quantity += secQty;
      }
    }

    const userCostMap = new Map<string, number>();
    // Existing costs as fallback
    for (const s of existing.summaries) {
      const key = `${s.documentType.trim().toUpperCase()}__${s.uom.trim().toUpperCase()}`;
      userCostMap.set(key, s.costPerUnit);
    }
    // New costs from payload
    if (dto.summaries) {
      for (const s of dto.summaries) {
        const key = `${s.documentType.trim().toUpperCase()}__${s.uom.trim().toUpperCase()}`;
        userCostMap.set(key, Number(s.costPerUnit) || 0);
      }
    }

    let calculatedTotalAmount = 0;
    const summariesToCreate: Array<{
      documentType: string;
      uom: string;
      quantity: number;
      costPerUnit: number;
      subtotal: number;
    }> = [];

    summaryMap.forEach((val, key) => {
      const costPerUnit = userCostMap.get(key) ?? userCostMap.get(val.uom) ?? 0;
      const subtotal = val.quantity * costPerUnit;
      calculatedTotalAmount += subtotal;

      summariesToCreate.push({
        documentType: val.documentType,
        uom: val.uom,
        quantity: Math.round(val.quantity * 1000) / 1000,
        costPerUnit,
        subtotal: Math.round(subtotal * 100) / 100,
      });
    });

    // 5. Status lookup
    let statusId = existing.statusId;
    if (dto.statusUuid !== undefined) {
      if (dto.statusUuid) {
        const status = await this.prisma.masterTagihanStatus.findUnique({
          where: { uuid: dto.statusUuid },
        });
        statusId = status ? status.id : null;
      } else {
        statusId = null;
      }
    }

    // 6. Execute Transaction
    await this.prisma.$transaction(async (tx) => {
      // Update Tagihan header (documentNumber and tagihanDate are strictly read-only on edit)
      const updateData: any = {
        statusId,
        totalAmount: Math.round(calculatedTotalAmount * 100) / 100,
      };
      if (!isFinance) {
        if (dto.type) updateData.type = dto.type as any;
        if (dto.notes !== undefined) updateData.notes = dto.notes;
      }

      await tx.tagihan.update({
        where: { id: existing.id },
        data: updateData,
      });

      // Update ERP Links if provided
      if (dto.erpDocumentUuids !== undefined) {
        await tx.tagihanDocumentReference.deleteMany({
          where: { tagihanId: existing.id },
        });
        if (selectedErpDocs.length > 0) {
          await tx.tagihanDocumentReference.createMany({
            data: selectedErpDocs.map((doc) => ({
              tagihanId: existing.id,
              documentReferenceId: doc.id,
            })),
          });
        }
      }

      // Update Non-Commodity Links if provided
      if (selectedPoDocs !== null) {
        await tx.tagihanNonCommodityDocument.deleteMany({
          where: { tagihanId: existing.id },
        });
        if (selectedPoDocs.length > 0) {
          await tx.tagihanNonCommodityDocument.createMany({
            data: selectedPoDocs.map((po) => ({
              tagihanId: existing.id,
              documentPurchaseOrderId: po.id,
            })),
          });
        }
      }

      // Update Manual Documents if provided
      if (dto.manualDocuments !== undefined) {
        await tx.tagihanManualDocument.deleteMany({
          where: { tagihanId: existing.id },
        });
        if (dto.manualDocuments.length > 0) {
          await tx.tagihanManualDocument.createMany({
            data: dto.manualDocuments.map((m) => ({
              tagihanId: existing.id,
              documentNumber: m.documentNumber,
              description: m.description,
            })),
          });
        }
      }

      // Replace Summaries
      await tx.tagihanSummary.deleteMany({
        where: { tagihanId: existing.id },
      });
      if (summariesToCreate.length > 0) {
        await tx.tagihanSummary.createMany({
          data: summariesToCreate.map((s) => ({
            tagihanId: existing.id,
            documentType: s.documentType,
            uom: s.uom,
            quantity: s.quantity,
            costPerUnit: s.costPerUnit,
            subtotal: s.subtotal,
          })),
        });
      }
    });

    return this.findOne(warehouseId, uuid);
  }

  /**
   * Delete Tagihan safely. Only deletes new Tagihan-related records.
   */
  async delete(warehouseId: number, uuid: string, currentUser?: any) {
    const userRole = currentUser?.role?.name || currentUser?.role;
    if (userRole === 'FINANCE') {
      throw new ForbiddenException(
        'Role Finance tidak memiliki izin untuk menghapus tagihan.',
      );
    }

    const existing = await this.prisma.tagihan.findFirst({
      where: { uuid, warehouseId },
      include: { files: true },
    });

    if (!existing) {
      throw new NotFoundException('Data Tagihan tidak ditemukan.');
    }

    // Remove files from storage
    for (const f of existing.files) {
      try {
        await this.storageService.deleteFileByKey(f.filePath);
      } catch (err: any) {
        this.logger.warn(`Failed to delete S3 file ${f.filePath}: ${err.message}`);
      }
    }

    // Delete Tagihan (Prisma cascade deletes TagihanDocumentReference, TagihanNonCommodityDocument, TagihanManualDocument, TagihanSummary, TagihanFile)
    await this.prisma.tagihan.delete({
      where: { id: existing.id },
    });

    return { message: 'Tagihan berhasil dihapus.' };
  }

  /**
   * Upload supporting file for Tagihan.
   */
  async uploadFile(
    warehouseId: number,
    tagihanUuid: string,
    file: Express.Multer.File,
    userId: number,
  ) {
    const tagihan = await this.prisma.tagihan.findFirst({
      where: { uuid: tagihanUuid, warehouseId },
    });

    if (!tagihan) {
      throw new NotFoundException('Data Tagihan tidak ditemukan.');
    }

    const uniqueId = crypto.randomUUID();
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `tagihan/${tagihan.uuid}/${uniqueId}-${cleanFileName}`;

    await this.storageService.uploadBuffer(file.buffer, filePath, file.mimetype);

    const tagihanFile = await this.prisma.tagihanFile.create({
      data: {
        tagihanId: tagihan.id,
        filePath,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById: userId,
      },
      include: {
        uploadedBy: {
          select: { uuid: true, name: true },
        },
      },
    });

    const downloadUrl = await this.storageService.getFilePrivateUrl(filePath, 3600);

    return {
      uuid: tagihanFile.uuid,
      fileName: tagihanFile.fileName,
      fileSize: tagihanFile.fileSize,
      mimeType: tagihanFile.mimeType,
      uploadedAt: tagihanFile.uploadedAt,
      downloadUrl,
      uploadedBy: tagihanFile.uploadedBy,
    };
  }

  /**
   * Delete supporting file.
   */
  async deleteFile(warehouseId: number, tagihanUuid: string, fileUuid: string) {
    const tagihan = await this.prisma.tagihan.findFirst({
      where: { uuid: tagihanUuid, warehouseId },
    });

    if (!tagihan) {
      throw new NotFoundException('Data Tagihan tidak ditemukan.');
    }

    const file = await this.prisma.tagihanFile.findFirst({
      where: { uuid: fileUuid, tagihanId: tagihan.id },
    });

    if (!file) {
      throw new NotFoundException('File lampiran tidak ditemukan.');
    }

    try {
      await this.storageService.deleteFileByKey(file.filePath);
    } catch (err: any) {
      this.logger.warn(`Failed to remove file from MinIO: ${err.message}`);
    }

    await this.prisma.tagihanFile.delete({
      where: { id: file.id },
    });

    return { message: 'File lampiran berhasil dihapus.' };
  }

  /**
   * Get presigned URL for downloading a supporting file.
   */
  async getFileDownloadUrl(warehouseId: number, tagihanUuid: string, fileUuid: string) {
    const tagihan = await this.prisma.tagihan.findFirst({
      where: { uuid: tagihanUuid, warehouseId },
    });

    if (!tagihan) {
      throw new NotFoundException('Data Tagihan tidak ditemukan.');
    }

    const file = await this.prisma.tagihanFile.findFirst({
      where: { uuid: fileUuid, tagihanId: tagihan.id },
    });

    if (!file) {
      throw new NotFoundException('File lampiran tidak ditemukan.');
    }

    const downloadUrl = await this.storageService.getFilePrivateUrl(file.filePath, 3600);
    return {
      downloadUrl,
      fileName: file.fileName,
      mimeType: file.mimeType,
    };
  }

  /**
   * Candidate ERP documents for Tagihan selection modal with rules and filters.
   */
  async getErpCandidates(
    warehouseId: number,
    query: {
      tagihanType?: string;
      search?: string;
      pickingTypeCode?: string;
      productName?: string;
      refFax?: string;
      month?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { warehouseId };
    const andConditions: any[] = [];

    // 1. Determine allowed picking type codes from Tagihan Type
    let allowedTypes: string[] | null = null;
    if (query.tagihanType) {
      const type = query.tagihanType.toUpperCase();
      if (type === 'LOADING') {
        allowedTypes = ['outgoing'];
      } else if (type === 'UNLOADING') {
        allowedTypes = ['incoming'];
      } else if (type === 'REBAGGING' || type === 'REPROSES') {
        allowedTypes = ['incoming', 'outgoing'];
      } else if (type === 'OVERSTAPEL') {
        allowedTypes = ['internal'];
      }
    }

    // 2. Handle Picking Type Code filter with exact matching for incoming, outgoing, internal
    if (query.pickingTypeCode) {
      const pCode = query.pickingTypeCode.toLowerCase().trim();
      let normalized = pCode;
      if (pCode === 'in' || pCode === 'incoming') normalized = 'incoming';
      else if (pCode === 'out' || pCode === 'outgoing') normalized = 'outgoing';
      else if (pCode === 'int' || pCode === 'internal') normalized = 'internal';

      andConditions.push({ pickingTypeCode: normalized });
    } else if (allowedTypes) {
      if (allowedTypes.length === 1) {
        andConditions.push({ pickingTypeCode: allowedTypes[0] });
      } else {
        andConditions.push({ pickingTypeCode: { in: allowedTypes } });
      }
    }

    // Search by documentNumber or partnerName
    if (query.search) {
      andConditions.push({
        OR: [
          { documentNumber: { contains: query.search, mode: 'insensitive' } },
          { partnerName: { contains: query.search, mode: 'insensitive' } },
          { origin: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    // Filter by refFax
    if (query.refFax) {
      andConditions.push({
        refFax: { contains: query.refFax, mode: 'insensitive' },
      });
    }

    // Filter by Product / Commodity
    if (query.productName) {
      andConditions.push({
        items: {
          some: {
            productName: { contains: query.productName, mode: 'insensitive' },
          },
        },
      });
    }

    // Filter by Date Range on dateDone
    const timezone = this.warehouseContext.getTimezone();
    if (query.startDate || query.endDate) {
      const dateDoneCondition: any = {};
      if (query.startDate) {
        dateDoneCondition.gte = getLocalStartOfDay(query.startDate, timezone);
      }
      if (query.endDate) {
        dateDoneCondition.lte = getLocalEndOfDay(query.endDate, timezone);
      }
      andConditions.push({ dateDone: dateDoneCondition });
    }

    // Filter by Month (e.g. "2026-10") if provided
    if (query.month) {
      const [year, monthStr] = query.month.split('-');
      const y = parseInt(year, 10);
      const m = parseInt(monthStr, 10);
      if (!isNaN(y) && !isNaN(m)) {
        const startOfMonth = new Date(Date.UTC(y, m - 1, 1));
        const endOfMonth = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        andConditions.push({
          OR: [
            { scheduledDate: { gte: startOfMonth, lte: endOfMonth } },
            { dateDone: { gte: startOfMonth, lte: endOfMonth } },
          ],
        });
      }
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [total, data] = await Promise.all([
      this.prisma.documentReference.count({ where }),
      this.prisma.documentReference.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dateDone: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
        include: {
          items: true,
        },
      }),
    ]);

    const sanitized = data.map((doc) => {
      const { id, warehouseId: wId, rawPayload, ...safe } = doc;
      return {
        ...safe,
        items: (doc.items || []).map((it) => {
          const { id: itemId, documentReferenceId, ...safeItem } = it;
          return safeItem;
        }),
      };
    });

    return {
      data: sanitized,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Sanitizes Tagihan entity to guarantee no numerical database IDs are exposed publicly.
   */
  public sanitize(tagihan: any) {
    if (!tagihan) return null;
    const {
      id,
      warehouseId,
      statusId,
      createdById,
      status,
      createdBy,
      documentReferences,
      nonCommodityDocuments,
      manualDocuments,
      summaries,
      files,
      warehouse,
      ...safeTagihan
    } = tagihan;

    const safeStatus = status
      ? {
        uuid: status.uuid,
        name: status.name,
        description: status.description,
        color: status.color,
        isDefault: status.isDefault,
      }
      : null;

    const safeCreatedBy = createdBy
      ? {
        uuid: createdBy.uuid,
        name: createdBy.name,
        email: createdBy.email,
      }
      : null;

    const safeWarehouse = warehouse
      ? {
        uuid: warehouse.uuid,
        code: warehouse.code,
        name: warehouse.name,
      }
      : null;

    const safeDocRefs = Array.isArray(documentReferences)
      ? documentReferences.map((ref) => {
        const doc = ref.documentReference;
        if (!doc) return { uuid: ref.uuid };
        const { id: dId, warehouseId: dWId, rawPayload, items, ...safeDoc } = doc;
        return {
          uuid: ref.uuid,
          documentReference: {
            ...safeDoc,
            items: Array.isArray(items)
              ? items.map((it) => {
                const { id: itId, documentReferenceId: drId, ...safeIt } = it;
                return safeIt;
              })
              : [],
          },
        };
      })
      : [];

    const safeNonCommodityDocs = Array.isArray(nonCommodityDocuments)
      ? nonCommodityDocuments.map((ref) => {
        const po = ref.documentPurchaseOrder;
        if (!po) return { uuid: ref.uuid };
        const { id: pId, warehouseId: pWId, rawJson, products, ...safePo } = po;
        return {
          uuid: ref.uuid,
          documentPurchaseOrder: {
            ...safePo,
            products: Array.isArray(products)
              ? products.map((pr: any) => {
                const { id: prId, documentPurchaseOrderId: dpoId, ...safePr } = pr;
                return safePr;
              })
              : [],
          },
        };
      })
      : [];

    const safeManualDocs = Array.isArray(manualDocuments)
      ? manualDocuments.map((m) => ({
        uuid: m.uuid,
        documentNumber: m.documentNumber,
        description: m.description,
        createdAt: m.createdAt,
      }))
      : [];

    const safeSummaries = Array.isArray(summaries)
      ? summaries.map((s) => ({
        uuid: s.uuid,
        documentType: s.documentType,
        uom: s.uom,
        quantity: s.quantity,
        costPerUnit: s.costPerUnit,
        subtotal: s.subtotal,
      }))
      : [];

    const safeFiles = Array.isArray(files)
      ? files.map((f) => ({
        uuid: f.uuid,
        fileName: f.fileName,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        fileType: f.fileType || 'MANUAL',
        fingerprint: f.fingerprint || null,
        generatedAt: f.generatedAt || null,
        uploadedAt: f.uploadedAt,
        downloadUrl: f.downloadUrl || null,
        uploadedBy: f.uploadedBy
          ? { uuid: f.uploadedBy.uuid, name: f.uploadedBy.name }
          : null,
      }))
      : [];

    return {
      ...safeTagihan,
      status: safeStatus,
      createdBy: safeCreatedBy,
      warehouse: safeWarehouse,
      documentReferences: safeDocRefs,
      nonCommodityDocuments: safeNonCommodityDocs,
      manualDocuments: safeManualDocs,
      summaries: safeSummaries,
      files: safeFiles,
    };
  }
}

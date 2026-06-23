import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import type {
  CreateGateOperationInput,
  CreateGateVerificationInput,
} from '@bulog-wms/schema';
import { CardType, VerificationStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { getLocalStartOfDay, getLocalEndOfDay, formatDateInTimezone } from '@/core/utils/date';
import { getReconciledStockForQuants } from '@/core/utils/stock-reconciliation';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GateService {
  private readonly logger = new Logger(GateService.name);
  private logoBufferCache: Buffer | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseContext: WarehouseContextService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Safe helper to read and cache the BULOG logo stored in the web public directory.
   * Falls back to drawing/rendering CSS logo box if missing.
   */
  async getLogoBuffer(): Promise<Buffer | null> {
    if (this.logoBufferCache) {
      return this.logoBufferCache;
    }
    try {
      const paths = [
        path.join(__dirname, '..', '..', 'assets', 'logo-bulog.png'),
        path.join(process.cwd(), 'src', 'assets', 'logo-bulog.png'),
        path.join(process.cwd(), 'dist', 'assets', 'logo-bulog.png'),
        path.join(process.cwd(), 'apps', 'api', 'src', 'assets', 'logo-bulog.png'),
        path.join(process.cwd(), 'apps', 'api', 'dist', 'assets', 'logo-bulog.png'),
      ];

      let resolvedPath = '';
      for (const p of paths) {
        if (fs.existsSync(p)) {
          resolvedPath = p;
          break;
        }
      }

      if (resolvedPath) {
        this.logoBufferCache = fs.readFileSync(resolvedPath);
        this.logger.log(`BULOG logo loaded from disk: ${resolvedPath}`);
        return this.logoBufferCache;
      }

      this.logger.warn('BULOG logo file not found in API assets. Using vector fallback.');
      return null;
    } catch (err: any) {
      this.logger.warn(`Failed to read BULOG logo: ${err.message}. Using vector fallback.`);
      return null;
    }
  }

  /**
   * Helper to format double dates/times.
   */
  private getStartAndEndOfToday() {
    const timezone = this.warehouseContext.getTimezone();
    const todayStr = formatDateInTimezone(new Date(), timezone);
    const start = getLocalStartOfDay(todayStr, timezone);
    const end = getLocalEndOfDay(todayStr, timezone);
    return { start, end };
  }

  /**
   * Helper to generate unique sequential gate operation number.
   * Format: GO-YYYYMMDD-XXXX
   */
  private async generateOpNumber(tx: any, cardType: CardType): Promise<string> {
    const lockId = cardType === CardType.IN ? 10001 : 10002;
    await tx.$queryRawUnsafe(
      `SELECT 1 FROM (SELECT pg_advisory_xact_lock(${lockId})) AS lock`,
    );

    const timezone = this.warehouseContext.getTimezone();
    const today = new Date();
    const todayStr = formatDateInTimezone(today, timezone);
    const [year, month, day] = todayStr.split('-');

    const start = getLocalStartOfDay(todayStr, timezone);
    const end = getLocalEndOfDay(todayStr, timezone);

    const lastOp = await tx.gateOperation.findFirst({
      where: {
        cardType,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { id: 'desc' },
      select: { opNumber: true },
    });

    let lastSeq = 0;
    if (lastOp && lastOp.opNumber) {
      const match = lastOp.opNumber.match(/^(?:IN|OUT)-(\d+)\//);
      if (match) {
        lastSeq = parseInt(match[1], 10);
      }
    }

    const nextSeq = String(lastSeq + 1).padStart(6, '0');
    return `${cardType}-${nextSeq}/${day}/${month}/${year}`;
  }

  /**
   * Create a new gate operation.
   */
  async createGateOperation(
    createdByUserId: number,
    body: CreateGateOperationInput,
  ) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Konteks warehouse (header x-warehouse-id) diperlukan.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Generate sequential number
      const opNumber = await this.generateOpNumber(
        tx,
        body.cardType as CardType,
      );
      const docRefId = (body as any).documentReferenceId;

      // 2. Create Gate Operation
      const gateOperation = await tx.gateOperation.create({
        data: {
          opNumber,
          cardType: body.cardType as CardType,
          driverName: body.driverName,
          licensePlate: body.licensePlate.toUpperCase(),
          clientPartner: body.clientPartner || null,
          driverPhone: body.driverPhone || null,
          notes: body.notes,
          status: 'PENDING',
          warehouseId,
          createdByUserId,
          documentReferenceId: docRefId || null,
        },
      });

      // 3. Update attachments association
      if (body.attachmentPaths && body.attachmentPaths.length > 0) {
        await tx.fileAttachment.updateMany({
          where: { filePath: { in: body.attachmentPaths } },
          data: { gateOperationId: gateOperation.id },
        });
      }

      // 4. Create products associated if any
      if (body.products && body.products.length > 0) {
        if (docRefId) {
          await this.validateDocumentReferenceLimits(
            tx,
            docRefId,
            body.products,
          );
        }
        for (const prod of body.products) {
          // Validate stack/quant quantity limits
          await this.validateStackQuantity(
            tx,
            body.cardType as CardType,
            prod.productId,
            prod.quantity,
            prod.quantId,
            prod.locationId,
          );

          await tx.gateOperationProduct.create({
            data: {
              gateOperationId: gateOperation.id,
              inventoryId: prod.productId,
              quantity: prod.quantity,
              quantId: prod.quantId || null,
              locationId: prod.locationId || null,
            },
          });

          if (prod.quantId && prod.quantId !== null) {
            await this.reserveQuantStock(
              tx,
              body.cardType as CardType,
              prod.quantId,
              prod.quantity,
            );
          }
        }
      }

      return { uuid : gateOperation.uuid };
    });
  }

  /**
   * Find list of gate operations for the active warehouse context.
   */
  async getGateOperations(query: {
    search?: string;
    cardType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortOrder?: 'asc' | 'desc';
  }) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException(
        'Konteks warehouse (header x-warehouse-id) diperlukan.',
      );
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      warehouseId,
    };

    if (query.startDate || query.endDate) {
      const timezone = this.warehouseContext.getTimezone();
      const createdAtFilter: any = {};
      if (query.startDate) {
        createdAtFilter.gte = getLocalStartOfDay(query.startDate, timezone);
      }
      if (query.endDate) {
        createdAtFilter.lte = getLocalEndOfDay(query.endDate, timezone);
      }
      where.createdAt = createdAtFilter;
    }

    if (query.search) {
      where.OR = [
        { opNumber: { contains: query.search, mode: 'insensitive' } },
        { driverName: { contains: query.search, mode: 'insensitive' } },
        { licensePlate: { contains: query.search, mode: 'insensitive' } },
        {
          documentReference: {
            OR: [
              { documentNumber: { contains: query.search, mode: 'insensitive' } },
              { origin: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    if (query.cardType) {
      where.cardType = query.cardType as CardType;
    }

    if (query.status) {
      if (query.status.includes(',')) {
        where.status = { in: query.status.split(',') as VerificationStatus[] };
      } else {
        where.status = query.status as VerificationStatus;
      }
    }

    const [total, items] = await Promise.all([
      this.prisma.gateOperation.count({ where }),
      this.prisma.gateOperation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: query.sortOrder || 'desc' },
        include: {
          attachments: true,
          documentReference: {
            include: { items: true },
          },
          products: {
            include: {
              inventory: true,
              quant: true,
              location: true,
            },
          },
          createdByUser: {
            select: { name: true, email: true },
          },
          verifiedBy: {
            select: { name: true, email: true },
          },
        },
      }),
    ]);

    const enrichedItems: any[] = items.map((item) =>
      this.mapOperationUrls(item),
    );

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: enrichedItems,
    };
  }

  /**
   * Get single gate operation details.
   */
  async getGateOperationByUuid(uuid: string) {
    const item = await this.prisma.gateOperation.findUnique({
      where: { uuid },
      include: {
        attachments: true,
        documentReference: {
          include: { items: true },
        },
        createdByUser: {
          select: { name: true, email: true },
        },
        products: {
          include: {
            inventory: true,
            quant: true,
            location: true,
          },
        },
        verifiedBy: {
          select: { name: true, email: true },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Gate operation tidak ditemukan.');
    }

    let documentHistory: any = null;
    if (item.documentReferenceId && item.documentReference) {
      const otherOps = await this.prisma.gateOperation.findMany({
        where: {
          documentReferenceId: item.documentReferenceId,
          uuid: { not: item.uuid },
        },
        include: {
          products: {
            include: { inventory: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const docItemsSummary = await Promise.all(
        item.documentReference.items.map(async (docItem) => {
          const aggregate = await this.prisma.gateOperationProduct.aggregate({
            where: {
              inventoryId: docItem.inventoryId,
              gateOperation: {
                documentReferenceId: item.documentReferenceId,
                status: { notIn: ['CANCELED', 'REJECTED'] },
              },
            },
            _sum: { quantity: true },
          });

          const erpQty = docItem.productQty || docItem.quantity || 0;
          const totalRealized = aggregate._sum.quantity || 0;
          const remainingQty = Math.max(0, erpQty - totalRealized);

          const inventory = await this.prisma.inventory.findUnique({
            where: { id: docItem.inventoryId },
            select: { sku: true },
          });

          let status = 'PENDING';
          if (totalRealized >= erpQty) {
            status = 'COMPLETED';
          } else if (totalRealized > 0) {
            status = 'PARTIAL';
          }

          return {
            productId: docItem.inventoryId,
            productName: docItem.productName,
            sku: inventory?.sku || docItem.analyticAccountName || '',
            uom: docItem.uom,
            erpQty,
            realizedQty: totalRealized,
            remainingQty,
            status,
          };
        }),
      );

      documentHistory = {
        otherOperations: otherOps.map((op: any) => this.mapOperationUrls(op)),
        summary: docItemsSummary,
      };
    }

    const resultObj = this.mapOperationUrls(item);
    if (resultObj) {
      resultObj.documentHistory = documentHistory;
    }
    return resultObj;
  }

  /**
   * Get unique driver details and license plates from document reference and gate operations history for a client partner.
   */
  async getClientHistory(warehouseId: number, clientPartner: string) {
    if (!clientPartner) {
      return [];
    }

    // 1. Query DocumentReference history for this partner
    const erpDocs = await this.prisma.documentReference.findMany({
      where: {
        warehouseId,
        partnerName: clientPartner,
      },
      select: {
        driver: true,
        plateNumber: true,
      },
    });

    // 2. Query GateOperation history for this partner
    const gateOps = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        clientPartner,
      },
      select: {
        driverName: true,
        licensePlate: true,
        driverPhone: true,
      },
    });

    // 3. Merge and deduplicate
    const historyMap = new Map<
      string,
      { licensePlate: string; driverName: string; driverPhone: string }
    >();

    for (const doc of erpDocs) {
      if (!doc.driver && !doc.plateNumber) continue;
      const plate = (doc.plateNumber || '').toUpperCase();
      const driver = doc.driver || '';
      const key = `${plate}_${driver.toLowerCase()}`;
      if (!historyMap.has(key)) {
        historyMap.set(key, {
          licensePlate: plate,
          driverName: driver,
          driverPhone: '',
        });
      }
    }

    for (const op of gateOps) {
      if (!op.driverName && !op.licensePlate) continue;
      const plate = (op.licensePlate || '').toUpperCase();
      const driver = op.driverName || '';
      const key = `${plate}_${driver.toLowerCase()}`;
      const existing = historyMap.get(key);
      if (existing) {
        if (op.driverPhone && !existing.driverPhone) {
          existing.driverPhone = op.driverPhone;
        }
      } else {
        historyMap.set(key, {
          licensePlate: plate,
          driverName: driver,
          driverPhone: op.driverPhone || '',
        });
      }
    }

    return Array.from(historyMap.values());
  }

  /**
   * Helper to recalculate GateOperation status and synchronization properties.
   */
  private async updateGateStatusAndRealisasi(
    tx: any,
    gateOperationId: number,
  ) {
    const gateOperation = await tx.gateOperation.findUnique({
      where: { id: gateOperationId },
    });

    if (!gateOperation) return;

    if (gateOperation.status === 'VERIFIED' || gateOperation.status === 'CANCELED') {
      return;
    }

    // 1. Get all Gate Operation Products
    const operationProducts = await tx.gateOperationProduct.findMany({
      where: { gateOperationId },
    });

    // 2. Sum up gate operation products total quantity
    const totalGateQty = operationProducts.reduce(
      (sum: number, p: any) => sum + p.quantity,
      0,
    );

    // Status gate operation Partial & Completed have been removed.
    // Status remains PENDING during cargo updates and verification.
  }

  /**
   * Verify/Audit a gate operation.
   */
  async verifyGateOperation(
    uuid: string,
    verifiedById: number,
    body: CreateGateVerificationInput,
  ) {
    const gateOperation = await this.prisma.gateOperation.findUnique({
      where: { uuid },
    });

    if (!gateOperation) {
      throw new NotFoundException('Gate operation tidak ditemukan.');
    }

    if (
      gateOperation.status === 'VERIFIED' ||
      gateOperation.status === 'CANCELED'
    ) {
      throw new BadRequestException(
        'Operasi gerbang sudah final (VERIFIED/CANCELED) dan tidak dapat diubah.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Handle Document Reference Update if provided
      const newDocRefId = (body as any).documentReferenceId;
      if (
        newDocRefId !== undefined &&
        newDocRefId !== gateOperation.documentReferenceId
      ) {
        if (newDocRefId) {
          // 1. Ensure Gate Operation items match the new ERP document items
          const docItems = await tx.documentReferenceItem.findMany({
            where: { documentReferenceId: newDocRefId },
          });
          const docInventoryIds = new Set(
            docItems.map((item: any) => item.inventoryId),
          );

          const gateProducts = await tx.gateOperationProduct.findMany({
            where: { gateOperationId: gateOperation.id },
          });

          for (const gp of gateProducts) {
            if (!docInventoryIds.has(gp.inventoryId)) {
              const product = await tx.inventory.findUnique({
                where: { id: gp.inventoryId },
              });
              throw new BadRequestException(
                `Produk ${product?.name || gp.inventoryId} tidak terdaftar pada dokumen referensi ERP yang baru dipilih.`,
              );
            }
          }

          // 2. Ensure total realized qty per item does not exceed ERP productQty
          for (const gp of gateProducts) {
            const docItem = docItems.find(
              (item: any) => item.inventoryId === gp.inventoryId,
            );
            if (docItem) {
              const otherOpsAggregate = await tx.gateOperationProduct.aggregate({
                where: {
                  inventoryId: gp.inventoryId,
                  gateOperation: {
                    documentReferenceId: newDocRefId,
                    id: { not: gateOperation.id },
                    status: { notIn: ['CANCELED', 'REJECTED'] },
                  },
                },
                _sum: { quantity: true },
              });
              const otherUsed = otherOpsAggregate._sum.quantity || 0;
              const currentAssigned = gp.quantity;

              const totalRealized = otherUsed + currentAssigned;
              if (totalRealized > docItem.quantity) {
                throw new BadRequestException(
                  `Total kuantitas realisasi untuk produk ${docItem.productName} (${totalRealized}) melebihi kuantitas dokumen ERP (${docItem.quantity}).`,
                );
              }
            }
          }
        }

        // Update documentReferenceId on GateOperation
        await tx.gateOperation.update({
          where: { id: gateOperation.id },
          data: {
            documentReferenceId: newDocRefId || null,
          },
        });
      }

      // Update gate operation verification fields
      await tx.gateOperation.update({
        where: { id: gateOperation.id },
        data: {
          verifiedById,
          verificationNotes: body.notes || null,
          verifiedAt: new Date(),
        },
      });

      // Update attachments for verification
      if (body.attachmentPaths !== undefined) {
        if (body.attachmentPaths.length > 0) {
          await tx.fileAttachment.updateMany({
            where: { filePath: { in: body.attachmentPaths } },
            data: { gateOperationId: gateOperation.id },
          });
        }
        await tx.fileAttachment.updateMany({
          where: {
            gateOperationId: gateOperation.id,
            filePath: { notIn: body.attachmentPaths },
          },
          data: { gateOperationId: null },
        });
      }

      // Save verification products details directly to GateOperationProduct
      if (body.products && body.products.length > 0) {
        for (const prod of body.products) {
          await this.validateStackQuantity(
            tx,
            gateOperation.cardType,
            prod.productId,
            prod.quantity,
            prod.quantId,
            prod.locationId,
            gateOperation.id,
          );

          // Find existing GateOperationProduct and update it
          const existingOpProd = await tx.gateOperationProduct.findFirst({
            where: {
              gateOperationId: gateOperation.id,
              inventoryId: prod.productId,
            },
          });

          if (existingOpProd) {
            await tx.gateOperationProduct.update({
              where: { id: existingOpProd.id },
              data: {
                quantity: prod.quantity,
                quantId: prod.quantId || null,
                locationId: prod.locationId || null,
              },
            });
          }
        }
      }

      // Recalculate status and references list
      await this.updateGateStatusAndRealisasi(
        tx,
        gateOperation.id,
      );

      const result = await tx.gateOperation.findUnique({
        where: { id: gateOperation.id },
        include: {
          attachments: true,
          verifiedBy: {
            select: { name: true, email: true },
          },
          products: {
            include: {
              inventory: true,
              quant: true,
              location: true,
            },
          },
        },
      });
      return this.mapOperationUrls(result);
    });
  }

  /**
   * Cancel a gate verification manually.
   */
  async cancelGateVerification(uuid: string, verifiedById: number) {
    const gateOperation = await this.prisma.gateOperation.findUnique({
      where: { uuid },
      include: {
        products: true,
      },
    });

    if (!gateOperation) {
      throw new NotFoundException('Gate operation tidak ditemukan.');
    }

    return this.prisma.$transaction(async (tx) => {
      const prevStatus = gateOperation.status;

      await tx.gateOperation.update({
        where: { id: gateOperation.id },
        data: {
          status: 'CANCELED',
          verifiedById,
          verifiedAt: new Date(),
          verificationNotes: 'Dibatalkan oleh Admin',
        },
      });

      // Release Reservations
      if (
        prevStatus !== 'CANCELED' &&
        prevStatus !== 'VERIFIED'
      ) {
        for (const p of gateOperation.products) {
          if (p.quantId) {
            await this.releaseQuantStock(
              tx,
              gateOperation.cardType,
              p.quantId,
              p.quantity,
            );
          }
        }
      }

      const result = await tx.gateOperation.findUnique({
        where: { id: gateOperation.id },
        include: {
          attachments: true,
          products: {
            include: {
              inventory: true,
              quant: true,
              location: true,
            },
          },
        },
      });
      return this.mapOperationUrls(result);
    });
  }

  /**
   * Update verification notes and attachments independently.
   */
  async updateNotesAttachments(
    uuid: string,
    verifiedById: number,
    body: { notes?: string; attachmentPaths?: string[] },
  ) {
    const gateOperation = await this.prisma.gateOperation.findUnique({
      where: { uuid },
    });

    if (!gateOperation) {
      throw new NotFoundException('Gate operation tidak ditemukan.');
    }

    if (
      gateOperation.status === 'VERIFIED' ||
      gateOperation.status === 'CANCELED'
    ) {
      throw new BadRequestException(
        'Operasi gerbang sudah final/selesai dan catatan tidak dapat diubah.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Update gate operation verification notes
      await tx.gateOperation.update({
        where: { id: gateOperation.id },
        data: {
          verificationNotes: body.notes !== undefined ? body.notes : undefined,
          verifiedById,
          verifiedAt: new Date(),
        },
      });

      if (body.attachmentPaths !== undefined) {
        // Link new attachments
        if (body.attachmentPaths.length > 0) {
          await tx.fileAttachment.updateMany({
            where: { filePath: { in: body.attachmentPaths } },
            data: { gateOperationId: gateOperation.id },
          });
        }

        // Unlink removed attachments
        await tx.fileAttachment.updateMany({
          where: {
            gateOperationId: gateOperation.id,
            filePath: { notIn: body.attachmentPaths },
          },
          data: { gateOperationId: null },
        });
      }

      const result = await tx.gateOperation.findUnique({
        where: { id: gateOperation.id },
        include: {
          attachments: true,
          verifiedBy: {
            select: { name: true, email: true },
          },
          products: {
            include: {
              inventory: true,
              quant: true,
              location: true,
            },
          },
        },
      });
      return this.mapOperationUrls(result);
    });
  }

  /**
   * Confirm a gate verification manually (VERIFIED status).
   */
  async confirmGateVerification(uuid: string, verifiedById: number) {
    const gateOperation = await this.prisma.gateOperation.findUnique({
      where: { uuid },
      include: {
        products: true,
      },
    });

    if (!gateOperation) {
      throw new NotFoundException('Gate operation tidak ditemukan.');
    }

    if (gateOperation.status === 'VERIFIED') {
      throw new BadRequestException(
        'Operasi gerbang sudah dalam status VERIFIED.',
      );
    }

    if (gateOperation.status === 'CANCELED') {
      throw new BadRequestException('Operasi gerbang sudah dibatalkan.');
    }

    // Enforce all items have location & stack selected before Confirming
    for (const prod of gateOperation.products) {
      if (!prod.locationId || !prod.quantId) {
        throw new BadRequestException(
          `Semua barang muatan harus memiliki lokasi dan tumpukan (stack) yang dipilih sebelum konfirmasi.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.gateOperation.update({
        where: { id: gateOperation.id },
        data: {
          status: 'VERIFIED',
          verifiedById,
          verifiedAt: new Date(),
        },
      });

      // Process stock reduction on confirmation
      await this.processStockReductionOnCompletion(tx, gateOperation.id);

      const result = await tx.gateOperation.findUnique({
        where: { id: gateOperation.id },
        include: {
          attachments: true,
          products: {
            include: {
              inventory: true,
              quant: true,
              location: true,
            },
          },
        },
      });
      return this.mapOperationUrls(result);
    });
  }

  /**
   * Map database file paths to accessible public storage URLs.
   */
  private mapOperationUrls(item: any) {
    if (!item) return null;

    const mapped = { ...item };

    if (mapped.attachments && Array.isArray(mapped.attachments)) {
      mapped.attachments = mapped.attachments.map((attach: any) => ({
        ...attach,
        url: this.storageService.getFilePublicUrl(attach.filePath),
      }));
    }

    return this.stripIdField(mapped);
  }

  private stripIdField(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) {
      return obj.map((item) => this.stripIdField(item));
    }
    if (typeof obj === 'object') {
      // Retain 'id' for Inventory and GateOperationProduct because they are needed as references in the frontend/API
      const isProduct = 'sku' in obj && 'name' in obj;
      const isGateOpProduct = 'gateOperationId' in obj && 'inventoryId' in obj;

      const newObj: any = {};
      for (const key of Object.keys(obj)) {
        if (
          key === 'id' &&
          !isProduct &&
          !isGateOpProduct
        )
          continue;
        newObj[key] = this.stripIdField(obj[key]);
      }
      return newObj;
    }
    return obj;
  }

  private async validateDocumentReferenceLimits(
    tx: any,
    documentReferenceId: number,
    products: { productId: number; quantity: number }[],
    excludeGateOperationId?: number,
  ) {
    for (const prod of products) {
      const docItem = await tx.documentReferenceItem.findFirst({
        where: {
          documentReferenceId,
          inventoryId: prod.productId,
        },
      });

      if (!docItem) {
        throw new BadRequestException(
          `Produk dengan ID ${prod.productId} tidak terdaftar pada dokumen referensi ERP yang dipilih.`,
        );
      }

      const erpQty = docItem.productQty || docItem.quantity || 0;

      // Sum of quantity in OTHER gate operations
      const otherOpsAggregate = await tx.gateOperationProduct.aggregate({
        where: {
          gateOperation: {
            documentReferenceId,
            id: excludeGateOperationId ? { not: excludeGateOperationId } : undefined,
            status: {
              notIn: ['CANCELED', 'REJECTED'],
            },
          },
          inventoryId: prod.productId,
        },
        _sum: {
          quantity: true,
        },
      });

      const otherOpsQty = otherOpsAggregate._sum.quantity || 0;

      // Sum of quantity in the CURRENT gate operation (excluding the prod item if its ID is known, but here we just want other items of the same product)
      let currentOpQty = 0;
      if (excludeGateOperationId) {
        const currentOpProducts = await tx.gateOperationProduct.findMany({
          where: {
            gateOperationId: excludeGateOperationId,
            inventoryId: prod.productId,
          },
        });
        currentOpQty = currentOpProducts.reduce((sum: number, p: any) => sum + p.quantity, 0);
      }

      const totalQty = otherOpsQty + currentOpQty + prod.quantity;

      if (totalQty > erpQty) {
        const remainingQty = Math.max(0, erpQty - otherOpsQty - currentOpQty);
        throw new BadRequestException(
          `Kuantitas barang (${prod.quantity} ${docItem.uom}) melebihi sisa kuantitas pada dokumen ERP untuk ${docItem.productName} (Sisa: ${remainingQty} ${docItem.uom}).`,
        );
      }
    }
  }

  async addCargoItem(
    operationUuid: string,
    body: {
      productId: number;
      quantity: number;
      notes?: string;
      quantId?: number | null;
      locationId?: number | null;
    },
  ) {
    const { productId, quantity, notes, quantId, locationId } = body;
    if (quantity <= 0) {
      throw new BadRequestException('Quantity harus lebih besar dari 0');
    }

    return this.prisma.$transaction(async (tx) => {
      // Find the gate operation
      const gateOperation = await tx.gateOperation.findUnique({
        where: { uuid: operationUuid },
      });

      if (!gateOperation) {
        throw new NotFoundException('Gate operation tidak ditemukan');
      }

      if (
        gateOperation.status === 'VERIFIED' ||
        gateOperation.status === 'CANCELED'
      ) {
        throw new BadRequestException(
          'Operasi gerbang sudah final (VERIFIED/CANCELED) dan tidak dapat diubah.',
        );
      }

      // Check if product exists in Inventory
      const product = await tx.inventory.findUnique({
        where: { id: productId },
      });
      if (!product) {
        throw new NotFoundException('Produk tidak ditemukan');
      }

      // Validate stack/quant quantity limits
      await this.validateStackQuantity(
        tx,
        gateOperation.cardType,
        productId,
        quantity,
        quantId,
        locationId,
      );

      // Validate document reference limits if linked
      if (gateOperation.documentReferenceId) {
        await this.validateDocumentReferenceLimits(
          tx,
          gateOperation.documentReferenceId,
          [{ productId: productId, quantity: quantity }],
          gateOperation.id,
        );
      }

      // Check if product is already added in this gate operation
      const existing = await tx.gateOperationProduct.findFirst({
        where: {
          gateOperationId: gateOperation.id,
          inventoryId: productId,
          quantId: quantId || null,
          locationId: locationId || null,
        },
      });
      if (existing) {
        throw new BadRequestException(
          'Barang muatan dengan tumpukan/lokasi ini sudah terdaftar.',
        );
      }

      // Create GateOperationProduct
      const cargoItem = await tx.gateOperationProduct.create({
        data: {
          gateOperationId: gateOperation.id,
          inventoryId: productId,
          quantity,
          notes: notes || null,
          quantId: quantId || null,
          locationId: locationId || null,
        },
        include: {
          inventory: true,
          quant: true,
          location: true,
        },
      });

      if (quantId && quantId !== null) {
        await this.reserveQuantStock(
          tx,
          gateOperation.cardType,
          quantId,
          quantity,
        );
      }

      // Recalculate status and totals
      await this.updateGateStatusAndRealisasi(tx, gateOperation.id);

      return this.stripIdField(cargoItem);
    });
  }

  async deleteCargoItem(gateOperationProductUuid: string) {
    return this.prisma.$transaction(async (tx) => {
      // Find the cargo item
      const cargoItem = await tx.gateOperationProduct.findUnique({
        where: { uuid: gateOperationProductUuid },
        include: {
          inventory: true,
          gateOperation: true,
        },
      });

      if (!cargoItem) {
        throw new NotFoundException('Barang muatan tidak ditemukan');
      }

      const gateOperation = cargoItem.gateOperation;
      if (
        gateOperation.status === 'VERIFIED' ||
        gateOperation.status === 'CANCELED'
      ) {
        throw new BadRequestException(
          'Operasi gerbang sudah final (VERIFIED/CANCELED) dan tidak dapat diubah.',
        );
      }

      // Delete the cargo item (associated references are deleted via cascade)
      await tx.gateOperationProduct.delete({
        where: { id: cargoItem.id },
      });

      if (cargoItem.quantId) {
        await this.releaseQuantStock(
          tx,
          gateOperation.cardType,
          cargoItem.quantId,
          cargoItem.quantity,
        );
      }

      // Recalculate status and totals
      await this.updateGateStatusAndRealisasi(tx, gateOperation.id);

      return {
        success: true,
        message: 'Barang muatan berhasil dihapus',
        deletedItem: this.stripIdField(cargoItem),
      };
    });
  }

  async updateCargoItem(
    cargoItemUuid: string,
    body: {
      quantId?: number | null;
      locationId?: number | null;
      quantity?: number;
    },
  ) {
    const { quantId, locationId, quantity } = body;

    return this.prisma.$transaction(async (tx) => {
      // Find the cargo item
      const cargoItem = await tx.gateOperationProduct.findUnique({
        where: { uuid: cargoItemUuid },
        include: {
          inventory: true,
          gateOperation: true,
        },
      });

      if (!cargoItem) {
        throw new NotFoundException('Barang muatan tidak ditemukan');
      }

      const gateOperation = cargoItem.gateOperation;
      if (
        gateOperation.status === 'VERIFIED' ||
        gateOperation.status === 'CANCELED'
      ) {
        throw new BadRequestException(
          'Operasi gerbang sudah final (VERIFIED/CANCELED) dan tidak dapat diubah.',
        );
      }

      const targetQuantity =
        quantity !== undefined ? quantity : cargoItem.quantity;

      if (targetQuantity <= 0) {
        throw new BadRequestException('Quantity harus lebih besar dari 0');
      }

      // 1. Release previous stock reservation if there was one
      if (cargoItem.quantId) {
        await this.releaseQuantStock(
          tx,
          gateOperation.cardType,
          cargoItem.quantId,
          cargoItem.quantity,
        );
      }

      // 2. Validate stack/quant quantity limits for new location/quant and quantity
      await this.validateStackQuantity(
        tx,
        gateOperation.cardType,
        cargoItem.inventoryId,
        targetQuantity,
        quantId,
        locationId,
        gateOperation.id,
      );

      // Validate document reference limits if linked
      if (gateOperation.documentReferenceId) {
        const currentOpProducts = await tx.gateOperationProduct.findMany({
          where: {
            gateOperationId: gateOperation.id,
            inventoryId: cargoItem.inventoryId,
            id: { not: cargoItem.id },
          },
        });
        const currentOpOtherQty = currentOpProducts.reduce((sum: number, p: any) => sum + p.quantity, 0);

        const otherOpsAggregate = await tx.gateOperationProduct.aggregate({
          where: {
            gateOperation: {
              documentReferenceId: gateOperation.documentReferenceId,
              id: { not: gateOperation.id },
              status: {
                notIn: ['CANCELED', 'REJECTED'],
              },
            },
            inventoryId: cargoItem.inventoryId,
          },
          _sum: {
            quantity: true,
          },
        });
        const otherOpsQty = otherOpsAggregate._sum.quantity || 0;

        const docItem = await tx.documentReferenceItem.findFirst({
          where: {
            documentReferenceId: gateOperation.documentReferenceId,
            inventoryId: cargoItem.inventoryId,
          },
        });

        if (docItem) {
          const erpQty = docItem.productQty || docItem.quantity || 0;
          const totalQty = otherOpsQty + currentOpOtherQty + targetQuantity;
          if (totalQty > erpQty) {
            const remainingQty = Math.max(0, erpQty - otherOpsQty - currentOpOtherQty);
            throw new BadRequestException(
              `Kuantitas barang (${targetQuantity} ${docItem.uom}) melebihi sisa kuantitas pada dokumen ERP untuk ${docItem.productName} (Sisa: ${remainingQty} ${docItem.uom}).`,
            );
          }
        }
      }

      // 3. Update the cargo item
      const updated = await tx.gateOperationProduct.update({
        where: { id: cargoItem.id },
        data: {
          quantId: quantId || null,
          locationId: locationId || null,
          quantity: targetQuantity,
        },
        include: {
          inventory: true,
          quant: true,
          location: true,
          gateOperation: true,
        },
      });

      // 4. Reserve new stock
      if (quantId && quantId !== null) {
        await this.reserveQuantStock(
          tx,
          gateOperation.cardType,
          quantId,
          targetQuantity,
        );
      }

      // 5. Recalculate status and totals
      await this.updateGateStatusAndRealisasi(tx, gateOperation.id);

      return this.stripIdField(updated);
    });
  }

  private async validateStackQuantity(
    tx: any,
    cardType: CardType,
    productId: number,
    quantity: number,
    quantId?: number | null,
    locationId?: number | null,
    gateOperationId?: number,
  ) {
    if (quantId && quantId !== null) {
      const quant = await tx.quant.findUnique({
        where: { id: quantId },
        include: { location: true },
      });
      if (!quant) {
        throw new BadRequestException('Tumpukan/stack tidak ditemukan.');
      }
      if (quant.inventoryId !== productId) {
        throw new BadRequestException(
          'Produk tidak cocok dengan tumpukan yang dipilih.',
        );
      }
      if (cardType === 'IN') {
        if (quantity > quant.quantity) {
          throw new BadRequestException(
            `Kuantitas muatan (${quantity}) tidak boleh melebihi kapasitas tumpukan ERP (${quant.quantity}).`,
          );
        }
      }
      if (cardType === 'OUT') {
        const warehouseId = quant.location.warehouseId;
        const reconciledStockMap = await getReconciledStockForQuants(
          tx,
          warehouseId,
          productId,
          gateOperationId,
        );
        const totalAvailable = reconciledStockMap.get(quantId) || 0;

        if (quantity > totalAvailable) {
          throw new BadRequestException(
            `Kuantitas (${quantity}) melebihi kuantitas tersedia di tumpukan (tersedia: ${totalAvailable}).`,
          );
        }
      }
      if (locationId && quant.locationId !== locationId) {
        throw new BadRequestException(
          'Lokasi tidak cocok dengan tumpukan yang dipilih.',
        );
      }
    }
  }

  private async reserveQuantStock(
    tx: any,
    cardType: CardType,
    quantId: number,
    qty: number,
  ) {
    // Quant table is read-only for transaction processes.
  }

  private async releaseQuantStock(
    tx: any,
    cardType: CardType,
    quantId: number,
    qty: number,
  ) {
    // Quant table is read-only for transaction processes.
  }

  private async processStockReductionOnCompletion(
    tx: any,
    gateOperationId: number,
  ) {
    // Quant table is read-only for transaction processes.
  }

  async generateDeliveryOrderPdf(idOrUuid: string, userId?: number): Promise<Buffer> {
    const gateOperation = await this.prisma.gateOperation.findFirst({
      where: {
        OR: [
          { uuid: idOrUuid },
          { id: isNaN(Number(idOrUuid)) ? -1 : parseInt(idOrUuid, 10) },
        ],
      },
      include: {
        documentReference: {
          include: { items: true },
        },
        products: {
          include: {
            inventory: true,
            location: true,
            quant: true,
          },
        },
        verifiedBy: {
          include: {
            signatures: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!gateOperation) {
      throw new NotFoundException('Gate operation tidak ditemukan.');
    }

    const appDomain = this.configService.get<string>('FRONTEND_URL');
    const verificationUrl = `${appDomain}/gate-operations/${gateOperation.uuid}`;

    const qrCodeBuffer = await QRCode.toBuffer(verificationUrl, {
      type: 'png',
      width: 150,
      margin: 1,
    });

    let signatureBuffer: Buffer | null = null;
    let verifierName = '........................';
    let activeSig: any = null;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          signatures: {
            where: { isActive: true },
          },
        },
      });
      if (user) {
        verifierName = user.name;
        activeSig = user.signatures?.[0];
      }
    } else if (gateOperation.verifiedBy) {
      verifierName = gateOperation.verifiedBy.name;
      activeSig = gateOperation.verifiedBy.signatures?.[0];
    }

    if (activeSig?.fileKey) {
      try {
        signatureBuffer = await this.storageService.getFileBuffer(activeSig.fileKey);
      } catch (err: any) {
        this.logger.warn(`Failed to fetch user signature image from storage: ${err.message}`);
      }
    }

    const logoBuffer = await this.getLogoBuffer();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Draw Top Header
      // Logo (Left)
      if (logoBuffer) {
        doc.image(logoBuffer, 40, 40, { fit: [70, 40] });
      } else {
        doc.rect(40, 40, 50, 40).fill('#1e3a8a');
        doc
          .fillColor('#ffffff')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('BULOG', 45, 48);
        doc.fontSize(8).text('WMS', 54, 62);
      }

      // Header Text (Center)
      doc
        .fillColor('#1e293b')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('SURAT PENGANTAR / SURAT JALAN', 110, 50, {
          align: 'center',
          width: 380,
        });

      // QR Code (Right)
      doc.image(qrCodeBuffer, 505, 40, { width: 50, height: 50 });

      doc.moveTo(40, 95).lineTo(555, 95).lineWidth(1.5).stroke('#1e3a8a');

      // General Info Section
      doc.fillColor('#334155').fontSize(9).font('Helvetica');
      let currentY = 115;

      const drawInfoRow = (
        label1: string,
        val1: string,
        label2: string,
        val2: string,
      ) => {
        doc.font('Helvetica-Bold');
        const hLabel1 = label1 ? doc.heightOfString(label1, { width: 120 }) : 0;
        const hLabel2 = label2 ? doc.heightOfString(label2, { width: 110 }) : 0;

        doc.font('Helvetica');
        const hVal1 = label1 ? doc.heightOfString(`:  ${val1 || '-'}`, { width: 140 }) : 0;
        const hVal2 = label2 ? doc.heightOfString(`:  ${val2 || '-'}`, { width: 125 }) : 0;

        const rowHeight = Math.max(hLabel1, hLabel2, hVal1, hVal2, 14);

        if (label1) {
          doc
            .font('Helvetica-Bold')
            .fillColor('#64748b')
            .text(label1, 40, currentY, { width: 120 });
          doc
            .font('Helvetica')
            .fillColor('#1e293b')
            .text(`:  ${val1 || '-'}`, 160, currentY, { width: 140 });
        }

        if (label2) {
          doc
            .font('Helvetica-Bold')
            .fillColor('#64748b')
            .text(label2, 320, currentY, { width: 110 });
          doc
            .font('Helvetica')
            .fillColor('#1e293b')
            .text(`:  ${val2 || '-'}`, 430, currentY, { width: 125 });
        }

        currentY += rowHeight + 4;
      };

      const dateStr = new Date(gateOperation.createdAt).toLocaleDateString(
        'id-ID',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        },
      );

      drawInfoRow(
        'No Tiket',
        gateOperation.opNumber,
        'Tujuan / Partner',
        gateOperation.clientPartner ||
          gateOperation.documentReference?.partnerName ||
          '-',
      );
      drawInfoRow('Tanggal', dateStr, 'Nama Driver', gateOperation.driverName);
      drawInfoRow(
        'No. Dokumen Ref',
        gateOperation.documentReference?.origin ||
          gateOperation.documentReference?.documentNumber ||
          '-',
        'Nomor Plat',
        gateOperation.licensePlate,
      );
      drawInfoRow('No. Telp Driver', gateOperation.driverPhone || '-', '', '');

      doc
        .moveTo(40, currentY + 5)
        .lineTo(555, currentY + 5)
        .lineWidth(0.5)
        .stroke('#cbd5e1');
      currentY += 15;

      // Table Header
      doc.fillColor('#f8fafc').rect(40, currentY, 515, 20).fill();
      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold');
      doc.text('No', 45, currentY + 6, { width: 20 });
      doc.text('Nama Produk', 70, currentY + 6, { width: 145 });
      doc.text('SKU', 220, currentY + 6, { width: 65 });
      doc.text('UOM', 290, currentY + 6, { width: 35 });
      doc.text('Jumlah', 330, currentY + 6, { width: 45, align: 'right' });
      doc.text('Location', 380, currentY + 6, { width: 175 });

      currentY += 20;

      // Table Rows
      let totalQty = 0;
      const products = gateOperation.products || [];

      products.forEach((p: any, idx: number) => {
        if (currentY + 25 > 720) {
          doc.addPage();
          currentY = 50;
        }

        const locationName = p.location?.displayName || '-';

        doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica');
        doc.text(String(idx + 1), 45, currentY + 6, { width: 20 });
        doc
          .font('Helvetica-Bold')
          .text(p.inventory?.name || '-', 70, currentY + 6, {
            width: 145,
            ellipsis: true,
          });
        doc
          .font('Helvetica')
          .text(p.inventory?.sku || '-', 220, currentY + 6, {
            width: 65,
            ellipsis: true,
          });
        doc.text(p.inventory?.uom || '-', 290, currentY + 6, { width: 35 });
        doc.text(p.quantity.toLocaleString('id-ID'), 330, currentY + 6, {
          width: 45,
          align: 'right',
        });
        doc.text(locationName, 380, currentY + 6, {
          width: 175,
          ellipsis: true,
        });

        totalQty += p.quantity;

        doc
          .moveTo(40, currentY + 18)
          .lineTo(555, currentY + 18)
          .lineWidth(0.3)
          .stroke('#e2e8f0');
        currentY += 18;
      });

      // Ringkasan Section
      currentY += 10;
      doc.fillColor('#f8fafc').rect(320, currentY, 235, 40).fill();
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold');
      doc.text('Total Jenis Barang', 330, currentY + 8);
      doc.text(`:  ${products.length}`, 430, currentY + 8);

      doc.text('Total Quantity', 330, currentY + 22);
      doc.text(`:  ${totalQty.toLocaleString('id-ID')}`, 430, currentY + 22);

      // Warning Note Section
      currentY += 55;
      if (currentY + 20 > 750) {
        doc.addPage();
        currentY = 50;
      }
      doc
        .fillColor('#ef4444')
        .fontSize(8)
        .font('Helvetica-Oblique')
        .text(
          'Catatan: Barang atau muatan setelah meninggalkan Gudang menjadi tanggung jawab Driver / Penerima.',
          40,
          currentY,
          { width: 515, align: 'center' }
        );

      currentY += 25;

      // Signatures
      if (currentY + 80 > 750) {
        doc.addPage();
        currentY = 50;
      }
      doc.fillColor('#1e293b').fontSize(9).font('Helvetica');
      doc.text('Pengangkut / Driver', 70, currentY, {
        width: 150,
        align: 'center',
      });
      doc.text('Mengetahui', 375, currentY, { width: 150, align: 'center' });

      if (signatureBuffer && activeSig?.fileKey) {
        const fileKeyLower = activeSig.fileKey.toLowerCase();
        if (fileKeyLower.endsWith('.png') || fileKeyLower.endsWith('.jpg') || fileKeyLower.endsWith('.jpeg')) {
          const imageX = 375 + (150 - 100) / 2;
          try {
            doc.image(signatureBuffer, imageX, currentY + 15, { fit: [100, 45] });
          } catch (err: any) {
            this.logger.warn(`Failed to render signature image in PDF: ${err.message}`);
          }
        }
      }

      currentY += 65;
      doc
        .font('Helvetica-Bold')
        .text(`(  ${gateOperation.driverName}  )`, 70, currentY, {
          width: 150,
          align: 'center',
        });

      doc.font('Helvetica-Bold').text(`(  ${verifierName}  )`, 375, currentY, {
        width: 150,
        align: 'center',
      });

      doc.end();
    });
  }

  async generateDeliveryOrderHtml(idOrUuid: string, userId?: number): Promise<string> {
    const gateOperation = await this.prisma.gateOperation.findFirst({
      where: {
        OR: [
          { uuid: idOrUuid },
          { id: isNaN(Number(idOrUuid)) ? -1 : parseInt(idOrUuid, 10) },
        ],
      },
      include: {
        documentReference: {
          include: { items: true },
        },
        products: {
          include: {
            inventory: true,
            location: true,
            quant: true,
          },
        },
        verifiedBy: {
          include: {
            signatures: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!gateOperation) {
      throw new NotFoundException('Gate operation tidak ditemukan.');
    }

    const appDomain = this.configService.get<string>('APP_DOMAIN') || 'localhost:3001';
    const useSSL = this.configService.get<string>('FRONTEND_USE_SSL') === 'true';
    const protocol = useSSL ? 'https' : 'http';
    const verificationUrl = `${protocol}://${appDomain}/gate-operations/${gateOperation.uuid}`;

    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl);
    const logoBuffer = await this.getLogoBuffer();
    const logoUrl = logoBuffer ? `data:image/png;base64,${logoBuffer.toString('base64')}` : null;

    let signatureUrl: string | null = null;
    let verifierName = '........................';
    let activeSig: any = null;

    if (gateOperation.verifiedBy) {
      verifierName = gateOperation.verifiedBy.name;
      activeSig = gateOperation.verifiedBy.signatures?.[0];
    } else if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          signatures: {
            where: { isActive: true },
          },
        },
      });
      if (user) {
        verifierName = user.name;
        activeSig = user.signatures?.[0];
      }
    } 

    if (activeSig?.fileKey) {
      try {
        const sigBuffer = await this.storageService.getFileBuffer(activeSig.fileKey);
        let mimeType = 'image/png';
        if (activeSig.fileKey.toLowerCase().endsWith('.jpg') || activeSig.fileKey.toLowerCase().endsWith('.jpeg')) {
          mimeType = 'image/jpeg';
        } else if (activeSig.fileKey.toLowerCase().endsWith('.svg')) {
          mimeType = 'image/svg+xml';
        }
        signatureUrl = `data:${mimeType};base64,${sigBuffer.toString('base64')}`;
      } catch (err: any) {
        this.logger.warn(`Failed to fetch user signature image for HTML: ${err.message}`);
      }
    }

    const dateStr = new Date(gateOperation.createdAt).toLocaleDateString(
      'id-ID',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      },
    );

    const products = gateOperation.products || [];
    const totalQty = products.reduce((sum, p) => sum + p.quantity, 0);

    const rowsHtml = products
      .map((p, idx) => {
        const locationName = p.location?.displayName || '-';
        return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${p.inventory?.name || '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${p.inventory?.sku || '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${p.inventory?.uom || '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${p.quantity.toLocaleString('id-ID')}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${locationName}</td>
        </tr>
      `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Surat Jalan - ${gateOperation.opNumber}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px double #1e3a8a;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .logo-box-img {
            width: 120px;
            display: flex;
            align-items: center;
            justify-content: flex-start;
          }
          .logo-box {
            background-color: #1e3a8a;
            color: #ffffff;
            font-weight: bold;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            text-align: center;
            line-height: 1.2;
            width: 80px;
          }
          .logo-sub {
            font-size: 10px;
            font-weight: normal;
            display: block;
            letter-spacing: 1px;
          }
          .title {
            font-size: 16px;
            font-weight: bold;
            color: #1e293b;
            text-align: center;
            flex-grow: 1;
          }
          .qr-box {
            text-align: right;
            width: 120px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 25px;
          }
          .info-col table {
            width: 100%;
            border-collapse: collapse;
          }
          .info-col td {
            padding: 4px 0;
            vertical-align: top;
          }
          .info-label {
            font-weight: bold;
            color: #64748b;
            width: 130px;
          }
          .info-value {
            color: #1e293b;
            word-break: break-word;
          }
          .cargo-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .cargo-table th {
            background-color: #f8fafc;
            color: #475569;
            font-weight: bold;
            text-align: left;
            padding: 8px;
            border-bottom: 2px solid #cbd5e1;
            font-size: 11px;
            text-transform: uppercase;
          }
          .summary-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 12px 20px;
            width: 250px;
            margin-left: auto;
            margin-bottom: 40px;
            border-radius: 6px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
          }
          .summary-label {
            font-weight: bold;
            color: #475569;
          }
          .summary-value {
            font-weight: bold;
            color: #1e293b;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 50px;
            padding: 0 40px;
          }
          .signature-box {
            text-align: center;
            width: 180px;
          }
          .signature-space {
            height: 60px;
          }
          .signature-name {
            font-weight: bold;
            border-bottom: 1px solid #1e293b;
            padding-bottom: 2px;
          }
          @media print {
            body {
              font-size: 11px;
            }
            .no-print {
              display: none;
            }
            .container {
              width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="background: #f1f5f9; padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0; margin-bottom: 20px;">
          <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; font-weight: bold; border-radius: 4px; cursor: pointer;">Print Surat Jalan</button>
        </div>
        <div class="container">
          <div class="header">
            <div class="logo-box-img">
              ${
                logoUrl
                  ? `<img src="${logoUrl}" style="height: 40px; max-width: 100%; object-fit: contain;" alt="Logo BULOG" />`
                  : `<div class="logo-box">BULOG<span class="logo-sub">WMS</span></div>`
              }
            </div>
            <div class="title">SURAT PENGANTAR / SURAT JALAN</div>
            <div class="qr-box">
              <img src="${qrCodeDataUrl}" style="width: 55px; height: 55px; display: inline-block;" alt="Verification QR" />
            </div>
          </div>
          
          <div class="info-grid">
            <div class="info-col">
              <table>
                <tr>
                  <td class="info-label">No Tiket</td>
                  <td class="info-value">: ${gateOperation.opNumber}</td>
                </tr>
                <tr>
                  <td class="info-label">Tanggal</td>
                  <td class="info-value">: ${dateStr}</td>
                </tr>
                <tr>
                  <td class="info-label">Nomor Dokumen Referensi</td>
                  <td class="info-value">: ${gateOperation.documentReference?.origin || gateOperation.documentReference?.documentNumber || '-'}</td>
                </tr>
              </table>
            </div>
            <div class="info-col">
              <table>
                <tr>
                  <td class="info-label">Tujuan / Partner</td>
                  <td class="info-value">: ${gateOperation.clientPartner || gateOperation.documentReference?.partnerName || '-'}</td>
                </tr>
                <tr>
                  <td class="info-label">Nama Driver</td>
                  <td class="info-value">: ${gateOperation.driverName}</td>
                </tr>
                <tr>
                  <td class="info-label">Nomor Plat</td>
                  <td class="info-value">: ${gateOperation.licensePlate}</td>
                </tr>
                <tr>
                  <td class="info-label">No. Telp Driver</td>
                  <td class="info-value">: ${gateOperation.driverPhone || '-'}</td>
                </tr>
              </table>
            </div>
          </div>

          <table class="cargo-table">
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">No</th>
                <th>Nama Produk</th>
                <th style="width: 100px;">SKU</th>
                <th style="width: 60px; text-align: center;">UOM</th>
                <th style="width: 100px; text-align: right;">Jumlah Muatan</th>
                <th style="width: 180px;">Location</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="summary-card">
            <div class="summary-row">
              <div class="summary-label">Total Jenis Barang</div>
              <div class="summary-value">${products.length}</div>
            </div>
            <div class="summary-row" style="margin-top: 5px; border-top: 1px solid #cbd5e1; padding-top: 5px;">
              <div class="summary-label">Total Quantity</div>
              <div class="summary-value">${totalQty.toLocaleString('id-ID')}</div>
            </div>
          </div>

          <div style="margin-top: 20px; margin-bottom: 20px; font-style: italic; color: #ef4444; font-size: 10px; text-align: center; border: 1px dashed #fca5a5; padding: 8px; border-radius: 4px; background-color: #fef2f2;">
            Catatan: Barang atau muatan setelah meninggalkan Gudang menjadi tanggung jawab Driver / Penerima.
          </div>

          <div class="signatures">
            <div class="signature-box">
              <div>Pengangkut / Driver</div>
              <div class="signature-space"></div>
              <div class="signature-name">${gateOperation.driverName}</div>
            </div>
            <div class="signature-box">
              <div>Mengetahui</div>
              <div class="signature-space" style="display: flex; align-items: center; justify-content: center; height: 60px;">
                ${
                  signatureUrl
                    ? `<img src="${signatureUrl}" style="max-height: 55px; max-width: 150px; object-fit: contain;" alt="Signature" />`
                    : ''
                }
              </div>
              <div class="signature-name">${verifierName}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private sanitizeVerification(verification: any) {
    if (!verification) return null;
    const mapped = { ...verification };
    if (mapped.attachments && Array.isArray(mapped.attachments)) {
      mapped.attachments = mapped.attachments.map((attach: any) => ({
        ...attach,
        url: this.storageService.getFilePublicUrl(attach.filePath),
      }));
    }
    return this.stripIdField(mapped);
  }

  async getVerificationHistory(operationUuid: string) {
    const gateOperation = await this.prisma.gateOperation.findUnique({
      where: { uuid: operationUuid },
    });

    if (!gateOperation) {
      throw new NotFoundException('Gate operation tidak ditemukan.');
    }

    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'GATE_OPERATION_CREATE',
            'GATE_OPERATION_VERIFY',
            'GATE_OPERATION_CANCEL',
            'GATE_OPERATION_CONFIRM',
            'GATE_OPERATION_ASSIGN_REFERENCES',
            'GATE_OPERATION_UNASSIGN_REFERENCE',
            'GATE_OPERATION_CARGO_ADD',
            'GATE_OPERATION_CARGO_UPDATE',
            'GATE_OPERATION_CARGO_DELETE',
            'GATE_OPERATION_NOTES_ATTACHMENTS_UPDATE',
          ],
        },
        details: {
          contains: operationUuid,
        },
      },
      include: {
        actor: {
          select: { name: true, email: true },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    return logs.map((log) => {
      let parsedDetails = null;
      try {
        parsedDetails = log.details ? JSON.parse(log.details) : null;
      } catch (err) {
        // ignore
      }
      return {
        uuid: log.uuid,
        action: log.action,
        timestamp: log.timestamp,
        actor: log.actor,
        details: parsedDetails,
      };
    });
  }
}

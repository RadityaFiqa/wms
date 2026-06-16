import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import type {
  CreateGateOperationInput,
  CreateGateVerificationInput,
  AssignReferencesInput,
} from '@bulog-wms/schema';
import { CardType, VerificationStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';

@Injectable()
export class GateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseContext: WarehouseContextService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Helper to format double dates/times.
   */
  private getStartAndEndOfToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  /**
   * Helper to generate unique sequential gate operation number.
   * Format: GO-YYYYMMDD-XXXX
   */
  private async generateOpNumber(tx: any, cardType: CardType): Promise<string> {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();

    const lastOp = await tx.gateOperation.findFirst({
      where: { cardType },
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

          if (prod.quantId) {
            await this.reserveQuantStock(
              tx,
              body.cardType as CardType,
              prod.quantId,
              prod.quantity,
            );
          }
        }
      }

      const createdOp = await tx.gateOperation.findUnique({
        where: { id: gateOperation.id },
        include: {
          attachments: true,
          documentReference: {
            include: { items: true },
          },
          products: {
            include: { inventory: true },
          },
          createdByUser: {
            select: { name: true, email: true },
          },
        },
      });
      return this.mapOperationUrls(createdOp);
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
      const createdAtFilter: any = {};
      if (query.startDate) {
        const start = new Date(query.startDate);
        start.setHours(0, 0, 0, 0);
        createdAtFilter.gte = start;
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        createdAtFilter.lte = end;
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
        orderBy: { createdAt: 'desc' },
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
          verification: {
            include: {
              attachments: true,
              verifiedBy: { select: { name: true } },
              products: {
                include: {
                  inventory: true,
                  quant: true,
                  location: true,
                },
              },
            },
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
        verification: {
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
            references: {
              include: {
                erpDocument: true,
                erpDocumentItem: true,
              },
            },
          },
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
          verification: {
            include: {
              products: { include: { inventory: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const docItemsSummary = await Promise.all(
        item.documentReference.items.map(async (docItem) => {
          const aggregate = await this.prisma.gateDocumentReference.aggregate({
            where: {
              erpDocumentItemId: docItem.id,
              gateVerification: {
                gateOperation: {
                  status: { notIn: ['CANCELED', 'REJECTED'] },
                },
              },
            },
            _sum: { assignedQuantity: true },
          });

          const erpQty = docItem.productQty || docItem.quantity || 0;
          const totalRealized = aggregate._sum.assignedQuantity || 0;
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
   * Get available PO/SO reference documents for a product.
   */
  async getAvailableReferences(
    operationUuid: string,
    productId: number,
    gateItemId?: number,
    search?: string,
  ) {
    const gateOperation = await this.prisma.gateOperation.findUnique({
      where: { uuid: operationUuid },
      include: { verification: true },
    });

    if (!gateOperation) {
      throw new NotFoundException('Gate operation tidak ditemukan.');
    }

    const whereCondition: any = {
      warehouseId: gateOperation.warehouseId,
      items: {
        some: {
          inventoryId: productId,
        },
      },
    };

    const andConditions: any[] = [];

    if (gateOperation.cardType === 'IN') {
      andConditions.push({
        pickingTypeCode: 'incoming',
      });
    } else {
      andConditions.push({
        OR: [
          { pickingTypeCode: 'outgoing' },
          {
            pickingTypeCode: 'internal',
            origin: {
              startsWith: 'CT',
            },
          },
        ],
      });
    }

    if (search) {
      andConditions.push({
        origin: {
          contains: search,
          mode: 'insensitive',
        },
      });
    }

    if (andConditions.length > 0) {
      whereCondition.AND = andConditions;
    }

    // Find all DocumentReference records for this warehouse and pickingType
    // that contain this product (mapped to inventoryId)
    const documents = await this.prisma.documentReference.findMany({
      where: whereCondition,
      include: {
        items: {
          where: {
            inventoryId: productId,
          },
        },
      },
      orderBy: [
        { scheduledDate: 'desc' },
        { id: 'desc' },
      ],
    });

    // Compute remaining quantities and current assigned quantities
    const results: any[] = [];
    for (const doc of documents) {
      for (const item of doc.items) {
        // 1. Sum up assigned quantities for this document item by other verifications (excluding canceled/rejected ones)
        const otherAssignments =
          await this.prisma.gateDocumentReference.aggregate({
            where: {
              erpDocumentItemId: item.id,
              gateVerification: {
                gateOperationId: {
                  not: gateOperation.id,
                },
                gateOperation: {
                  status: {
                    notIn: ['CANCELED', 'REJECTED'],
                  },
                },
              },
            },
            _sum: {
              assignedQuantity: true,
            },
          });

        const usedQty = otherAssignments._sum.assignedQuantity || 0;
        const remainingQty = Math.max(0, item.quantity - usedQty);

        // 2. Get current assigned quantity for this item in this gate operation
        let currentAssignedQty = 0;
        if (gateOperation.verification && gateItemId) {
          const currentAssignment =
            await this.prisma.gateDocumentReference.findFirst({
              where: {
                gateVerificationId: gateOperation.verification.id,
                gateItemId,
                erpDocumentItemId: item.id,
              },
            });
          currentAssignedQty = currentAssignment?.assignedQuantity || 0;
        }

        results.push({
          erpDocumentId: doc.id,
          erpDocumentItemId: item.id,
          documentNumber: doc.documentNumber,
          scheduledDate: doc.scheduledDate,
          partnerName: doc.partnerName || doc.purchaseName || 'Tanpa Partner',
          productName: item.productName,
          totalQty: item.quantity,
          remainingQty,
          currentAssignedQty,
        });
      }
    }

    return results;
  }

  /**
   * Assign ERP PO/SO item references to a gate cargo item.
   */
  async assignReferences(
    operationUuid: string,
    userId: number,
    userName: string,
    body: AssignReferencesInput,
  ) {
    const gateOperation = await this.prisma.gateOperation.findUnique({
      where: { uuid: operationUuid },
      include: { verification: true },
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

    // Verify that the gateItemId exists and belongs to this gate operation
    const gateItem = await this.prisma.gateOperationProduct.findFirst({
      where: {
        id: body.gateItemId,
        gateOperationId: gateOperation.id,
      },
    });

    if (!gateItem) {
      throw new BadRequestException('Item Gate Operation tidak ditemukan.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Ensure GateVerification record exists
      let verification = gateOperation.verification;
      if (!verification) {
        verification = await tx.gateVerification.create({
          data: {
            gateOperationId: gateOperation.id,
            verifiedById: userId,
            status: 'PENDING',
            notes: 'Assignment referensi ERP',
          },
        });
      }

      // 2. Validate assignments and check remaining quantities
      for (const assign of body.assignments) {
        const docItem = await tx.documentReferenceItem.findUnique({
          where: { id: assign.erpDocumentItemId },
          include: { documentReference: true },
        });

        if (!docItem) {
          throw new BadRequestException(
            `Item Dokumen ERP dengan ID ${assign.erpDocumentItemId} tidak ditemukan.`,
          );
        }

        // Validate inventoryId matching
        if (docItem.inventoryId !== gateItem.inventoryId) {
          throw new BadRequestException(
            `Produk ${docItem.productName} tidak cocok dengan item Gate Operation.`,
          );
        }

        // Compute remaining quantity (excluding current verification, and ignoring CANCELED/REJECTED operations)
        const otherAssignments = await tx.gateDocumentReference.aggregate({
          where: {
            erpDocumentItemId: assign.erpDocumentItemId,
            gateVerificationId: {
              not: verification.id,
            },
            gateVerification: {
              gateOperation: {
                status: {
                  notIn: ['CANCELED', 'REJECTED'],
                },
              },
            },
          },
          _sum: {
            assignedQuantity: true,
          },
        });

        const usedQty = otherAssignments._sum.assignedQuantity || 0;
        const remainingQty = Math.max(0, docItem.quantity - usedQty);

        if (assign.assignedQuantity > remainingQty) {
          throw new BadRequestException(
            `Kuantitas assignment (${assign.assignedQuantity}) melebihi kuantitas tersisa di dokumen ${docItem.documentReference.documentNumber} (${remainingQty}).`,
          );
        }
      }

      // 3. Clear existing assignments for this gateItemId
      await tx.gateDocumentReference.deleteMany({
        where: {
          gateVerificationId: verification.id,
          gateItemId: body.gateItemId,
        },
      });

      // 4. Create new assignments
      for (const assign of body.assignments) {
        const docItem = await tx.documentReferenceItem.findUnique({
          where: { id: assign.erpDocumentItemId },
        });

        if (!docItem) {
          throw new BadRequestException(
            `Item Dokumen ERP dengan ID ${assign.erpDocumentItemId} tidak ditemukan.`,
          );
        }

        await tx.gateDocumentReference.create({
          data: {
            gateVerificationId: verification.id,
            gateItemId: body.gateItemId,
            erpDocumentId: docItem.documentReferenceId,
            erpDocumentItemId: assign.erpDocumentItemId,
            inventoryId: gateItem.inventoryId,
            assignedQuantity: assign.assignedQuantity,
            createdBy: userName,
          },
        });
      }

      // 5. Update Status and Realisasi quantity for Gate Verification
      await this.updateGateStatusAndRealisasi(
        tx,
        gateOperation.id,
        verification.id,
      );

      // Return the updated verification details
      const result = await tx.gateVerification.findUnique({
        where: { id: verification.id },
        include: {
          attachments: true,
          references: {
            include: {
              erpDocument: true,
              erpDocumentItem: true,
            },
          },
        },
      });
      return this.sanitizeVerification(result);
    });
  }

  /**
   * Unassign an ERP PO/SO item reference from a gate cargo item.
   */
  async unassignReference(
    referenceUuid: string,
    userId: number,
    userName: string,
  ) {
    const docRef = await this.prisma.gateDocumentReference.findUnique({
      where: { uuid: referenceUuid },
      include: {
        gateVerification: {
          include: {
            gateOperation: true,
          },
        },
        erpDocument: true,
      },
    });

    if (!docRef) {
      throw new NotFoundException('Referensi dokumen tidak ditemukan.');
    }

    const gateOperation = docRef.gateVerification.gateOperation;
    if (
      gateOperation.status === 'VERIFIED' ||
      gateOperation.status === 'CANCELED'
    ) {
      throw new BadRequestException(
        'Operasi gerbang sudah final (VERIFIED/CANCELED) dan tidak dapat diubah.',
      );
    }

    const gateOperationId = docRef.gateVerification.gateOperationId;
    const verificationId = docRef.gateVerificationId;
    const documentNumber = docRef.erpDocument.documentNumber;

    await this.prisma.$transaction(async (tx) => {
      // Delete the reference assignment
      await tx.gateDocumentReference.delete({
        where: { id: docRef.id },
      });

      // Recalculate status and realisasi quantity
      await this.updateGateStatusAndRealisasi(
        tx,
        gateOperationId,
        verificationId,
      );
    });

    return {
      success: true,
      message: 'Referensi ERP berhasil dilepas.',
      auditDetails: {
        previousReference: documentNumber,
        unassignedBy: userName,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Helper to recalculate GateOperation and GateVerification status and synchronization properties.
   */
  private async updateGateStatusAndRealisasi(
    tx: any,
    gateOperationId: number,
    verificationId: number,
  ) {
    const gateOperation = await tx.gateOperation.findUnique({
      where: { id: gateOperationId },
    });

    if (!gateOperation) return;

    // 1. Get all Gate Operation Products
    const operationProducts = await tx.gateOperationProduct.findMany({
      where: { gateOperationId },
    });

    // 2. Sum up gate operation products total quantity
    const totalGateQty = operationProducts.reduce(
      (sum: number, p: any) => sum + p.quantity,
      0,
    );

    // 3. Get all references assigned for this verification
    const references = await tx.gateDocumentReference.findMany({
      where: { gateVerificationId: verificationId },
      include: { erpDocument: true },
    });

    // 4. Sum up total assigned quantity
    const totalAssignedQty = references.reduce(
      (sum: number, r: any) => sum + r.assignedQuantity,
      0,
    );

    // 5. Determine new status
    let newStatus: VerificationStatus = 'PENDING';
    if (totalAssignedQty > 0) {
      if (totalAssignedQty >= totalGateQty) {
        newStatus = 'COMPLETED';
      } else {
        newStatus = 'PARTIAL';
      }
    }

    // Update list of unique PO/SO numbers
    const docNumbers = Array.from(
      new Set(references.map((r: any) => r.erpDocument.documentNumber)),
    );

    const prevVerification = await tx.gateVerification.findUnique({
      where: { id: verificationId },
      select: { status: true },
    });

    const verificationData: any = {
      status: newStatus,
    };

    if (newStatus === 'COMPLETED' && prevVerification?.status !== 'COMPLETED') {
      verificationData.verifiedAt = new Date();
    }

    // Update GateOperation and GateVerification status
    await tx.gateOperation.update({
      where: { id: gateOperationId },
      data: {
        status: newStatus,
        poReferences: gateOperation.cardType === 'IN' ? docNumbers : [],
        soReferences: gateOperation.cardType === 'OUT' ? docNumbers : [],
      },
    });

    await tx.gateVerification.update({
      where: { id: verificationId },
      data: verificationData,
    });

    // Synchronize GateVerificationProduct for backward compatibility
    const existingProds = await tx.gateVerificationProduct.findMany({
      where: { gateVerificationId: verificationId },
    });

    await tx.gateVerificationProduct.deleteMany({
      where: { gateVerificationId: verificationId },
    });

    const productAssignedTotals = new Map<number, number>();
    for (const ref of references) {
      const current = productAssignedTotals.get(ref.inventoryId) || 0;
      productAssignedTotals.set(
        ref.inventoryId,
        current + ref.assignedQuantity,
      );
    }

    for (const [inventoryId, quantity] of productAssignedTotals.entries()) {
      const existingMatch = existingProds.find(
        (p: any) => p.inventoryId === inventoryId,
      );
      await tx.gateVerificationProduct.create({
        data: {
          gateVerificationId: verificationId,
          inventoryId,
          quantity,
          quantId: existingMatch?.quantId || null,
          locationId: existingMatch?.locationId || null,
        },
      });
    }
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
      include: { verification: true },
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
      // Create or update Gate Verification
      let verification = gateOperation.verification;

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
              const otherAssignments = await tx.gateDocumentReference.aggregate(
                {
                  where: {
                    erpDocumentItemId: docItem.id,
                    gateVerification: {
                      gateOperationId: { not: gateOperation.id },
                      gateOperation: {
                        status: { notIn: ['CANCELED', 'REJECTED'] },
                      },
                    },
                  },
                  _sum: { assignedQuantity: true },
                },
              );
              const otherUsed = otherAssignments._sum.assignedQuantity || 0;

              const currentUsed = 0; // we don't have new verification record ID yet, or if verification exists we check existing references
              let currentAssigned = 0;
              if (verification) {
                const currentAssignment =
                  await tx.gateDocumentReference.aggregate({
                    where: {
                      gateVerificationId: verification.id,
                      inventoryId: gp.inventoryId,
                    },
                    _sum: { assignedQuantity: true },
                  });
                currentAssigned = currentAssignment._sum.assignedQuantity || 0;
              }

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

      if (!verification) {
        verification = await tx.gateVerification.create({
          data: {
            gateOperationId: gateOperation.id,
            verifiedById,
            status: 'PENDING',
            notes: body.notes,
          },
        });
      } else {
        verification = await tx.gateVerification.update({
          where: { id: verification.id },
          data: {
            verifiedById,
            notes: body.notes,
          },
        });
      }

      // Update attachments for verification
      await tx.fileAttachment.updateMany({
        where: { gateVerificationId: verification.id },
        data: { gateVerificationId: null },
      });

      if (body.attachmentPaths && body.attachmentPaths.length > 0) {
        await tx.fileAttachment.updateMany({
          where: { filePath: { in: body.attachmentPaths } },
          data: { gateVerificationId: verification.id },
        });
      }

      // Recalculate status and references list based on current references table
      await this.updateGateStatusAndRealisasi(
        tx,
        gateOperation.id,
        verification.id,
      );

      // Save verification products details with quantId/locationId
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
        }

        await tx.gateVerificationProduct.deleteMany({
          where: { gateVerificationId: verification.id },
        });

        for (const prod of body.products) {
          await tx.gateVerificationProduct.create({
            data: {
              gateVerificationId: verification.id,
              inventoryId: prod.productId,
              quantity: prod.quantity,
              quantId: prod.quantId || null,
              locationId: prod.locationId || null,
            },
          });
        }
      }

      const result = await tx.gateVerification.findUnique({
        where: { id: verification.id },
        include: {
          attachments: true,
          products: {
            include: {
              inventory: true,
              quant: true,
              location: true,
            },
          },
          references: {
            include: {
              erpDocument: true,
              erpDocumentItem: true,
            },
          },
        },
      });
      return this.sanitizeVerification(result);
    });
  }

  /**
   * Cancel a gate verification manually.
   */
  async cancelGateVerification(uuid: string, verifiedById: number) {
    const gateOperation = await this.prisma.gateOperation.findUnique({
      where: { uuid },
      include: {
        verification: true,
        products: true,
      },
    });

    if (!gateOperation) {
      throw new NotFoundException('Gate operation tidak ditemukan.');
    }

    return this.prisma.$transaction(async (tx) => {
      let verification = gateOperation.verification;

      if (!verification) {
        verification = await tx.gateVerification.create({
          data: {
            gateOperationId: gateOperation.id,
            verifiedById,
            status: 'CANCELED',
            notes: 'Dibatalkan oleh Admin',
          },
        });
      } else {
        verification = await tx.gateVerification.update({
          where: { id: verification.id },
          data: {
            verifiedById,
            status: 'CANCELED',
            notes: verification.notes
              ? `${verification.notes} (Dibatalkan)`
              : 'Dibatalkan',
          },
        });
      }

      const prevStatus = gateOperation.status;

      await tx.gateOperation.update({
        where: { id: gateOperation.id },
        data: {
          status: 'CANCELED',
        },
      });

      // Release Reservations
      if (
        prevStatus !== 'CANCELED' &&
        prevStatus !== 'COMPLETED' &&
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

      const result = await tx.gateVerification.findUnique({
        where: { id: verification.id },
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
      return this.sanitizeVerification(result);
    });
  }

  /**
   * Confirm a gate verification manually (VERIFIED status).
   */
  async confirmGateVerification(uuid: string, verifiedById: number) {
    const gateOperation = await this.prisma.gateOperation.findUnique({
      where: { uuid },
      include: {
        verification: true,
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

    return this.prisma.$transaction(async (tx) => {
      let verification = gateOperation.verification;

      if (!verification) {
        verification = await tx.gateVerification.create({
          data: {
            gateOperationId: gateOperation.id,
            verifiedById,
            status: 'VERIFIED',
            notes: 'Dikonfirmasi oleh Auditor',
            verifiedAt: new Date(),
          },
        });
      } else {
        verification = await tx.gateVerification.update({
          where: { id: verification.id },
          data: {
            verifiedById,
            status: 'VERIFIED',
            notes: verification.notes
              ? `${verification.notes} (Diverifikasi)`
              : 'Diverifikasi',
            verifiedAt: new Date(),
          },
        });
      }

      await tx.gateOperation.update({
        where: { id: gateOperation.id },
        data: {
          status: 'VERIFIED',
        },
      });

      // Process stock reduction on confirmation
      await this.processStockReductionOnCompletion(tx, gateOperation.id);

      const result = await tx.gateVerification.findUnique({
        where: { id: verification.id },
        include: {
          attachments: true,
          products: {
            include: {
              inventory: true,
              quant: true,
              location: true,
            },
          },
          references: {
            include: {
              erpDocument: true,
              erpDocumentItem: true,
            },
          },
        },
      });
      return this.sanitizeVerification(result);
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

    if (mapped.verification) {
      if (
        mapped.verification.attachments &&
        Array.isArray(mapped.verification.attachments)
      ) {
        mapped.verification.attachments = mapped.verification.attachments.map(
          (attach: any) => ({
            ...attach,
            url: this.storageService.getFilePublicUrl(attach.filePath),
          }),
        );
      }
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
      // Retain 'id' for Inventory, GateOperationProduct, and GateVerificationProduct because they are needed as references in the frontend/API
      const isProduct = 'sku' in obj && 'name' in obj;
      const isGateOpProduct = 'gateOperationId' in obj && 'inventoryId' in obj;
      const isGateVerificationProduct =
        'gateVerificationId' in obj && 'inventoryId' in obj;

      const newObj: any = {};
      for (const key of Object.keys(obj)) {
        if (
          key === 'id' &&
          !isProduct &&
          !isGateOpProduct &&
          !isGateVerificationProduct
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

      const aggregate = await tx.gateOperationProduct.aggregate({
        where: {
          gateOperation: {
            documentReferenceId,
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

      const usedQty = aggregate._sum.quantity || 0;
      const remainingQty = Math.max(0, docItem.quantity - usedQty);

      if (prod.quantity > remainingQty) {
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
        include: { verification: true },
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

      if (quantId) {
        await this.reserveQuantStock(
          tx,
          gateOperation.cardType,
          quantId,
          quantity,
        );
      }

      // If verification exists, update verification status/totals
      if (gateOperation.verification) {
        await this.updateGateStatusAndRealisasi(
          tx,
          gateOperation.id,
          gateOperation.verification.id,
        );
      }

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
          gateOperation: {
            include: { verification: true },
          },
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

      // If verification exists, update verification status/totals
      if (gateOperation.verification) {
        await this.updateGateStatusAndRealisasi(
          tx,
          gateOperation.id,
          gateOperation.verification.id,
        );
      }

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
          gateOperation: {
            include: { verification: true },
          },
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
        },
      });

      // 4. Reserve new stock
      if (quantId) {
        await this.reserveQuantStock(
          tx,
          gateOperation.cardType,
          quantId,
          targetQuantity,
        );
      }

      // 5. If verification exists, update verification status/totals
      if (gateOperation.verification) {
        await this.updateGateStatusAndRealisasi(
          tx,
          gateOperation.id,
          gateOperation.verification.id,
        );
      }

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
    if (quantId) {
      const quant = await tx.quant.findUnique({
        where: { id: quantId },
      });
      if (!quant) {
        throw new BadRequestException('Tumpukan/stack tidak ditemukan.');
      }
      if (quant.inventoryId !== productId) {
        throw new BadRequestException(
          'Produk tidak cocok dengan tumpukan yang dipilih.',
        );
      }
      if (cardType === 'OUT') {
        let reservedByThisOp = 0;
        if (gateOperationId) {
          const existingProduct = await tx.gateOperationProduct.findFirst({
            where: {
              gateOperationId,
              quantId,
              inventoryId: productId,
            },
          });
          reservedByThisOp = existingProduct ? existingProduct.quantity : 0;
        }
        const totalAvailable = quant.availableQuantity + reservedByThisOp;
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
    if (cardType !== 'OUT') return;

    const quant = await tx.quant.findUnique({
      where: { id: quantId },
    });
    if (!quant) {
      throw new NotFoundException(
        `Tumpukan dengan ID ${quantId} tidak ditemukan.`,
      );
    }

    const newReserved = quant.reservedQuantity + qty;
    const newAvailable = quant.quantity - newReserved;

    if (newAvailable < 0) {
      throw new BadRequestException(
        `Kuantitas tidak mencukupi untuk dialokasikan. (Tersedia: ${quant.availableQuantity}, Dibutuhkan: ${qty})`,
      );
    }

    await tx.quant.update({
      where: { id: quantId },
      data: {
        reservedQuantity: newReserved,
        availableQuantity: newAvailable,
      },
    });
  }

  private async releaseQuantStock(
    tx: any,
    cardType: CardType,
    quantId: number,
    qty: number,
  ) {
    if (cardType !== 'OUT') return;

    const quant = await tx.quant.findUnique({
      where: { id: quantId },
    });
    if (!quant) return; // Quant might have been deleted, ignore

    const newReserved = Math.max(0, quant.reservedQuantity - qty);
    const newAvailable = quant.quantity - newReserved;

    await tx.quant.update({
      where: { id: quantId },
      data: {
        reservedQuantity: newReserved,
        availableQuantity: newAvailable,
      },
    });
  }

  private async processStockReductionOnCompletion(
    tx: any,
    gateOperationId: number,
  ) {
    const gateOperation = await tx.gateOperation.findUnique({
      where: { id: gateOperationId },
      include: {
        products: true,
      },
    });

    if (!gateOperation || gateOperation.cardType !== 'OUT') {
      return;
    }

    for (const p of gateOperation.products) {
      if (p.quantId) {
        const quant = await tx.quant.findUnique({
          where: { id: p.quantId },
        });

        if (quant) {
          const newQuantity = Math.max(0, quant.quantity - p.quantity);
          const newReserved = Math.max(0, quant.reservedQuantity - p.quantity);
          const newAvailable = newQuantity - newReserved;

          await tx.quant.update({
            where: { id: p.quantId },
            data: {
              quantity: newQuantity,
              reservedQuantity: newReserved,
              availableQuantity: newAvailable,
            },
          });
        }
      }
    }
  }

  async generateDeliveryOrderPdf(idOrUuid: string): Promise<Buffer> {
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
      },
    });

    if (!gateOperation) {
      throw new NotFoundException('Gate operation tidak ditemukan.');
    }

    const appDomain = this.configService.get<string>('APP_DOMAIN') || 'localhost:3001';
    const useSSL = this.configService.get<string>('FRONTEND_USE_SSL') === 'true';
    const protocol = useSSL ? 'https' : 'http';
    const verificationUrl = `${protocol}://${appDomain}/gate-operations/${gateOperation.uuid}`;

    const qrCodeBuffer = await QRCode.toBuffer(verificationUrl, {
      type: 'png',
      width: 150,
      margin: 1,
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Draw Top Header
      // Logo (Left)
      doc.rect(40, 40, 50, 40).fill('#1e3a8a');
      doc
        .fillColor('#ffffff')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('BULOG', 45, 48);
      doc.fontSize(8).text('WMS', 54, 62);

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
        doc
          .font('Helvetica-Bold')
          .fillColor('#64748b')
          .text(label1, 40, currentY, { width: 120 });
        doc
          .font('Helvetica')
          .fillColor('#1e293b')
          .text(`:  ${val1 || '-'}`, 160, currentY, { width: 140 });

        doc
          .font('Helvetica-Bold')
          .fillColor('#64748b')
          .text(label2, 320, currentY, { width: 110 });
        doc
          .font('Helvetica')
          .fillColor('#1e293b')
          .text(`:  ${val2 || '-'}`, 430, currentY, { width: 125 });

        currentY += 18;
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
      if (currentY + 60 > 750) {
        doc.addPage();
        currentY = 50;
      }
      doc.fillColor('#1e293b').fontSize(9).font('Helvetica');
      doc.text('Pengangkut / Driver', 70, currentY, {
        width: 150,
        align: 'center',
      });
      doc.text('Kepala Gudang', 375, currentY, { width: 150, align: 'center' });

      currentY += 50;
      doc
        .font('Helvetica-Bold')
        .text(`(  ${gateOperation.driverName}  )`, 70, currentY, {
          width: 150,
          align: 'center',
        });
      doc.text('(  ........................  )', 375, currentY, {
        width: 150,
        align: 'center',
      });

      doc.end();
    });
  }

  async generateDeliveryOrderHtml(idOrUuid: string): Promise<string> {
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
            width: 80px;
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
            <div class="logo-box">
              BULOG
              <span class="logo-sub">WMS</span>
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
              <div>Kepala Gudang</div>
              <div class="signature-space"></div>
              <div class="signature-name">&nbsp;</div>
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
}

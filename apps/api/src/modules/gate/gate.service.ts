import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import { StorageService } from '../storage/storage.service';
import type { CreateGateOperationInput, CreateGateVerificationInput, AssignReferencesInput } from '@bulog-wms/schema';
import { CardType, VerificationStatus } from '@prisma/client';

@Injectable()
export class GateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseContext: WarehouseContextService,
    private readonly storageService: StorageService,
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
  private async generateOpNumber(tx: any): Promise<string> {
    const today = new Date();
    const YYYY = today.getFullYear();
    const MM = String(today.getMonth() + 1).padStart(2, '0');
    const DD = String(today.getDate()).padStart(2, '0');
    const dateStr = `${YYYY}${MM}${DD}`;

    const { start, end } = this.getStartAndEndOfToday();

    const count = await tx.gateOperation.count({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });

    const nextSeq = String(count + 1).padStart(4, '0');
    return `GO-${dateStr}-${nextSeq}`;
  }

  /**
   * Create a new gate operation.
   */
  async createGateOperation(createdByUserId: number, body: CreateGateOperationInput) {
    const warehouseId = this.warehouseContext.getWarehouseId();
    if (!warehouseId) {
      throw new BadRequestException('Konteks warehouse (header x-warehouse-id) diperlukan.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Generate sequential number
      const opNumber = await this.generateOpNumber(tx);

      // 2. Create Gate Operation
      const gateOperation = await tx.gateOperation.create({
        data: {
          opNumber,
          cardType: body.cardType as CardType,
          driverName: body.driverName,
          licensePlate: body.licensePlate.toUpperCase(),
          notes: body.notes,
          status: 'PENDING',
          warehouseId,
          createdByUserId,
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
          await tx.gateOperationProduct.create({
            data: {
              gateOperationId: gateOperation.id,
              productId: prod.productId,
              quantity: prod.quantity,
            },
          });
        }
      }

      return this.mapOperationUrls(
        await tx.gateOperation.findUnique({
          where: { id: gateOperation.id },
          include: {
            attachments: true,
            products: {
              include: { product: true },
            },
            createdByUser: {
              select: { name: true, email: true },
            },
          },
        }),
      );
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
      throw new BadRequestException('Konteks warehouse (header x-warehouse-id) diperlukan.');
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      warehouseId,
    };

    if (query.startDate || query.endDate) {
      const verifiedAtFilter: any = {};
      if (query.startDate) {
        const start = new Date(query.startDate);
        start.setHours(0, 0, 0, 0);
        verifiedAtFilter.gte = start;
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        verifiedAtFilter.lte = end;
      }
      where.verification = {
        verifiedAt: verifiedAtFilter,
      };
    }

    if (query.search) {
      where.OR = [
        { opNumber: { contains: query.search, mode: 'insensitive' } },
        { driverName: { contains: query.search, mode: 'insensitive' } },
        { licensePlate: { contains: query.search, mode: 'insensitive' } },
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
          products: {
            include: { product: true },
          },
          createdByUser: {
            select: { name: true, email: true },
          },
          verification: {
            include: {
              attachments: true,
              verifiedBy: { select: { name: true } },
              products: {
                include: { product: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: items.map((item) => this.mapOperationUrls(item)),
    };
  }

  /**
   * Get single gate operation details.
   */
  /**
   * Get single gate operation details.
   */
  async getGateOperationByUuid(uuid: string) {
    const item = await this.prisma.gateOperation.findUnique({
      where: { uuid },
      include: {
        attachments: true,
        createdByUser: {
          select: { name: true, email: true },
        },
        products: {
          include: { product: true },
        },
        verification: {
          include: {
            attachments: true,
            verifiedBy: {
              select: { name: true, email: true },
            },
            products: {
              include: { product: true },
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

    return this.mapOperationUrls(item);
  }

  /**
   * Get available PO/SO reference documents for a product.
   */
  async getAvailableReferences(
    operationUuid: string,
    productId: number,
    gateItemId?: number,
  ) {
    const gateOperation = await this.prisma.gateOperation.findUnique({
      where: { uuid: operationUuid },
      include: { verification: true },
    });

    if (!gateOperation) {
      throw new NotFoundException('Gate operation tidak ditemukan.');
    }

    const pickingTypeCode = gateOperation.cardType === 'IN' ? 'incoming' : 'outgoing';

    // Find all DocumentReference records for this warehouse and pickingType
    // that contain this product
    const documents = await this.prisma.documentReference.findMany({
      where: {
        warehouseId: gateOperation.warehouseId,
        pickingTypeCode,
        items: {
          some: {
            productId,
          },
        },
      },
      include: {
        items: {
          where: {
            productId,
          },
        },
      },
      orderBy: {
        scheduledDate: 'desc',
      },
    });

    // Compute remaining quantities and current assigned quantities
    const results: any[] = [];
    for (const doc of documents) {
      for (const item of doc.items) {
        // 1. Sum up assigned quantities for this document item by other verifications
        const otherAssignments = await this.prisma.gateDocumentReference.aggregate({
          where: {
            erpDocumentItemId: item.id,
            gateVerification: {
              gateOperationId: {
                not: gateOperation.id,
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
          const currentAssignment = await this.prisma.gateDocumentReference.findFirst({
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
          throw new BadRequestException(`Item Dokumen ERP dengan ID ${assign.erpDocumentItemId} tidak ditemukan.`);
        }

        // Validate product_id matching
        if (docItem.productId !== gateItem.productId) {
          throw new BadRequestException(
            `Produk ${docItem.productName} tidak cocok dengan item Gate Operation.`,
          );
        }

        // Compute remaining quantity (excluding current verification)
        const otherAssignments = await tx.gateDocumentReference.aggregate({
          where: {
            erpDocumentItemId: assign.erpDocumentItemId,
            gateVerificationId: {
              not: verification.id,
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
          throw new BadRequestException(`Item Dokumen ERP dengan ID ${assign.erpDocumentItemId} tidak ditemukan.`);
        }

        await tx.gateDocumentReference.create({
          data: {
            gateVerificationId: verification.id,
            gateItemId: body.gateItemId,
            erpDocumentId: docItem.documentReferenceId,
            erpDocumentItemId: assign.erpDocumentItemId,
            productId: gateItem.productId,
            assignedQuantity: assign.assignedQuantity,
            createdBy: userName,
          },
        });
      }

      // 5. Update Status and Realisasi quantity for Gate Verification
      await this.updateGateStatusAndRealisasi(tx, gateOperation.id, verification.id);

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
  async unassignReference(referenceUuid: string, userId: number, userName: string) {
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

    const gateOperationId = docRef.gateVerification.gateOperationId;
    const verificationId = docRef.gateVerificationId;
    const documentNumber = docRef.erpDocument.documentNumber;

    await this.prisma.$transaction(async (tx) => {
      // Delete the reference assignment
      await tx.gateDocumentReference.delete({
        where: { id: docRef.id },
      });

      // Recalculate status and realisasi quantity
      await this.updateGateStatusAndRealisasi(tx, gateOperationId, verificationId);
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
    const totalGateQty = operationProducts.reduce((sum: number, p: any) => sum + p.quantity, 0);

    // 3. Get all references assigned for this verification
    const references = await tx.gateDocumentReference.findMany({
      where: { gateVerificationId: verificationId },
      include: { erpDocument: true },
    });

    // 4. Sum up total assigned quantity
    const totalAssignedQty = references.reduce((sum: number, r: any) => sum + r.assignedQuantity, 0);

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
    const docNumbers = Array.from(new Set(references.map((r: any) => r.erpDocument.documentNumber)));

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
    await tx.gateVerificationProduct.deleteMany({
      where: { gateVerificationId: verificationId },
    });

    const productAssignedTotals = new Map<number, number>();
    for (const ref of references) {
      const current = productAssignedTotals.get(ref.productId) || 0;
      productAssignedTotals.set(ref.productId, current + ref.assignedQuantity);
    }

    for (const [productId, quantity] of productAssignedTotals.entries()) {
      await tx.gateVerificationProduct.create({
        data: {
          gateVerificationId: verificationId,
          productId,
          quantity,
        },
      });
    }
  }

  /**
   * Verify/Audit a gate operation.
   */
  async verifyGateOperation(uuid: string, verifiedById: number, body: CreateGateVerificationInput) {
    const gateOperation = await this.prisma.gateOperation.findUnique({
      where: { uuid },
      include: { verification: true },
    });

    if (!gateOperation) {
      throw new NotFoundException('Gate operation tidak ditemukan.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Create or update Gate Verification
      let verification = gateOperation.verification;

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
      await this.updateGateStatusAndRealisasi(tx, gateOperation.id, verification.id);

      const result = await tx.gateVerification.findUnique({
        where: { id: verification.id },
        include: {
          attachments: true,
          products: {
            include: { product: true },
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
      include: { verification: true },
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
            notes: verification.notes ? `${verification.notes} (Dibatalkan)` : 'Dibatalkan',
          },
        });
      }

      await tx.gateOperation.update({
        where: { id: gateOperation.id },
        data: {
          status: 'CANCELED',
        },
      });

      const result = await tx.gateVerification.findUnique({
        where: { id: verification.id },
        include: {
          attachments: true,
          products: {
            include: { product: true },
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
      if (mapped.verification.attachments && Array.isArray(mapped.verification.attachments)) {
        mapped.verification.attachments = mapped.verification.attachments.map((attach: any) => ({
          ...attach,
          url: this.storageService.getFilePublicUrl(attach.filePath),
        }));
      }
    }

    return this.stripIdField(mapped);
  }

  private stripIdField(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this.stripIdField(item));
    }
    if (typeof obj === 'object') {
      // Retain 'id' for Product, GateOperationProduct, and GateVerificationProduct because they are needed as references in the frontend/API
      const isProduct = 'sku' in obj && 'name' in obj;
      const isGateOpProduct = 'gateOperationId' in obj && 'productId' in obj;
      const isGateVerificationProduct = 'gateVerificationId' in obj && 'productId' in obj;

      const newObj: any = {};
      for (const key of Object.keys(obj)) {
        if (key === 'id' && !isProduct && !isGateOpProduct && !isGateVerificationProduct) continue;
        newObj[key] = this.stripIdField(obj[key]);
      }
      return newObj;
    }
    return obj;
  }

  async addCargoItem(
    operationUuid: string,
    body: { productId: number; quantity: number; notes?: string },
  ) {
    const { productId, quantity, notes } = body;
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

      // Check if product exists
      const product = await tx.product.findUnique({
        where: { id: productId },
      });
      if (!product) {
        throw new NotFoundException('Produk tidak ditemukan');
      }

      // Check if product is already added in this gate operation
      const existing = await tx.gateOperationProduct.findFirst({
        where: {
          gateOperationId: gateOperation.id,
          productId,
        },
      });
      if (existing) {
        throw new BadRequestException('Produk sudah terdaftar di gate operation ini.');
      }

      // Create GateOperationProduct
      const cargoItem = await tx.gateOperationProduct.create({
        data: {
          gateOperationId: gateOperation.id,
          productId,
          quantity,
          notes: notes || null,
        },
        include: {
          product: true,
        },
      });

      // If verification exists, update verification status/totals
      if (gateOperation.verification) {
        await this.updateGateStatusAndRealisasi(tx, gateOperation.id, gateOperation.verification.id);
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
          product: true,
          gateOperation: {
            include: { verification: true },
          },
        },
      });

      if (!cargoItem) {
        throw new NotFoundException('Barang muatan tidak ditemukan');
      }

      const gateOperation = cargoItem.gateOperation;

      // Delete the cargo item (associated references are deleted via cascade)
      await tx.gateOperationProduct.delete({
        where: { id: cargoItem.id },
      });

      // If verification exists, update verification status/totals
      if (gateOperation.verification) {
        await this.updateGateStatusAndRealisasi(tx, gateOperation.id, gateOperation.verification.id);
      }

      return {
        success: true,
        message: 'Barang muatan berhasil dihapus',
        deletedItem: this.stripIdField(cargoItem),
      };
    });
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

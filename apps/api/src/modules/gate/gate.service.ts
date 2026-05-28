import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import { StorageService } from '../storage/storage.service';
import type { CreateGateOperationInput, CreateGateVerificationInput } from '@bulog-wms/schema';
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
      // 1. Resolve vehicle photo if provided
      let vehiclePhotoId: number | null = null;
      if (body.vehiclePhotoPath) {
        const attachment = await tx.fileAttachment.findFirst({
          where: { filePath: body.vehiclePhotoPath },
        });
        if (attachment) {
          vehiclePhotoId = attachment.id;
        }
      }

      // 2. Generate sequential number
      const opNumber = await this.generateOpNumber(tx);

      // 3. Create Gate Operation
      const gateOperation = await tx.gateOperation.create({
        data: {
          opNumber,
          cardType: body.cardType as CardType,
          driverName: body.driverName,
          licensePlate: body.licensePlate.toUpperCase(),
          notes: body.notes,
          status: VerificationStatus.PENDING,
          warehouseId,
          createdByUserId,
          vehiclePhotoId,
        },
      });

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
            vehiclePhoto: true,
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
      where.status = query.status as VerificationStatus;
    }

    const [total, items] = await Promise.all([
      this.prisma.gateOperation.count({ where }),
      this.prisma.gateOperation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          vehiclePhoto: true,
          products: {
            include: { product: true },
          },
          createdByUser: {
            select: { name: true, email: true },
          },
          verification: {
            include: {
              verifiedBy: { select: { name: true } },
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
  async getGateOperationByUuid(uuid: string) {
    const item = await this.prisma.gateOperation.findUnique({
      where: { uuid },
      include: {
        vehiclePhoto: true,
        createdByUser: {
          select: { name: true, email: true },
        },
        products: {
          include: { product: true },
        },
        verification: {
          include: {
            attachment: true,
            verifiedBy: {
              select: { name: true, email: true },
            },
            products: {
              include: { product: true },
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

    if (gateOperation.verification) {
      throw new BadRequestException('Gate operation ini sudah diverifikasi sebelumnya.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Resolve verification attachment if provided
      let attachmentId: number | null = null;
      if (body.attachmentPath) {
        const attach = await tx.fileAttachment.findFirst({
          where: { filePath: body.attachmentPath },
        });
        if (attach) {
          attachmentId = attach.id;
        }
      }

      // 2. Create Gate Verification
      const verification = await tx.gateVerification.create({
        data: {
          gateOperationId: gateOperation.id,
          verifiedById,
          status: body.status as VerificationStatus,
          notes: body.notes,
          attachmentId,
        },
      });

      // 3. Save verified quantities/items
      if (body.products && body.products.length > 0) {
        for (const prod of body.products) {
          await tx.gateVerificationProduct.create({
            data: {
              gateVerificationId: verification.id,
              productId: prod.productId,
              quantity: prod.quantity,
            },
          });
        }
      }

      // 4. Update status of the original Gate Operation
      await tx.gateOperation.update({
        where: { id: gateOperation.id },
        data: {
          status: body.status as VerificationStatus,
        },
      });

      return tx.gateVerification.findUnique({
        where: { id: verification.id },
        include: {
          attachment: true,
          products: {
            include: { product: true },
          },
        },
      });
    });
  }

  /**
   * Map database file paths to accessible public storage URLs.
   */
  private mapOperationUrls(item: any) {
    if (!item) return null;

    const mapped = { ...item };

    if (mapped.vehiclePhoto && mapped.vehiclePhoto.filePath) {
      mapped.vehiclePhoto.url = this.storageService.getFilePublicUrl(mapped.vehiclePhoto.filePath);
    }

    if (mapped.verification) {
      if (mapped.verification.attachment && mapped.verification.attachment.filePath) {
        mapped.verification.attachment.url = this.storageService.getFilePublicUrl(
          mapped.verification.attachment.filePath,
        );
      }
    }

    return mapped;
  }
}

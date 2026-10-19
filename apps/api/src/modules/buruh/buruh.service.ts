import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { StorageService } from '@/modules/storage/storage.service';
import type {
  CreateBuruhInput,
  UpdateBuruhInput,
  BuruhQueryInput,
  BuruhResponse,
} from '@bulog-wms/schema';
import { Prisma, type Buruh } from '@prisma/client';
import * as crypto from 'crypto';
import * as path from 'path';

const KTP_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const KTP_MAX_SIZE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class BuruhService {
  private readonly logger = new Logger(BuruhService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(warehouseId: number, query: BuruhQueryInput) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = { warehouseId, deletedAt: null };
    if (query.isActive) {
      where.isActive = query.isActive === 'true';
    }
    if (query.isMandor) {
      where.isMandor = query.isMandor === 'true';
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { nik: { contains: query.search } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.buruh.count({ where }),
      this.prisma.buruh.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isMandor: 'desc' }, { name: 'asc' }],
      }),
    ]);

    return {
      data: await Promise.all(rows.map((row) => this.toResponse(row))),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(warehouseId: number, uuid: string) {
    return this.toResponse(await this.findEntity(warehouseId, uuid));
  }

  async create(
    warehouseId: number,
    body: CreateBuruhInput,
    file: Express.Multer.File | undefined,
    userId: number,
  ) {
    const ktpPhotoKey = file
      ? await this.uploadKtpPhoto(warehouseId, file)
      : null;

    const isActive = body.isActive ?? true;
    const isMandor = this.resolveMandor(body.isMandor ?? false, isActive);

    const buruh = await this.prisma.$transaction(
      async (tx) => {
        if (isMandor) {
          await this.clearMandor(tx, warehouseId);
        }
        return tx.buruh.create({
          data: {
            warehouseId,
            name: body.name,
            nik: body.nik || null,
            isActive,
            isMandor,
            ktpPhotoKey,
            createdById: userId,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.toResponse(buruh);
  }

  async update(
    warehouseId: number,
    uuid: string,
    body: UpdateBuruhInput,
    file: Express.Multer.File | undefined,
  ) {
    const existing = await this.findEntity(warehouseId, uuid);

    let ktpPhotoKey = existing.ktpPhotoKey;
    if (file) {
      ktpPhotoKey = await this.uploadKtpPhoto(warehouseId, file);
    } else if (body.removeKtpPhoto) {
      ktpPhotoKey = null;
    }

    const isActive = body.isActive ?? existing.isActive;
    // Deactivating the current mandor silently drops the mandor flag
    const isMandor = this.resolveMandor(
      body.isMandor ?? (isActive ? existing.isMandor : false),
      isActive,
    );

    const buruh = await this.prisma.$transaction(
      async (tx) => {
        if (isMandor && !existing.isMandor) {
          await this.clearMandor(tx, warehouseId, existing.id);
        }
        return tx.buruh.update({
          where: { id: existing.id },
          data: {
            name: body.name,
            nik: body.nik === undefined ? undefined : body.nik || null,
            isActive,
            isMandor,
            ktpPhotoKey,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Drop the replaced photo only after the new reference is persisted
    if (existing.ktpPhotoKey && existing.ktpPhotoKey !== ktpPhotoKey) {
      await this.deleteObjectSafely(existing.ktpPhotoKey);
    }

    return this.toResponse(buruh);
  }

  /**
   * Soft delete; the KTP photo is kept so historical tanda terima stay traceable.
   */
  async remove(warehouseId: number, uuid: string) {
    const existing = await this.findEntity(warehouseId, uuid);
    await this.prisma.buruh.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), isActive: false, isMandor: false },
    });
    return { uuid: existing.uuid };
  }

  /**
   * An inactive buruh cannot sign tanda terima as mandor.
   */
  private resolveMandor(isMandor: boolean, isActive: boolean) {
    if (isMandor && !isActive) {
      throw new BadRequestException(
        'Buruh nonaktif tidak dapat dijadikan mandor.',
      );
    }
    return isMandor;
  }

  /**
   * Unset the current mandor of the warehouse so the new one is the only mandor.
   */
  private async clearMandor(
    tx: Prisma.TransactionClient,
    warehouseId: number,
    exceptId?: number,
  ) {
    await tx.buruh.updateMany({
      where: {
        warehouseId,
        isMandor: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isMandor: false },
    });
  }

  private async findEntity(warehouseId: number, uuid: string) {
    const buruh = await this.prisma.buruh.findFirst({
      where: { uuid, warehouseId, deletedAt: null },
    });
    if (!buruh) {
      throw new NotFoundException('Data buruh tidak ditemukan.');
    }
    return buruh;
  }

  private async uploadKtpPhoto(
    warehouseId: number,
    file: Express.Multer.File,
  ): Promise<string> {
    if (!KTP_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Foto KTP harus berformat JPG, PNG, atau WEBP.',
      );
    }
    if (file.size > KTP_MAX_SIZE_BYTES) {
      throw new BadRequestException('Ukuran foto KTP maksimal 5 MB.');
    }

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const key = `buruh/${warehouseId}/ktp/${crypto.randomUUID()}${ext}`;
    await this.storageService.uploadBuffer(file.buffer, key, file.mimetype);
    return key;
  }

  private async deleteObjectSafely(key: string) {
    try {
      await this.storageService.deleteFileByKey(key);
    } catch (err: any) {
      this.logger.warn(`Gagal menghapus foto KTP ${key}: ${err.message}`);
    }
  }

  private async toResponse(buruh: Buruh): Promise<BuruhResponse> {
    let ktpPhotoUrl: string | null = null;
    if (buruh.ktpPhotoKey) {
      try {
        ktpPhotoUrl = await this.storageService.getFilePrivateUrl(
          buruh.ktpPhotoKey,
          3600,
        );
      } catch (err: any) {
        this.logger.warn(
          `Failed to generate presigned URL for buruh ${buruh.uuid}: ${err.message}`,
        );
      }
    }

    return {
      uuid: buruh.uuid,
      name: buruh.name,
      nik: buruh.nik,
      isActive: buruh.isActive,
      isMandor: buruh.isMandor,
      ktpPhotoUrl,
      createdAt: buruh.createdAt.toISOString(),
      updatedAt: buruh.updatedAt.toISOString(),
    };
  }
}

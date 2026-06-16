import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class UserSignatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Upload and register a new signature image.
   */
  async create(userId: number, file: Express.Multer.File) {
    // Validate format
    const allowedMimeTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/svg+xml',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Format file tidak didukung. Hanya file PNG, JPG, JPEG, dan SVG yang diperbolehkan.',
      );
    }

    const ext =
      path.extname(file.originalname) ||
      (file.mimetype === 'image/svg+xml' ? '.svg' : '.png');
    const uniqueId = crypto.randomUUID();
    const fileKey = `documents/signatures/${uniqueId}${ext}`;

    // Upload to MinIO
    const fileUrl = await this.storageService.uploadBuffer(
      file.buffer,
      fileKey,
      file.mimetype,
    );

    // Deactivate previous active signatures
    await this.prisma.userSignature.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    // Save user signature
    const signature = await this.prisma.userSignature.create({
      data: {
        userId,
        fileUrl,
        fileKey,
        isActive: true,
      },
    });

    return signature;
  }

  /**
   * Get all signatures for a user.
   */
  async findAll(userId: number) {
    const signatures = await this.prisma.userSignature.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Map each key to presigned URL on demand
    return Promise.all(
      signatures.map(async (sig) => {
        const url = await this.storageService.getFilePrivateUrl(sig.fileKey);
        return {
          ...sig,
          fileUrl: url,
        };
      }),
    );
  }

  /**
   * Get the current active signature of a user.
   */
  async findActive(userId: number) {
    const signature = await this.prisma.userSignature.findFirst({
      where: { userId, isActive: true },
    });

    if (!signature) {
      return null;
    }

    const presignedUrl = await this.storageService.getFilePrivateUrl(
      signature.fileKey,
    );
    return {
      ...signature,
      fileUrl: presignedUrl,
    };
  }

  /**
   * Set a specific signature as the active signature.
   */
  async setActive(id: number, userId: number) {
    // Verify existence & ownership
    const signature = await this.prisma.userSignature.findFirst({
      where: { id, userId },
    });

    if (!signature) {
      throw new NotFoundException('Tanda tangan tidak ditemukan.');
    }

    // Set all others to inactive
    await this.prisma.userSignature.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    // Set target as active
    return this.prisma.userSignature.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /**
   * Delete a signature.
   */
  async remove(id: number, userId: number) {
    const signature = await this.prisma.userSignature.findFirst({
      where: { id, userId },
    });

    if (!signature) {
      throw new NotFoundException('Tanda tangan tidak ditemukan.');
    }

    // Delete file from MinIO
    try {
      await this.storageService.deleteFileByKey(signature.fileKey);
    } catch (err: any) {
      // Log warning, continue deleting database record
    }

    // Delete record from database
    return this.prisma.userSignature.delete({
      where: { id },
    });
  }
}

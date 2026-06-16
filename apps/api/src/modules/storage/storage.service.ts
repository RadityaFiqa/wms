import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  PutBucketPolicyCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../../core/prisma/prisma.service';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucketName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const endpoint =
      this.configService.get<string>('MINIO_ENDPOINT') || 'localhost';
    const port = this.configService.get<number>('MINIO_PORT') || 9000;
    const accessKey =
      this.configService.get<string>('MINIO_ACCESS_KEY') || 'minioadmin';
    const secretKey =
      this.configService.get<string>('MINIO_SECRET_KEY') || 'minioadmin';
    const useSSL = this.configService.get<string>('MINIO_USE_SSL') === 'true';

    this.bucketName =
      this.configService.get<string>('MINIO_BUCKET') || 'wms-bucket';

    this.s3Client = new S3Client({
      endpoint: useSSL
        ? `https://${endpoint}:${port}`
        : `http://${endpoint}:${port}`,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      region: 'us-east-1', // Required by S3 SDK, dummy for MinIO
      forcePathStyle: true, // Crucial for MinIO path-based access
    });
  }

  async onModuleInit() {
    try {
      // Check if bucket exists
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: this.bucketName }),
      );
      this.logger.log(`Bucket "${this.bucketName}" already exists.`);
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        this.logger.log(
          `Bucket "${this.bucketName}" not found. Creating it...`,
        );
        await this.s3Client.send(
          new CreateBucketCommand({ Bucket: this.bucketName }),
        );
        this.logger.log(`Bucket "${this.bucketName}" created successfully.`);

        // Apply public read policy so browser can load images directly
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicRead',
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };
        await this.s3Client.send(
          new PutBucketPolicyCommand({
            Bucket: this.bucketName,
            Policy: JSON.stringify(policy),
          }),
        );
        this.logger.log(
          `Public read policy applied to bucket "${this.bucketName}".`,
        );
      } else {
        this.logger.error(
          `Error checking/creating bucket: ${err.message}`,
          err.stack,
        );
      }
    }
  }

  /**
   * Upload a file to MinIO and save metadata in the database.
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    uploadedById: number,
  ) {
    const ext = path.extname(file.originalname);
    const originalName = file.originalname;
    const mimeType = file.mimetype;
    const sizeBytes = file.size;

    // Generate unique key
    const uniqueId = crypto.randomUUID();
    const filePath = `${folder}/${uniqueId}${ext}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
        Body: file.buffer,
        ContentType: mimeType,
      }),
    );

    // Save metadata in database
    const fileAttachment = await this.prisma.fileAttachment.create({
      data: {
        uuid: uniqueId,
        filePath,
        fileName: originalName,
        mimeType,
        sizeBytes,
        uploadedById,
      },
    });

    return fileAttachment;
  }

  /**
   * Delete a file from MinIO and remove metadata from database.
   */
  async deleteFile(id: number) {
    const attachment = await this.prisma.fileAttachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      throw new Error('File attachment tidak ditemukan.');
    }

    // Delete from MinIO
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: attachment.filePath,
        }),
      );
    } catch (err: any) {
      this.logger.warn(`Gagal menghapus file dari MinIO: ${err.message}`);
    }

    // Delete from database
    await this.prisma.fileAttachment.delete({
      where: { id },
    });
  }

  /**
   * Upload a raw buffer to MinIO.
   */
  async uploadBuffer(buffer: Buffer, filePath: string, mimeType: string) {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return this.getFilePublicUrl(filePath);
  }

  /**
   * Generates public read URL of a file path.
   */
  getFilePublicUrl(filePath: string): string {
    const publicUrl =
      this.configService.get<string>('MINIO_PUBLIC_URL') ||
      'http://localhost:9000';
    return `${publicUrl}/${this.bucketName}/${filePath}`;
  }

  /**
   * Generates private pre-signed URL of a file path.
   */
  async getFilePrivateUrl(
    filePath: string,
    expiresSeconds = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresSeconds });
  }

  /**
   * Get raw file buffer from MinIO.
   */
  async getFileBuffer(filePath: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    });
    const response = await this.s3Client.send(command);
    if (!response.Body) {
      throw new Error(`File buffer untuk ${filePath} kosong.`);
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  /**
   * Delete a file from MinIO by key directly.
   */
  async deleteFileByKey(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );
  }
}

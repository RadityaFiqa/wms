import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/prisma/prisma.service';
export declare class StorageService implements OnModuleInit {
    private readonly configService;
    private readonly prisma;
    private readonly logger;
    private s3Client;
    private bucketName;
    constructor(configService: ConfigService, prisma: PrismaService);
    onModuleInit(): Promise<void>;
    uploadFile(file: Express.Multer.File, folder: string, uploadedById: number): Promise<{
        uuid: string;
        filePath: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        uploadedAt: Date;
        id: number;
        uploadedById: number;
        gateOperationId: number | null;
        gateVerificationId: number | null;
        stockOpnameId: number | null;
    }>;
    deleteFile(id: number): Promise<void>;
    uploadBuffer(buffer: Buffer, filePath: string, mimeType: string): Promise<string>;
    getFilePublicUrl(filePath: string): string;
    getFilePrivateUrl(filePath: string, expiresSeconds?: number): Promise<string>;
    getFileBuffer(filePath: string): Promise<Buffer>;
    deleteFileByKey(key: string): Promise<void>;
}

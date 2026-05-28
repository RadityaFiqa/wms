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
        id: number;
        filePath: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        uploadedById: number;
        uploadedAt: Date;
    }>;
    deleteFile(id: number): Promise<void>;
    getFilePublicUrl(filePath: string): string;
    getFilePrivateUrl(filePath: string, expiresSeconds?: number): Promise<string>;
}

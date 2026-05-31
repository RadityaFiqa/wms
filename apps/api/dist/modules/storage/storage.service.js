"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const prisma_service_1 = require("../../core/prisma/prisma.service");
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
let StorageService = StorageService_1 = class StorageService {
    configService;
    prisma;
    logger = new common_1.Logger(StorageService_1.name);
    s3Client;
    bucketName;
    constructor(configService, prisma) {
        this.configService = configService;
        this.prisma = prisma;
        const endpoint = this.configService.get('MINIO_ENDPOINT') || 'localhost';
        const port = this.configService.get('MINIO_PORT') || 9000;
        const accessKey = this.configService.get('MINIO_ACCESS_KEY') || 'minioadmin';
        const secretKey = this.configService.get('MINIO_SECRET_KEY') || 'minioadmin';
        const useSSL = this.configService.get('MINIO_USE_SSL') === 'true';
        this.bucketName = this.configService.get('MINIO_BUCKET') || 'wms-bucket';
        this.s3Client = new client_s3_1.S3Client({
            endpoint: useSSL ? `https://${endpoint}:${port}` : `http://${endpoint}:${port}`,
            credentials: {
                accessKeyId: accessKey,
                secretAccessKey: secretKey,
            },
            region: 'us-east-1',
            forcePathStyle: true,
        });
    }
    async onModuleInit() {
        try {
            await this.s3Client.send(new client_s3_1.HeadBucketCommand({ Bucket: this.bucketName }));
            this.logger.log(`Bucket "${this.bucketName}" already exists.`);
        }
        catch (err) {
            if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
                this.logger.log(`Bucket "${this.bucketName}" not found. Creating it...`);
                await this.s3Client.send(new client_s3_1.CreateBucketCommand({ Bucket: this.bucketName }));
                this.logger.log(`Bucket "${this.bucketName}" created successfully.`);
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
                await this.s3Client.send(new client_s3_1.PutBucketPolicyCommand({
                    Bucket: this.bucketName,
                    Policy: JSON.stringify(policy),
                }));
                this.logger.log(`Public read policy applied to bucket "${this.bucketName}".`);
            }
            else {
                this.logger.error(`Error checking/creating bucket: ${err.message}`, err.stack);
            }
        }
    }
    async uploadFile(file, folder, uploadedById) {
        const ext = path.extname(file.originalname);
        const originalName = file.originalname;
        const mimeType = file.mimetype;
        const sizeBytes = file.size;
        const uniqueId = crypto.randomUUID();
        const filePath = `${folder}/${uniqueId}${ext}`;
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: filePath,
            Body: file.buffer,
            ContentType: mimeType,
        }));
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
    async deleteFile(id) {
        const attachment = await this.prisma.fileAttachment.findUnique({
            where: { id },
        });
        if (!attachment) {
            throw new Error('File attachment tidak ditemukan.');
        }
        try {
            await this.s3Client.send(new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: attachment.filePath,
            }));
        }
        catch (err) {
            this.logger.warn(`Gagal menghapus file dari MinIO: ${err.message}`);
        }
        await this.prisma.fileAttachment.delete({
            where: { id },
        });
    }
    getFilePublicUrl(filePath) {
        const publicUrl = this.configService.get('MINIO_PUBLIC_URL') || 'http://localhost:9000';
        return `${publicUrl}/${this.bucketName}/${filePath}`;
    }
    async getFilePrivateUrl(filePath, expiresSeconds = 3600) {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: this.bucketName,
            Key: filePath,
        });
        return (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, { expiresIn: expiresSeconds });
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], StorageService);
//# sourceMappingURL=storage.service.js.map
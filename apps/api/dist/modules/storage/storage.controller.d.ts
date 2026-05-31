import { StorageService } from './storage.service';
export declare class StorageController {
    private readonly storageService;
    constructor(storageService: StorageService);
    uploadFile(file: Express.Multer.File, req: any): Promise<{
        url: string;
        uuid: string;
        id: number;
        filePath: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        uploadedById: number;
        uploadedAt: Date;
        gateOperationId: number | null;
        gateVerificationId: number | null;
        stockOpnameId: number | null;
    }>;
}

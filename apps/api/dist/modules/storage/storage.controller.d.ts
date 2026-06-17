import { StorageService } from './storage.service';
export declare class StorageController {
    private readonly storageService;
    constructor(storageService: StorageService);
    uploadFile(file: Express.Multer.File, req: any): Promise<{
        url: string;
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
}

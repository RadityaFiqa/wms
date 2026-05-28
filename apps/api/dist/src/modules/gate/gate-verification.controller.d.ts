import type { CreateGateVerificationInput } from '@bulog-wms/schema';
import { GateService } from './gate.service';
export declare class GateVerificationController {
    private readonly service;
    constructor(service: GateService);
    verify(operationUuid: string, req: any, body: CreateGateVerificationInput): Promise<({
        products: ({
            product: {
                uuid: string;
                id: number;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                sku: string;
                category: string;
                price: number;
                uom: string | null;
            };
        } & {
            uuid: string;
            id: number;
            productId: number;
            quantity: number;
            gateVerificationId: number;
        })[];
        attachment: {
            uuid: string;
            id: number;
            filePath: string;
            fileName: string;
            mimeType: string;
            sizeBytes: number;
            uploadedById: number;
            uploadedAt: Date;
        } | null;
    } & {
        uuid: string;
        id: number;
        status: import("@prisma/client").$Enums.VerificationStatus;
        notes: string | null;
        gateOperationId: number;
        verifiedById: number;
        verifiedAt: Date;
        attachmentId: number | null;
    }) | null>;
}

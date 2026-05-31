import type { CreateGateOperationInput } from '@bulog-wms/schema';
import { GateService } from './gate.service';
export declare class GateOperationController {
    private readonly service;
    constructor(service: GateService);
    create(req: any, body: CreateGateOperationInput): Promise<any>;
    findAll(search?: string, cardType?: string, status?: string, startDate?: string, endDate?: string, page?: string, limit?: string): Promise<{
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        items: any[];
    }>;
    addCargoItem(uuid: string, req: any, body: {
        productId: number;
        quantity: number;
        notes?: string;
    }): Promise<any>;
    deleteCargoItem(productUuid: string, req: any): Promise<{
        success: boolean;
        message: string;
        deletedItem: any;
    }>;
    findOne(uuid: string): Promise<any>;
}

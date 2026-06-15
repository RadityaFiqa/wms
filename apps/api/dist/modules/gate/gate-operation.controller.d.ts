import type { Response } from 'express';
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
    getClientHistory(clientPartner: string, req: any): Promise<{
        licensePlate: string;
        driverName: string;
        driverPhone: string;
    }[]>;
    addCargoItem(uuid: string, req: any, body: {
        productId: number;
        quantity: number;
        notes?: string;
        quantId?: number;
        locationId?: number;
    }): Promise<any>;
    updateCargoItem(cargoUuid: string, req: any, body: {
        quantId?: number | null;
        locationId?: number | null;
        quantity?: number;
    }): Promise<any>;
    deleteCargoItem(cargoUuid: string, req: any): Promise<{
        success: boolean;
        message: string;
        deletedItem: any;
    }>;
    getDeliveryOrderPdf(id: string, res: Response): Promise<void>;
    getDeliveryOrderPreview(id: string, res: Response): Promise<void>;
    findOne(uuid: string): Promise<any>;
}

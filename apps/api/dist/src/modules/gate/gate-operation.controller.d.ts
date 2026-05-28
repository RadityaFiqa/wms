import type { CreateGateOperationInput } from '@bulog-wms/schema';
import { GateService } from './gate.service';
export declare class GateOperationController {
    private readonly service;
    constructor(service: GateService);
    create(req: any, body: CreateGateOperationInput): Promise<any>;
    findAll(search?: string, cardType?: string, status?: string, page?: string, limit?: string): Promise<{
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        items: any[];
    }>;
    findOne(uuid: string): Promise<any>;
}

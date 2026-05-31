import type { CreateGateVerificationInput, AssignReferencesInput } from '@bulog-wms/schema';
import { GateService } from './gate.service';
export declare class GateVerificationController {
    private readonly service;
    constructor(service: GateService);
    getAvailableReferences(operationUuid: string, productId?: string, gateItemId?: string): Promise<any[]>;
    assignReferences(operationUuid: string, req: any, body: AssignReferencesInput): Promise<any>;
    verify(operationUuid: string, req: any, body: CreateGateVerificationInput): Promise<any>;
    cancel(operationUuid: string, req: any): Promise<any>;
    unassignReference(referenceUuid: string, req: any): Promise<{
        success: boolean;
        message: string;
        auditDetails: {
            previousReference: string;
            unassignedBy: string;
            timestamp: string;
        };
    }>;
}

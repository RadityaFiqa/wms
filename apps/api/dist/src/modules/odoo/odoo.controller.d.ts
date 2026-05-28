import { OdooRepository } from './odoo.repository';
import { OdooAuthService } from './odoo-auth.service';
import { OdooSessionManager } from './odoo-session.manager';
import type { CreateOdooAccountInput, UpdateOdooAccountInput } from '@bulog-wms/schema';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
export declare class OdooController {
    private readonly repository;
    private readonly authService;
    private readonly sessionManager;
    private readonly warehouseContext;
    constructor(repository: OdooRepository, authService: OdooAuthService, sessionManager: OdooSessionManager, warehouseContext: WarehouseContextService);
    create(body: CreateOdooAccountInput): Promise<any>;
    findOneForWarehouse(): Promise<any>;
    findOne(uuid: string): Promise<any>;
    update(uuid: string, body: UpdateOdooAccountInput): Promise<any>;
    remove(uuid: string): Promise<{
        message: string;
    }>;
    testConnectionRaw(body: any): Promise<any>;
    testConnection(uuid: string, req: any): Promise<any>;
    deactivate(uuid: string): Promise<any>;
    activate(uuid: string): Promise<any>;
    refreshSession(uuid: string): Promise<any>;
    private sanitize;
}

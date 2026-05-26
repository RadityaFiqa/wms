import { OdooRepository } from './odoo.repository';
import { OdooAuthService } from './odoo-auth.service';
import { OdooSessionManager } from './odoo-session.manager';
import type { CreateOdooAccountInput, UpdateOdooAccountInput } from '@bulog-wms/schema';
export declare class OdooController {
    private readonly repository;
    private readonly authService;
    private readonly sessionManager;
    constructor(repository: OdooRepository, authService: OdooAuthService, sessionManager: OdooSessionManager);
    create(body: CreateOdooAccountInput): Promise<any>;
    findAll(): Promise<any[]>;
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

import { RoleService } from './role.service';
import type { CreateRoleInput } from '@bulog-wms/schema';
export declare class RoleController {
    private readonly roleService;
    constructor(roleService: RoleService);
    findAll(req: any): Promise<({
        permissions: ({
            permission: {
                uuid: string;
                action: string;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                subject: string;
                conditions: string | null;
            };
        } & {
            roleId: number;
            permissionId: number;
        })[];
    } & {
        uuid: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    })[]>;
    findAllPermissions(req: any): Promise<{
        uuid: string;
        action: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        subject: string;
        conditions: string | null;
    }[]>;
    findOne(uuid: string, req: any): Promise<{
        permissions: ({
            permission: {
                uuid: string;
                action: string;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                subject: string;
                conditions: string | null;
            };
        } & {
            roleId: number;
            permissionId: number;
        })[];
    } & {
        uuid: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }>;
    create(req: any, body: CreateRoleInput): Promise<{
        permissions: ({
            permission: {
                uuid: string;
                action: string;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                subject: string;
                conditions: string | null;
            };
        } & {
            roleId: number;
            permissionId: number;
        })[];
    } & {
        uuid: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }>;
    update(uuid: string, req: any, body: {
        description?: string | null;
        permissionIds?: number[];
    }): Promise<{
        permissions: ({
            permission: {
                uuid: string;
                action: string;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                subject: string;
                conditions: string | null;
            };
        } & {
            roleId: number;
            permissionId: number;
        })[];
    } & {
        uuid: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }>;
}

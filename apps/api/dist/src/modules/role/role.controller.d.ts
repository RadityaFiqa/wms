import { RoleService } from './role.service';
import type { CreateRoleInput } from '@bulog-wms/schema';
export declare class RoleController {
    private readonly roleService;
    constructor(roleService: RoleService);
    findAll(): Promise<({
        permissions: ({
            permission: {
                uuid: string;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                action: string;
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
    findAllPermissions(): Promise<{
        uuid: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        action: string;
        subject: string;
        conditions: string | null;
    }[]>;
    findOne(uuid: string): Promise<{
        permissions: ({
            permission: {
                uuid: string;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                action: string;
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
    create(body: CreateRoleInput): Promise<{
        permissions: ({
            permission: {
                uuid: string;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                action: string;
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
    update(uuid: string, body: {
        description?: string | null;
        permissionIds?: number[];
    }): Promise<{
        permissions: ({
            permission: {
                uuid: string;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                action: string;
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

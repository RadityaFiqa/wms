import { PrismaService } from '../../core/prisma/prisma.service';
export declare class RoleService {
    private readonly prisma;
    constructor(prisma: PrismaService);
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
    findByUuid(uuid: string): Promise<{
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
    create(data: {
        name: string;
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
    update(uuid: string, data: {
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

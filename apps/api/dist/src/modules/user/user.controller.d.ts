import { UserService } from './user.service';
import type { CreateUserInput, UpdateUserInput } from '@bulog-wms/schema';
export declare class UserController {
    private readonly userService;
    constructor(userService: UserService);
    create(body: CreateUserInput): Promise<{
        role: {
            uuid: string;
            id: number;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
        };
        uuid: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        isActive: boolean;
        isFirstLogin: boolean;
        warehouseId: number | null;
    }>;
    findAll(search?: string, roleId?: number, isActive?: boolean, page?: number, limit?: number): Promise<{
        data: {
            warehouse: {
                uuid: string;
                id: number;
                name: string;
            } | null;
            role: {
                uuid: string;
                id: number;
                name: string;
            };
            uuid: string;
            id: number;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            roleId: number;
            email: string;
            isActive: boolean;
            isFirstLogin: boolean;
            warehouseId: number | null;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findOne(uuid: string): Promise<{
        warehouse: {
            uuid: string;
            id: number;
            name: string;
        } | null;
        role: {
            uuid: string;
            id: number;
            name: string;
        };
        uuid: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        isActive: boolean;
        isFirstLogin: boolean;
        warehouseId: number | null;
    }>;
    update(uuid: string, body: UpdateUserInput): Promise<{
        role: {
            uuid: string;
            id: number;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
        };
        uuid: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        isActive: boolean;
        isFirstLogin: boolean;
        warehouseId: number | null;
    }>;
    deactivate(uuid: string): Promise<{
        uuid: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        isActive: boolean;
        isFirstLogin: boolean;
        warehouseId: number | null;
    }>;
    activate(uuid: string): Promise<{
        uuid: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        isActive: boolean;
        isFirstLogin: boolean;
        warehouseId: number | null;
    }>;
    resetPassword(uuid: string): Promise<{
        message: string;
    }>;
}

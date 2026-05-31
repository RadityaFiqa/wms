import { UserService } from './user.service';
import type { CreateUserInput, UpdateUserInput } from '@bulog-wms/schema';
export declare class UserController {
    private readonly userService;
    constructor(userService: UserService);
    create(req: any, body: CreateUserInput): Promise<{
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
        email: string;
        name: string;
        isActive: boolean;
        isFirstLogin: boolean;
        roleId: number;
        warehouseId: number | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(req: any, search?: string, roleId?: number, isActive?: string, page?: number, limit?: number): Promise<{
        data: {
            role: {
                uuid: string;
                id: number;
                name: string;
            };
            warehouse: {
                uuid: string;
                id: number;
                name: string;
            } | null;
            uuid: string;
            id: number;
            email: string;
            name: string;
            isActive: boolean;
            isFirstLogin: boolean;
            roleId: number;
            warehouseId: number | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findOne(uuid: string, req: any): Promise<{
        role: {
            uuid: string;
            id: number;
            name: string;
        };
        warehouse: {
            uuid: string;
            id: number;
            name: string;
        } | null;
        uuid: string;
        id: number;
        email: string;
        name: string;
        isActive: boolean;
        isFirstLogin: boolean;
        roleId: number;
        warehouseId: number | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(uuid: string, body: UpdateUserInput, req: any): Promise<{
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
        email: string;
        name: string;
        isActive: boolean;
        isFirstLogin: boolean;
        roleId: number;
        warehouseId: number | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deactivate(uuid: string, req: any): Promise<{
        uuid: string;
        id: number;
        email: string;
        name: string;
        isActive: boolean;
        isFirstLogin: boolean;
        roleId: number;
        warehouseId: number | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    activate(uuid: string, req: any): Promise<{
        uuid: string;
        id: number;
        email: string;
        name: string;
        isActive: boolean;
        isFirstLogin: boolean;
        roleId: number;
        warehouseId: number | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    resetPassword(uuid: string, req: any): Promise<{
        message: string;
    }>;
}

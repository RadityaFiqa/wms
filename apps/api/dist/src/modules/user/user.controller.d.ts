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
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        isFirstLogin: boolean;
        warehouseId: number | null;
    }>;
    findAll(req: any, search?: string, roleId?: number, isActive?: string, page?: number, limit?: number): Promise<{
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
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            roleId: number;
            email: string;
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
    findOne(uuid: string, req: any): Promise<{
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
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        isFirstLogin: boolean;
        warehouseId: number | null;
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
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        isFirstLogin: boolean;
        warehouseId: number | null;
    }>;
    deactivate(uuid: string, req: any): Promise<{
        uuid: string;
        id: number;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        isFirstLogin: boolean;
        warehouseId: number | null;
    }>;
    activate(uuid: string, req: any): Promise<{
        uuid: string;
        id: number;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        isFirstLogin: boolean;
        warehouseId: number | null;
    }>;
    resetPassword(uuid: string, req: any): Promise<{
        message: string;
    }>;
}

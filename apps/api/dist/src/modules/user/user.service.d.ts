import { PrismaService } from '../../core/prisma/prisma.service';
import { EmailService } from '../email/email.service';
export declare class UserService {
    private readonly prisma;
    private readonly emailService;
    constructor(prisma: PrismaService, emailService: EmailService);
    private generateRandomPassword;
    create(data: {
        email: string;
        name: string;
        roleId: number;
        warehouseId?: number | null;
    }): Promise<{
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
    update(uuid: string, data: {
        email: string;
        name: string;
        roleId: number;
        warehouseId?: number | null;
    }): Promise<{
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
    toggleStatus(uuid: string, isActive: boolean): Promise<{
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
    adminResetPassword(uuid: string): Promise<{
        message: string;
    }>;
    findAll(query: {
        search?: string;
        roleId?: number;
        isActive?: boolean;
        page?: number;
        limit?: number;
    }): Promise<{
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
    findByEmail(email: string): Promise<({
        warehouse: {
            uuid: string;
            id: number;
            name: string;
            location: string;
            capacity: number;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        role: {
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
        };
    } & {
        uuid: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        password: string;
        isActive: boolean;
        isFirstLogin: boolean;
        warehouseId: number | null;
    }) | null>;
    findByUuid(uuid: string): Promise<{
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
}

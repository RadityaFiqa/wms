import { PrismaService } from '../../core/prisma/prisma.service';
import { EmailService } from '../email/email.service';
export declare class UserService {
    private readonly prisma;
    private readonly emailService;
    constructor(prisma: PrismaService, emailService: EmailService);
    private generateRandomPassword;
    private getWarehouseAdminScope;
    create(data: {
        email: string;
        name: string;
        roleId: number;
        warehouseId?: number | null;
    }, currentUser: any): Promise<{
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
    update(uuid: string, data: {
        email: string;
        name: string;
        roleId: number;
        warehouseId?: number | null;
    }, currentUser: any): Promise<{
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
    toggleStatus(uuid: string, isActive: boolean, currentUser: any): Promise<{
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
    adminResetPassword(uuid: string, currentUser: any): Promise<{
        message: string;
    }>;
    findAll(query: {
        search?: string;
        roleId?: number;
        isActive?: string;
        page?: number;
        limit?: number;
    }, currentUser: any): Promise<{
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
    findByEmail(email: string): Promise<({
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
        warehouse: {
            location: string;
            uuid: string;
            id: number;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            capacity: number;
            type: string | null;
            address: string | null;
            odooReference: string | null;
        } | null;
    } & {
        uuid: string;
        id: number;
        email: string;
        password: string;
        name: string;
        isActive: boolean;
        isFirstLogin: boolean;
        roleId: number;
        warehouseId: number | null;
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
    findByUuid(uuid: string, currentUser: any): Promise<{
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
}

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
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        isFirstLogin: boolean;
        warehouseId: number | null;
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
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        isFirstLogin: boolean;
        warehouseId: number | null;
    }>;
    toggleStatus(uuid: string, isActive: boolean, currentUser: any): Promise<{
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
    findByEmail(email: string): Promise<({
        warehouse: {
            uuid: string;
            id: number;
            code: string;
            name: string;
            location: string;
            capacity: number;
            type: string | null;
            address: string | null;
            isActive: boolean;
            odooReference: string | null;
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
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        roleId: number;
        email: string;
        password: string;
        isFirstLogin: boolean;
        warehouseId: number | null;
    }) | null>;
    findByUuid(uuid: string, currentUser: any): Promise<{
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
}

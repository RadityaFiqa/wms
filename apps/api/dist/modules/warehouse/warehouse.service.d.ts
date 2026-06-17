import { PrismaService } from '../../core/prisma/prisma.service';
import type { CreateWarehouseInput, UpdateWarehouseInput } from '@bulog-wms/schema';
export declare class WarehouseService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(data: CreateWarehouseInput): Promise<{
        code: string;
        type: string | null;
        uuid: string;
        id: number;
        name: string;
        location: string;
        capacity: number;
        address: string | null;
        isActive: boolean;
        odooReference: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(query: {
        search?: string;
        page?: number;
        limit?: number;
        activeOnly?: boolean;
        allowedIds?: number[];
    }): Promise<{
        data: {
            code: string;
            type: string | null;
            uuid: string;
            id: number;
            name: string;
            location: string;
            capacity: number;
            address: string | null;
            isActive: boolean;
            odooReference: string | null;
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
    findByUuid(uuid: string): Promise<{
        code: string;
        type: string | null;
        uuid: string;
        id: number;
        name: string;
        location: string;
        capacity: number;
        address: string | null;
        isActive: boolean;
        odooReference: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(uuid: string, data: UpdateWarehouseInput): Promise<{
        code: string;
        type: string | null;
        uuid: string;
        id: number;
        name: string;
        location: string;
        capacity: number;
        address: string | null;
        isActive: boolean;
        odooReference: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(uuid: string): Promise<{
        code: string;
        type: string | null;
        uuid: string;
        id: number;
        name: string;
        location: string;
        capacity: number;
        address: string | null;
        isActive: boolean;
        odooReference: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}

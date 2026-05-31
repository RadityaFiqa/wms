import { PrismaService } from '../../core/prisma/prisma.service';
import type { CreateWarehouseInput, UpdateWarehouseInput } from '@bulog-wms/schema';
export declare class WarehouseService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(data: CreateWarehouseInput): Promise<{
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
    }>;
    findAll(query: {
        search?: string;
        page?: number;
        limit?: number;
        activeOnly?: boolean;
        allowedIds?: number[];
    }): Promise<{
        data: {
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
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findByUuid(uuid: string): Promise<{
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
    }>;
    update(uuid: string, data: UpdateWarehouseInput): Promise<{
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
    }>;
    remove(uuid: string): Promise<{
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
    }>;
}

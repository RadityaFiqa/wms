import { WarehouseService } from './warehouse.service';
import type { CreateWarehouseInput, UpdateWarehouseInput } from '@bulog-wms/schema';
import { PrismaService } from '../../core/prisma/prisma.service';
export declare class WarehouseController {
    private readonly service;
    private readonly prisma;
    constructor(service: WarehouseService, prisma: PrismaService);
    create(req: any, body: CreateWarehouseInput): Promise<{
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
    findAll(req: any, search?: string, page?: string, limit?: string): Promise<{
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
    findOne(uuid: string, req: any): Promise<{
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
    update(uuid: string, req: any, body: UpdateWarehouseInput): Promise<{
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
    remove(uuid: string, req: any): Promise<{
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

import { WarehouseService } from './warehouse.service';
import type { CreateWarehouseInput, UpdateWarehouseInput } from '@bulog-wms/schema';
import { PrismaService } from '../../core/prisma/prisma.service';
export declare class WarehouseController {
    private readonly service;
    private readonly prisma;
    constructor(service: WarehouseService, prisma: PrismaService);
    create(req: any, body: CreateWarehouseInput): Promise<{
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
    }>;
    findAll(req: any, search?: string, page?: string, limit?: string): Promise<{
        data: {
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
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findOne(uuid: string, req: any): Promise<{
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
    }>;
    update(uuid: string, req: any, body: UpdateWarehouseInput): Promise<{
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
    }>;
    remove(uuid: string, req: any): Promise<{
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
    }>;
}

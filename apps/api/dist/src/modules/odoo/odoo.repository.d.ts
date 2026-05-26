import { PrismaService } from '../../core/prisma/prisma.service';
import type { Prisma } from '@prisma/client';
export declare class OdooRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<({
        warehouse: {
            uuid: string;
            name: string;
        };
    } & {
        uuid: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
    })[]>;
    findActiveAccounts(): Promise<({
        warehouse: {
            name: string;
        };
    } & {
        uuid: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
    })[]>;
    findByUuid(uuid: string): Promise<({
        warehouse: {
            uuid: string;
            name: string;
        };
    } & {
        uuid: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
    }) | null>;
    findByWarehouseId(warehouseId: number): Promise<{
        uuid: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
    } | null>;
    findById(id: number): Promise<({
        warehouse: {
            name: string;
        };
    } & {
        uuid: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
    }) | null>;
    create(data: Prisma.OdooAccountUncheckedCreateInput): Promise<{
        warehouse: {
            name: string;
        };
    } & {
        uuid: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
    }>;
    update(uuid: string, data: Prisma.OdooAccountUpdateInput): Promise<{
        warehouse: {
            name: string;
        };
    } & {
        uuid: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
    }>;
    updateSessionData(id: number, sessionDetails: {
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt?: Date;
        lastRefreshAt?: Date;
    }): Promise<{
        uuid: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
    }>;
    delete(uuid: string): Promise<{
        uuid: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
    }>;
}

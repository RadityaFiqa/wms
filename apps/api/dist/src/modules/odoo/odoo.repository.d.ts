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
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
        lastSyncAt: Date | null;
        lastSyncBy: string | null;
        lastSyncCount: number | null;
        lastSyncError: string | null;
        lastSyncStatus: string | null;
    })[]>;
    findActiveAccounts(): Promise<({
        warehouse: {
            name: string;
        };
    } & {
        uuid: string;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
        lastSyncAt: Date | null;
        lastSyncBy: string | null;
        lastSyncCount: number | null;
        lastSyncError: string | null;
        lastSyncStatus: string | null;
    })[]>;
    findByUuid(uuid: string): Promise<({
        warehouse: {
            uuid: string;
            name: string;
        };
    } & {
        uuid: string;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
        lastSyncAt: Date | null;
        lastSyncBy: string | null;
        lastSyncCount: number | null;
        lastSyncError: string | null;
        lastSyncStatus: string | null;
    }) | null>;
    findByWarehouseId(warehouseId: number): Promise<{
        uuid: string;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
        lastSyncAt: Date | null;
        lastSyncBy: string | null;
        lastSyncCount: number | null;
        lastSyncError: string | null;
        lastSyncStatus: string | null;
    } | null>;
    findById(id: number): Promise<({
        warehouse: {
            name: string;
        };
    } & {
        uuid: string;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
        lastSyncAt: Date | null;
        lastSyncBy: string | null;
        lastSyncCount: number | null;
        lastSyncError: string | null;
        lastSyncStatus: string | null;
    }) | null>;
    create(data: Prisma.OdooAccountUncheckedCreateInput): Promise<{
        warehouse: {
            name: string;
        };
    } & {
        uuid: string;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
        lastSyncAt: Date | null;
        lastSyncBy: string | null;
        lastSyncCount: number | null;
        lastSyncError: string | null;
        lastSyncStatus: string | null;
    }>;
    update(uuid: string, data: Prisma.OdooAccountUpdateInput): Promise<{
        warehouse: {
            name: string;
        };
    } & {
        uuid: string;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
        lastSyncAt: Date | null;
        lastSyncBy: string | null;
        lastSyncCount: number | null;
        lastSyncError: string | null;
        lastSyncStatus: string | null;
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
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
        lastSyncAt: Date | null;
        lastSyncBy: string | null;
        lastSyncCount: number | null;
        lastSyncError: string | null;
        lastSyncStatus: string | null;
    }>;
    delete(uuid: string): Promise<{
        uuid: string;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        warehouseId: number;
        baseUrl: string;
        username: string;
        encryptedPassword: string;
        sessionId: string | null;
        csrfToken: string | null;
        sessionExpiredAt: Date | null;
        lastLoginAt: Date | null;
        lastRefreshAt: Date | null;
        lastSyncAt: Date | null;
        lastSyncBy: string | null;
        lastSyncCount: number | null;
        lastSyncError: string | null;
        lastSyncStatus: string | null;
    }>;
}

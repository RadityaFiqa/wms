import { Ability } from '@casl/ability';
import { PrismaQuery, Subjects } from '@casl/prisma';
import { User, Role, Permission } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
type ExtendedSubjects = Subjects<{
    User: User;
    Role: Role;
    Permission: Permission;
    Warehouse: any;
    Product: any;
    Inventory: any;
    Order: any;
    OrderItem: any;
    AuditLog: any;
    OdooAccount: any;
    GateOperation: any;
    GateVerification: any;
    FileAttachment: any;
    DocumentReference: any;
    DocumentReferenceItem: any;
}> | 'all';
export type AppAbility = Ability<[string, ExtendedSubjects], PrismaQuery>;
export declare class CaslAbilityFactory {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createForUser(user: User & {
        role: Role & {
            permissions: {
                permission: Permission;
            }[];
        };
    }): Promise<AppAbility>;
}
export {};

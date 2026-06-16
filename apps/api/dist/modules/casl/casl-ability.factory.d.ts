import { Ability } from '@casl/ability';
import { PrismaQuery, Subjects } from '@casl/prisma';
import { User, Role, Permission } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
type ExtendedSubjects = Subjects<{
    User: User;
    Role: Role;
    Permission: Permission;
    Warehouse: any;
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
    StockOpname: any;
    Reconciliation: any;
    Report: any;
    SignatureTemplate: any;
    ManualDocument: any;
    SignedDocument: any;
    DocumentCategory: any;
    DocumentVerificationLog: any;
    SignatureAuditLog: any;
    UserSignature: any;
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

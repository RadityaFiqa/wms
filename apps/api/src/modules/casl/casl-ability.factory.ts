import { Ability, AbilityBuilder } from '@casl/ability';
import { createPrismaAbility, PrismaQuery, Subjects } from '@casl/prisma';
import { Injectable } from '@nestjs/common';
import { User, Role, Permission } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';

type ExtendedSubjects =
  | Subjects<{
      User: User;
      Role: Role;
      Permission: Permission;
      Warehouse: any;
      Inventory: any;
      AuditLog: any;
      OdooAccount: any;
      GateOperation: any;
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
      UserSignature: any;
    }>
  | 'all';

export type AppAbility = Ability<[string, ExtendedSubjects], PrismaQuery>;

@Injectable()
export class CaslAbilityFactory {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(
    user: User & { role: Role & { permissions: { permission: Permission }[] } },
  ): Promise<AppAbility> {
    const { can, build } = new AbilityBuilder<AppAbility>(
      createPrismaAbility as any,
    );

    // Allow users to manage their own signatures
    can('manage', 'UserSignature', { userId: user.id } as any);

    const rolePermissions = user.role?.permissions || [];

    for (const rp of rolePermissions) {
      const { action, subject, conditions } = rp.permission;

      let parsedConditions = undefined;
      if (conditions) {
        try {
          parsedConditions = JSON.parse(conditions);
        } catch (e) {
          console.error(
            `Failed to parse conditions for permission id ${rp.permission.id}`,
            e,
          );
        }
      }

      can(action, subject as any, parsedConditions);
    }

    return build({
      detectSubjectType: (item) => item.constructor as any,
    });
  }
}

import { Ability, AbilityBuilder } from '@casl/ability';
import { createPrismaAbility, PrismaQuery, Subjects } from '@casl/prisma';
import { Injectable } from '@nestjs/common';
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
}> | 'all';

export type AppAbility = Ability<[string, ExtendedSubjects], PrismaQuery>;

@Injectable()
export class CaslAbilityFactory {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(user: User & { role: Role & { permissions: { permission: Permission }[] } }): Promise<AppAbility> {
    const { can, build } = new AbilityBuilder<AppAbility>(createPrismaAbility as any);

    const rolePermissions = user.role?.permissions || [];
    
    for (const rp of rolePermissions) {
      const { action, subject, conditions } = rp.permission;
      
      let parsedConditions = undefined;
      if (conditions) {
        try {
          parsedConditions = JSON.parse(conditions);
        } catch (e) {
          console.error(`Failed to parse conditions for permission id ${rp.permission.id}`, e);
        }
      }

      can(action, subject as any, parsedConditions);
    }

    return build({
      detectSubjectType: (item) => item.constructor as any,
    });
  }
}

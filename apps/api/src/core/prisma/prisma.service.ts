import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { WarehouseContextService } from '../warehouse-context/warehouse-context.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private pool: Pool;

  constructor(
    private readonly warehouseContextService: WarehouseContextService,
  ) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;

    const baseClient = this;
    const extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const warehouseId = warehouseContextService.getWarehouseId();
            if (warehouseId === undefined) {
              return query(args);
            }

            let op = operation;
            const currentArgs = args as any;

            const operationsToScope = [
              'findFirst',
              'findFirstOrThrow',
              'findMany',
              'count',
              'update',
              'updateMany',
              'delete',
              'deleteMany',
              'upsert',
            ];

            if (op === 'findUnique' || op === 'findUniqueOrThrow') {
              const targetOp =
                op === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
              currentArgs.where = currentArgs.where || {};
              if (model === 'Warehouse') {
                currentArgs.where.id = warehouseId;
              } else if (['Inventory', 'OdooAccount', 'User', 'AuditLog', 'DocumentTemplate', 'DocumentGenerated'].includes(model)) {
                currentArgs.where.warehouseId = warehouseId;
              }
              return (baseClient as any)[model][targetOp](currentArgs);
            }

            if (operationsToScope.includes(op)) {
              currentArgs.where = currentArgs.where || {};
              if (model === 'Warehouse') {
                currentArgs.where.id = warehouseId;
              } else if (['Inventory', 'OdooAccount', 'User', 'AuditLog', 'DocumentTemplate', 'DocumentGenerated'].includes(model)) {
                currentArgs.where.warehouseId = warehouseId;
              }
            } else if (op === 'create') {
              if (['Inventory', 'OdooAccount', 'User', 'AuditLog', 'DocumentTemplate', 'DocumentGenerated'].includes(model)) {
                currentArgs.data = currentArgs.data || {};
                if (
                  currentArgs.data.warehouseId === undefined ||
                  currentArgs.data.warehouseId === null
                ) {
                  currentArgs.data.warehouseId = warehouseId;
                }
              }
            }

            if (op === 'upsert') {
              currentArgs.create = currentArgs.create || {};
              currentArgs.update = currentArgs.update || {};
              if (['Inventory', 'OdooAccount', 'User', 'AuditLog', 'DocumentTemplate', 'DocumentGenerated'].includes(model)) {
                if (
                  currentArgs.create.warehouseId === undefined ||
                  currentArgs.create.warehouseId === null
                ) {
                  currentArgs.create.warehouseId = warehouseId;
                }
                if (
                  currentArgs.update.warehouseId === undefined ||
                  currentArgs.update.warehouseId === null
                ) {
                  currentArgs.update.warehouseId = warehouseId;
                }
              }
            }

            return query(currentArgs);
          },
        },
      },
    });

    return extendedClient as any;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}

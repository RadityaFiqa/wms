"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const warehouse_context_service_1 = require("../warehouse-context/warehouse-context.service");
let PrismaService = class PrismaService extends client_1.PrismaClient {
    warehouseContextService;
    pool;
    constructor(warehouseContextService) {
        const pool = new pg_1.Pool({
            connectionString: process.env.DATABASE_URL,
        });
        const adapter = new adapter_pg_1.PrismaPg(pool);
        super({ adapter });
        this.warehouseContextService = warehouseContextService;
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
                        const currentArgs = args;
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
                            const targetOp = op === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
                            currentArgs.where = currentArgs.where || {};
                            if (model === 'Warehouse') {
                                currentArgs.where.id = warehouseId;
                            }
                            else if (['Inventory', 'OdooAccount', 'User'].includes(model)) {
                                currentArgs.where.warehouseId = warehouseId;
                            }
                            return baseClient[model][targetOp](currentArgs);
                        }
                        if (operationsToScope.includes(op)) {
                            currentArgs.where = currentArgs.where || {};
                            if (model === 'Warehouse') {
                                currentArgs.where.id = warehouseId;
                            }
                            else if (['Inventory', 'OdooAccount', 'User'].includes(model)) {
                                currentArgs.where.warehouseId = warehouseId;
                            }
                        }
                        else if (op === 'create') {
                            if (['Inventory', 'OdooAccount', 'User'].includes(model)) {
                                currentArgs.data = currentArgs.data || {};
                                if (currentArgs.data.warehouseId === undefined ||
                                    currentArgs.data.warehouseId === null) {
                                    currentArgs.data.warehouseId = warehouseId;
                                }
                            }
                        }
                        if (op === 'upsert') {
                            currentArgs.create = currentArgs.create || {};
                            currentArgs.update = currentArgs.update || {};
                            if (['Inventory', 'OdooAccount', 'User'].includes(model)) {
                                if (currentArgs.create.warehouseId === undefined ||
                                    currentArgs.create.warehouseId === null) {
                                    currentArgs.create.warehouseId = warehouseId;
                                }
                                if (currentArgs.update.warehouseId === undefined ||
                                    currentArgs.update.warehouseId === null) {
                                    currentArgs.update.warehouseId = warehouseId;
                                }
                            }
                        }
                        return query(currentArgs);
                    },
                },
            },
        });
        return extendedClient;
    }
    async onModuleInit() {
        await this.$connect();
    }
    async onModuleDestroy() {
        await this.$disconnect();
        await this.pool.end();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [warehouse_context_service_1.WarehouseContextService])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map
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
exports.ReconciliationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/prisma/prisma.service");
let ReconciliationService = class ReconciliationService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getReconciliationList(warehouseId) {
        const inventories = await this.prisma.inventory.findMany({
            include: {
                quants: {
                    where: {
                        location: { warehouseId },
                    },
                },
            },
        });
        const activeGateOperations = await this.prisma.gateOperation.findMany({
            where: {
                warehouseId,
                status: {
                    notIn: ['CANCELED', 'REJECTED'],
                },
            },
            include: {
                products: true,
                verification: {
                    include: {
                        references: true,
                    },
                },
            },
        });
        const pendingOps = activeGateOperations.filter((op) => {
            const hasPoRef = op.cardType === 'IN' && op.poReferences && op.poReferences.length > 0;
            const hasSoRef = op.cardType === 'OUT' && op.soReferences && op.soReferences.length > 0;
            if (hasPoRef || hasSoRef)
                return false;
            const hasErpAssignments = op.verification && op.verification.references && op.verification.references.length > 0;
            if (hasErpAssignments)
                return false;
            return true;
        });
        const pendingQuantitiesMap = new Map();
        for (const op of pendingOps) {
            const isOut = op.cardType === 'OUT';
            for (const opProd of op.products) {
                const invId = opProd.inventoryId;
                const current = pendingQuantitiesMap.get(invId) || { incoming: 0, outgoing: 0 };
                if (isOut) {
                    current.outgoing += opProd.quantity;
                }
                else {
                    current.incoming += opProd.quantity;
                }
                pendingQuantitiesMap.set(invId, current);
            }
        }
        const reconciliationRows = inventories.map((inv) => {
            const pending = pendingQuantitiesMap.get(inv.id) || { incoming: 0, outgoing: 0 };
            const erpStock = inv.quants.reduce((sum, q) => sum + q.quantity, 0);
            const pendingGateQty = pending.outgoing - pending.incoming;
            const expectedStock = erpStock - pendingGateQty;
            return {
                product: {
                    uuid: inv.uuid,
                    sku: inv.sku,
                    name: inv.name,
                    uom: inv.uom || 'Unit',
                },
                erpStock,
                pendingGateQty,
                pendingIncoming: pending.incoming,
                pendingOutgoing: pending.outgoing,
                expectedStock,
            };
        });
        return reconciliationRows
            .filter((row) => row.erpStock > 0 || row.pendingIncoming > 0 || row.pendingOutgoing > 0)
            .sort((a, b) => a.product.name.localeCompare(b.product.name));
    }
    async getReconciliationDetail(warehouseId, inventoryUuid) {
        const inventory = await this.prisma.inventory.findUnique({
            where: { uuid: inventoryUuid },
            include: {
                quants: {
                    where: {
                        location: {
                            warehouseId,
                        },
                    },
                    include: {
                        location: true,
                    },
                },
            },
        });
        if (!inventory) {
            throw new common_1.NotFoundException('Produk tidak ditemukan.');
        }
        const erpStock = inventory.quants.reduce((sum, q) => sum + q.quantity, 0);
        const erpStockSource = inventory.quants.map((q) => ({
            locationName: q.location.displayName,
            lotName: q.lotName || '-',
            quantity: q.quantity,
            reservedQuantity: q.reservedQuantity,
            availableQuantity: q.availableQuantity,
        }));
        const activeGateOperations = await this.prisma.gateOperation.findMany({
            where: {
                warehouseId,
                status: {
                    notIn: ['CANCELED', 'REJECTED'],
                },
                products: {
                    some: {
                        inventoryId: inventory.id,
                    },
                },
            },
            include: {
                products: {
                    where: {
                        inventoryId: inventory.id,
                    },
                },
                verification: {
                    include: {
                        references: true,
                    },
                },
            },
        });
        const pendingGateOperations = activeGateOperations
            .filter((op) => {
            const hasPoRef = op.cardType === 'IN' && op.poReferences && op.poReferences.length > 0;
            const hasSoRef = op.cardType === 'OUT' && op.soReferences && op.soReferences.length > 0;
            if (hasPoRef || hasSoRef)
                return false;
            const hasErpAssignments = op.verification && op.verification.references && op.verification.references.length > 0;
            if (hasErpAssignments)
                return false;
            return true;
        })
            .map((op) => {
            const qty = op.products[0]?.quantity || 0;
            return {
                uuid: op.uuid,
                opNumber: op.opNumber,
                cardType: op.cardType,
                driverName: op.driverName,
                licensePlate: op.licensePlate,
                createdAt: op.createdAt,
                quantity: qty,
            };
        });
        const pendingIncoming = pendingGateOperations
            .filter((op) => op.cardType === 'IN')
            .reduce((sum, op) => sum + op.quantity, 0);
        const pendingOutgoing = pendingGateOperations
            .filter((op) => op.cardType === 'OUT')
            .reduce((sum, op) => sum + op.quantity, 0);
        const pendingGateQty = pendingOutgoing - pendingIncoming;
        const expectedStock = erpStock - pendingGateQty;
        return {
            product: {
                uuid: inventory.uuid,
                sku: inventory.sku,
                name: inventory.name,
                uom: inventory.uom || 'Unit',
            },
            erpStock,
            erpStockSource,
            pendingGateOperations,
            pendingIncoming,
            pendingOutgoing,
            pendingGateQty,
            expectedStock,
        };
    }
};
exports.ReconciliationService = ReconciliationService;
exports.ReconciliationService = ReconciliationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReconciliationService);
//# sourceMappingURL=reconciliation.service.js.map
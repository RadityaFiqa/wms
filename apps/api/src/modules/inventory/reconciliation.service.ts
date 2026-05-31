import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates ERP Stock reconciliation for all products in the active warehouse.
   */
  async getReconciliationList(warehouseId: number) {
    // 1. Get all inventories (ERP stock) for this warehouse
    const inventories = await this.prisma.inventory.findMany({
      where: { warehouseId },
      include: {
        product: true,
      },
    });

    // 2. Fetch active gate operations for this warehouse (excluding canceled/rejected)
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

    // 3. Filter for unreconciled gate operations in memory
    const pendingOps = activeGateOperations.filter((op) => {
      // Must not be assigned to any PO (for IN) or SO (for OUT)
      const hasPoRef = op.cardType === 'IN' && op.poReferences && op.poReferences.length > 0;
      const hasSoRef = op.cardType === 'OUT' && op.soReferences && op.soReferences.length > 0;
      if (hasPoRef || hasSoRef) return false;

      // Must not be assigned to any ERP reference document
      const hasErpAssignments = op.verification && op.verification.references && op.verification.references.length > 0;
      if (hasErpAssignments) return false;

      return true;
    });

    // 4. Map unassigned quantities by product
    const pendingQuantitiesMap = new Map<number, { incoming: number; outgoing: number }>();
    for (const op of pendingOps) {
      const isOut = op.cardType === 'OUT';
      for (const opProd of op.products) {
        const prodId = opProd.productId;
        const current = pendingQuantitiesMap.get(prodId) || { incoming: 0, outgoing: 0 };
        if (isOut) {
          current.outgoing += opProd.quantity;
        } else {
          current.incoming += opProd.quantity;
        }
        pendingQuantitiesMap.set(prodId, current);
      }
    }

    // 5. Combine inventory stock and pending gate operations
    const reconciliationRows = inventories.map((inv) => {
      const prod = inv.product;
      const pending = pendingQuantitiesMap.get(prod.id) || { incoming: 0, outgoing: 0 };
      
      // Expected Stock = ERP Stock - Pending Gate Operation Quantity
      // Where Pending Gate Operation Quantity = Outgoing - Incoming
      const pendingGateQty = pending.outgoing - pending.incoming;
      const expectedStock = inv.quantity - pendingGateQty;

      return {
        product: {
          uuid: prod.uuid,
          sku: prod.sku,
          name: prod.name,
          category: prod.category,
          uom: prod.uom || 'Unit',
        },
        erpStock: inv.quantity,
        pendingGateQty,
        pendingIncoming: pending.incoming,
        pendingOutgoing: pending.outgoing,
        expectedStock,
      };
    });

    // Also include products that might only exist in pending gate operations but not in inventory table
    const inventoryProductIds = new Set(inventories.map((i) => i.productId));
    const allProducts = await this.prisma.product.findMany();
    
    for (const [prodId, pending] of pendingQuantitiesMap.entries()) {
      if (!inventoryProductIds.has(prodId)) {
        const prod = allProducts.find((p) => p.id === prodId);
        if (prod) {
          const pendingGateQty = pending.outgoing - pending.incoming;
          const expectedStock = 0 - pendingGateQty;
          
          reconciliationRows.push({
            product: {
              uuid: prod.uuid,
              sku: prod.sku,
              name: prod.name,
              category: prod.category,
              uom: prod.uom || 'Unit',
            },
            erpStock: 0,
            pendingGateQty,
            pendingIncoming: pending.incoming,
            pendingOutgoing: pending.outgoing,
            expectedStock,
          });
        }
      }
    }

    // Sort by product name
    return reconciliationRows.sort((a, b) => a.product.name.localeCompare(b.product.name));
  }

  /**
   * Get detail reconciliation and drill down sources for a single product.
   */
  async getReconciliationDetail(warehouseId: number, productUuid: string) {
    const product = await this.prisma.product.findUnique({
      where: { uuid: productUuid },
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
        inventories: {
          where: {
            warehouseId,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Produk tidak ditemukan.');
    }

    const erpStock = product.inventories[0]?.quantity || 0;

    // ERP Stock breakdown (locations)
    const erpStockSource = product.quants.map((q) => ({
      locationName: q.location.displayName,
      lotName: q.lotName || '-',
      quantity: q.quantity,
      reservedQuantity: q.reservedQuantity,
      availableQuantity: q.availableQuantity,
    }));

    // Find contributing gate operations
    const activeGateOperations = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: {
          notIn: ['CANCELED', 'REJECTED'],
        },
        products: {
          some: {
            productId: product.id,
          },
        },
      },
      include: {
        products: {
          where: {
            productId: product.id,
          },
        },
        verification: {
          include: {
            references: true,
          },
        },
      },
    });

    // Filter unreconciled gate operations in memory
    const pendingGateOperations = activeGateOperations
      .filter((op) => {
        const hasPoRef = op.cardType === 'IN' && op.poReferences && op.poReferences.length > 0;
        const hasSoRef = op.cardType === 'OUT' && op.soReferences && op.soReferences.length > 0;
        if (hasPoRef || hasSoRef) return false;

        const hasErpAssignments = op.verification && op.verification.references && op.verification.references.length > 0;
        if (hasErpAssignments) return false;

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
        uuid: product.uuid,
        sku: product.sku,
        name: product.name,
        category: product.category,
        uom: product.uom || 'Unit',
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
}

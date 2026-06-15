import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates ERP Stock reconciliation for all products in the active warehouse.
   */
  async getReconciliationList(warehouseId: number) {
    // 1. Get all inventories (product catalog) and their quants in this warehouse
    const inventories = await this.prisma.inventory.findMany({
      include: {
        quants: {
          where: {
            location: { warehouseId },
          },
        },
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

    // 4. Map unassigned quantities by product (inventoryId)
    const pendingQuantitiesMap = new Map<number, { incoming: number; outgoing: number }>();
    for (const op of pendingOps) {
      const isOut = op.cardType === 'OUT';
      for (const opProd of op.products) {
        const invId = opProd.inventoryId;
        const current = pendingQuantitiesMap.get(invId) || { incoming: 0, outgoing: 0 };
        if (isOut) {
          current.outgoing += opProd.quantity;
        } else {
          current.incoming += opProd.quantity;
        }
        pendingQuantitiesMap.set(invId, current);
      }
    }

    // 5. Combine inventory stock and pending gate operations
    const reconciliationRows = inventories.map((inv) => {
      const pending = pendingQuantitiesMap.get(inv.id) || { incoming: 0, outgoing: 0 };
      const erpStock = inv.quants.reduce((sum, q) => sum + q.quantity, 0);
      
      // Expected Stock = ERP Stock - Pending Gate Operation Quantity
      // Where Pending Gate Operation Quantity = Outgoing - Incoming
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

    // Filter to return only products with active stock or pending gate activity
    return reconciliationRows
      .filter((row) => row.erpStock > 0 || row.pendingIncoming > 0 || row.pendingOutgoing > 0)
      .sort((a, b) => a.product.name.localeCompare(b.product.name));
  }

  /**
   * Get detail reconciliation and drill down sources for a single product.
   */
  async getReconciliationDetail(warehouseId: number, inventoryUuid: string) {
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
      throw new NotFoundException('Produk tidak ditemukan.');
    }

    const erpStock = inventory.quants.reduce((sum, q) => sum + q.quantity, 0);

    // ERP Stock breakdown (locations)
    const erpStockSource = inventory.quants.map((q) => ({
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
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates ERP Stock reconciliation for all products in the active warehouse.
   */
  async getReconciliationList(
    warehouseId: number,
    query?: { productId?: string; locationId?: string },
  ) {
    let locationDbId: number | undefined;
    if (query?.locationId) {
      const loc = await this.prisma.location.findFirst({
        where: {
          uuid: query.locationId,
          warehouseId,
        },
      });
      if (loc) {
        locationDbId = loc.id;
      } else {
        return [];
      }
    }

    // 1. Get inventories (catalog) matching productId if provided
    const inventories = await this.prisma.inventory.findMany({
      where: {
        ...(query?.productId ? { uuid: query.productId } : {}),
      },
      include: {
        quants: {
          where: {
            location: {
              warehouseId,
              ...(locationDbId ? { id: locationDbId } : {}),
            },
          },
        },
      },
    });

    // 2. Fetch active gate operations contributing to the discrepancy
    const activeGateOperations = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: {
          notIn: ['CANCELED', 'REJECTED'],
        },
        OR: [
          { documentReferenceId: null },
          {
            documentReference: {
              state: { not: 'done' },
            },
          },
        ],
        products: {
          some: {
            ...(query?.productId ? { inventory: { uuid: query.productId } } : {}),
            ...(locationDbId ? { locationId: locationDbId } : {}),
          },
        },
      },
      include: {
        products: {
          where: {
            ...(query?.productId ? { inventory: { uuid: query.productId } } : {}),
            ...(locationDbId ? { locationId: locationDbId } : {}),
          },
        },
      },
    });

    // Collect all related products
    const relatedProductIds = new Set<number>();
    for (const op of activeGateOperations) {
      for (const p of op.products) {
        relatedProductIds.add(p.inventoryId);
      }
    }

    // 3. Map unassigned quantities by product
    const pendingQuantitiesMap = new Map<
      number,
      { incoming: number; outgoing: number }
    >();

    for (const op of activeGateOperations) {
      const isOut = op.cardType === 'OUT';
      for (const opProd of op.products) {
        const invId = opProd.inventoryId;
        const current = pendingQuantitiesMap.get(invId) || {
          incoming: 0,
          outgoing: 0,
        };
        if (isOut) {
          current.outgoing += opProd.quantity;
        } else {
          current.incoming += opProd.quantity;
        }
        pendingQuantitiesMap.set(invId, current);
      }
    }

    // 4. Combine and calculate metrics
    const reconciliationRows = inventories.map((inv) => {
      const pending = pendingQuantitiesMap.get(inv.id) || {
        incoming: 0,
        outgoing: 0,
      };
      const erpStock = inv.quants.reduce((sum, q) => sum + q.quantity, 0);

      // physicalAdjustment = incoming - outgoing
      const physicalAdjustment = pending.incoming - pending.outgoing;
      const calculatedPhysical = erpStock + physicalAdjustment;
      const stockDifference = erpStock - calculatedPhysical;

      // Backward compatibility fields
      const pendingGateQty = pending.outgoing - pending.incoming;
      const expectedStock = erpStock - pendingGateQty;

      return {
        productId: inv.id,
        product: {
          uuid: inv.uuid,
          sku: inv.sku,
          name: inv.name,
          uom: inv.uom || 'Unit',
        },
        erpStock,
        physicalAdjustment,
        calculatedPhysical,
        stockDifference,
        pendingIncoming: pending.incoming,
        pendingOutgoing: pending.outgoing,
        pendingGateQty,
        expectedStock,
      };
    });

    return reconciliationRows
      .filter(
        (row) =>
          row.erpStock > 0 ||
          relatedProductIds.has(row.productId),
      )
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

    // Get all locations in the warehouse to map details
    const dbLocations = await this.prisma.location.findMany({
      where: { warehouseId },
    });
    const locationsMap = new Map<number, typeof dbLocations[number]>(
      dbLocations.map((l) => [l.id, l]),
    );

    // Fetch active contributing gate operations for this product
    const contributingGateOps = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: {
          notIn: ['CANCELED', 'REJECTED'],
        },
        OR: [
          { documentReferenceId: null },
          {
            documentReference: {
              state: { not: 'done' },
            },
          },
        ],
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
          include: {
            location: true,
          },
        },
        documentReference: true,
      },
    });

    // Identify all unique locations for this product (having quants or contributing gate operations)
    const uniqueLocationIds = new Set<number>();
    for (const q of inventory.quants) {
      uniqueLocationIds.add(q.locationId);
    }
    for (const op of contributingGateOps) {
      for (const p of op.products) {
        if (p.locationId) {
          uniqueLocationIds.add(p.locationId);
        }
      }
    }

    // Group contributing gate operations by location
    const opsByLocationMap = new Map<number, any[]>();
    for (const op of contributingGateOps) {
      for (const p of op.products) {
        if (!p.locationId) continue;
        const list = opsByLocationMap.get(p.locationId) || [];
        list.push({
          uuid: op.uuid,
          opNumber: op.opNumber,
          cardType: op.cardType,
          driverName: op.driverName,
          licensePlate: op.licensePlate,
          createdAt: op.createdAt,
          quantity: p.quantity,
          documentNumber: op.documentReference?.documentNumber || '-',
          documentState: op.documentReference?.state || null,
        });
        opsByLocationMap.set(p.locationId, list);
      }
    }

    // Calculate details for each location
    const locationsBreakdown = Array.from(uniqueLocationIds).map((locId) => {
      const loc = locationsMap.get(locId);
      const erpQty = inventory.quants
        .filter((q) => q.locationId === locId)
        .reduce((sum, q) => sum + q.quantity, 0);

      const gateOpsList = opsByLocationMap.get(locId) || [];

      // Calculate physical adjustment
      let pendingIncoming = 0;
      let pendingOutgoing = 0;
      for (const op of gateOpsList) {
        if (op.cardType === 'IN') {
          pendingIncoming += op.quantity;
        } else {
          pendingOutgoing += op.quantity;
        }
      }

      const physicalAdjustment = pendingIncoming - pendingOutgoing;
      const calculatedPhysical = erpQty + physicalAdjustment;
      const stockDifference = erpQty - calculatedPhysical;

      return {
        locationId: locId,
        locationUuid: loc?.uuid || '',
        locationName: loc?.displayName || `Lokasi #${locId}`,
        erpQty,
        physicalAdjustment,
        calculatedPhysical,
        stockDifference,
        pendingIncoming,
        pendingOutgoing,
        gateOperations: gateOpsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      };
    });

    const totalErpStock = inventory.quants.reduce((sum, q) => sum + q.quantity, 0);
    let totalIncoming = 0;
    let totalOutgoing = 0;
    for (const op of contributingGateOps) {
      const isOut = op.cardType === 'OUT';
      for (const p of op.products) {
        if (isOut) {
          totalOutgoing += p.quantity;
        } else {
          totalIncoming += p.quantity;
        }
      }
    }

    const physicalAdjustment = totalIncoming - totalOutgoing;
    const calculatedPhysical = totalErpStock + physicalAdjustment;
    const stockDifference = totalErpStock - physicalAdjustment;

    const pendingGateQty = totalOutgoing - totalIncoming;
    const expectedStock = totalErpStock - pendingGateQty;

    return {
      product: {
        uuid: inventory.uuid,
        sku: inventory.sku,
        name: inventory.name,
        uom: inventory.uom || 'Unit',
      },
      erpStock: totalErpStock,
      physicalAdjustment,
      calculatedPhysical,
      stockDifference,
      pendingGateQty,
      expectedStock,
      locations: locationsBreakdown.sort((a, b) => a.locationName.localeCompare(b.locationName)),
    };
  }
}

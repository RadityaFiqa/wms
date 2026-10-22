import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import PDFDocument from 'pdfkit';
import { WarehouseContextService } from '../../core/warehouse-context/warehouse-context.service';
import {
  getLocalStartOfDay,
  getLocalEndOfDay,
  formatDateInTimezone,
} from '@/core/utils/date';
import type { Prisma } from '@prisma/client';

const ACTIVE_GATE_STATUSES: Prisma.EnumVerificationStatusFilter['in'] = [
  'PENDING',
  'VERIFIED',
];

// A done ERP document is "independent" only when no active gate operation is linked to it
// through any relation (legacy FK, per-product link or junction table); otherwise its
// movement is already counted through the gate operation.
const NO_ACTIVE_GATE_OPERATION = {
  gateOperations: { none: { status: { in: ACTIVE_GATE_STATUSES } } },
  operationProducts: {
    none: { gateOperation: { status: { in: ACTIVE_GATE_STATUSES } } },
  },
  gateOperationLinks: {
    none: { gateOperation: { status: { in: ACTIVE_GATE_STATUSES } } },
  },
} satisfies Prisma.DocumentReferenceWhereInput;

type MoveLineDocument = {
  documentNumber: string;
  pickingTypeCode: string;
  state: string;
  moveLines?: {
    documentReferenceItemId: number;
    inventoryId: number;
    sourceLocationId: number | null;
    destinationLocationId: number | null;
    pickingName: string | null;
    quantity: number;
  }[];
};

type MoveLineAllocation = {
  locationId: number;
  qty: number;
  referenceDocument: string;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  private distributeAdjustment(
    adjustment: number,
    locations: { id: number; qty: number }[],
  ): Map<number, number> {
    const result = new Map<number, number>();
    if (locations.length === 0) return result;

    const totalQty = locations.reduce((sum, loc) => sum + loc.qty, 0);
    if (totalQty === 0) {
      let remaining = adjustment;
      for (let i = 0; i < locations.length; i++) {
        const loc = locations[i];
        if (i === locations.length - 1) {
          result.set(loc.id, remaining);
        } else {
          const share = Math.round(adjustment / locations.length);
          result.set(loc.id, share);
          remaining -= share;
        }
      }
      return result;
    }

    let distributedSum = 0;
    const shares = locations.map((loc) => {
      const exactShare = (adjustment * loc.qty) / totalQty;
      const roundedShare = Math.round(exactShare);
      distributedSum += roundedShare;
      return { id: loc.id, qty: loc.qty, roundedShare, exactShare };
    });

    const difference = adjustment - distributedSum;
    if (difference !== 0) {
      shares.sort((a, b) => {
        const remA = a.exactShare - a.roundedShare;
        const remB = b.exactShare - b.roundedShare;
        return difference > 0 ? remB - remA : remA - remB;
      });

      const step = difference > 0 ? 1 : -1;
      for (let i = 0; i < Math.abs(difference); i++) {
        const index = i % shares.length;
        shares[index].roundedShare += step;
      }
    }

    for (const s of shares) {
      result.set(s.id, s.roundedShare);
    }

    return result;
  }

  /**
   * Generates Daily Stock Movement Report rows for a date range and warehouse.
   */
  async getDailyStockMovementReport(
    warehouseId: number,
    query: {
      startDate: string;
      endDate: string;
      productId?: string;
    },
  ) {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('Start date dan End date harus diisi.');
    }

    const timezone = this.warehouseContext.getTimezone();
    const start = getLocalStartOfDay(query.startDate, timezone);
    const end = getLocalEndOfDay(query.endDate, timezone);

    if (start > end) {
      throw new BadRequestException('Start date tidak boleh setelah End date.');
    }

    // Today in local timezone end of day
    const todayStr = formatDateInTimezone(new Date(), timezone);
    const today = getLocalEndOfDay(todayStr, timezone);

    // Warehouse locations (move line stacks are only used when they map to one of these)
    const dbLocations = await this.prisma.location.findMany({
      where: { warehouseId },
    });
    const dbLocationIds = new Set(dbLocations.map((l) => l.id));

    // 1. Fetch pending and verified Gate Operations from start date until TODAY
    const gateOps = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: { in: ['PENDING', 'VERIFIED'] },
        OR: [
          {
            cardType: 'OUT',
            createdAt: {
              gte: start,
              lte: today,
            },
          },
          {
            cardType: 'IN',
            OR: [
              {
                verifiedAt: {
                  gte: start,
                  lte: today,
                },
              },
              {
                verifiedAt: null,
                createdAt: {
                  gte: start,
                  lte: today,
                },
              },
            ],
          },
        ],
      },
      include: {
        products: {
          include: {
            documentReference: { include: { moveLines: true } },
          },
        },
        documentReference: { include: { moveLines: true } },
        documentReferences: {
          include: {
            documentReference: { include: { moveLines: true } },
          },
        },
      },
    });

    // 1b. Fetch all active pending/unreconciled Gate Operations in this warehouse as of today to compute current real stock
    const activePendingOps = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: { in: ['PENDING', 'VERIFIED'] },
      },
      include: {
        products: {
          include: {
            documentReference: { include: { moveLines: true } },
          },
        },
        documentReference: { include: { moveLines: true } },
        documentReferences: {
          include: {
            documentReference: { include: { moveLines: true } },
          },
        },
      },
    });

    // 2. Identify products that had movement within the selected period
    const movedProductIdsSet = new Set<number>();
    const dateRangeStart = start;
    const dateRangeEnd = end;

    // Fetch all completed Document References in the system (up to TODAY)
    const allCompletedDocs = await this.prisma.documentReference.findMany({
      where: {
        warehouseId,
        state: 'done',
        OR: [
          {
            operationProducts: {
              some: {
                gateOperation: {
                  status: { notIn: ['CANCELED', 'REJECTED'] },
                },
              },
            },
          },
          {
            gateOperations: {
              some: {
                status: { notIn: ['CANCELED', 'REJECTED'] },
              },
            },
          },
          {
            gateOperationLinks: {
              some: {
                gateOperation: {
                  status: { notIn: ['CANCELED', 'REJECTED'] },
                },
              },
            },
          },
        ],
      },
      include: {
        items: true,
        moveLines: true,
        operationProducts: {
          where: {
            gateOperation: {
              status: { notIn: ['CANCELED', 'REJECTED'] },
            },
          },
        },
        gateOperations: {
          where: {
            status: {
              notIn: ['CANCELED', 'REJECTED'],
            },
          },
          include: {
            products: {
              where: {
                documentReferenceId: null,
              },
            },
          },
        },
      },
    });

    // Fetch independent completed Document References (up to TODAY)
    const independentCompletedDocs =
      await this.prisma.documentReference.findMany({
        where: {
          warehouseId,
          state: 'done',
          pickingTypeCode: { in: ['incoming', 'outgoing'] },
          ...NO_ACTIVE_GATE_OPERATION,
          OR: [
            {
              dateDone: {
                gte: start,
                lte: today,
              },
            },
            {
              dateDone: null,
              updatedAt: {
                gte: start,
                lte: today,
              },
            },
          ],
        },
        include: {
          items: true,
          moveLines: true,
        },
      });

    // Process independent completed document references to find products with movement
    for (const doc of independentCompletedDocs) {
      const docDate = doc.dateDone || doc.updatedAt || doc.createdAt;
      const isWithinDateRange = docDate >= start && docDate <= end;
      if (isWithinDateRange) {
        for (const item of doc.items) {
          movedProductIdsSet.add(item.inventoryId);
        }
      }
    }

    const cumulativeLocationAdjustmentsMap = new Map<string, number>(); // Key: `${locationId}_${inventoryId}`
    const completedDocsAdjustments: any[] = [];

    for (const doc of allCompletedDocs) {
      const pickingTypeCode = doc.pickingTypeCode;
      if (pickingTypeCode !== 'incoming' && pickingTypeCode !== 'outgoing') {
        continue;
      }

      // Group gate operations products by inventoryId strictly for this doc
      const docGateProductsMap = new Map<
        number,
        { total: number; locations: Map<number, number> }
      >();
      const docProducts = [
        ...doc.operationProducts,
        ...doc.gateOperations.flatMap((op) => op.products),
      ];
      for (const gp of docProducts) {
        const current = docGateProductsMap.get(gp.inventoryId) || {
          total: 0,
          locations: new Map<number, number>(),
        };
        current.total += gp.quantity;
        for (const alloc of this.allocateGateProduct(gp, doc, dbLocationIds)) {
          current.locations.set(
            alloc.locationId,
            (current.locations.get(alloc.locationId) || 0) + alloc.qty,
          );
        }
        docGateProductsMap.set(gp.inventoryId, current);
      }

      const docDate = doc.dateDone || doc.updatedAt || doc.createdAt;
      const docDateStr = formatDateInTimezone(docDate, timezone);
      const isWithinDateRange = docDate >= start && docDate <= end;

      for (const item of doc.items) {
        const invId = item.inventoryId;
        const erpQty = item.productQty;
        const gateInfo = docGateProductsMap.get(invId) || {
          total: 0,
          locations: new Map<number, number>(),
        };
        const sumGateQty = gateInfo.total;

        if (sumGateQty !== erpQty) {
          let adjustment = 0;
          if (pickingTypeCode === 'incoming') {
            adjustment = sumGateQty - erpQty;
          } else if (pickingTypeCode === 'outgoing') {
            adjustment = erpQty - sumGateQty;
          }

          if (adjustment !== 0) {
            // Distribute to cumulative location map (for today's stock tracker)
            if (gateInfo.locations.size > 0) {
              const locList = Array.from(gateInfo.locations.entries()).map(
                ([id, qty]) => ({ id, qty }),
              );
              const distributed = this.distributeAdjustment(
                adjustment,
                locList,
              );
              for (const [locId, locAdj] of distributed.entries()) {
                const key = `${locId}_${invId}`;
                cumulativeLocationAdjustmentsMap.set(
                  key,
                  (cumulativeLocationAdjustmentsMap.get(key) || 0) + locAdj,
                );
              }
            }

            if (isWithinDateRange) {
              movedProductIdsSet.add(invId);
            }
            // Adjustments after the period are needed too: opening stock is
            // calculated backward from today's real stock
            if (docDate >= start && docDate <= today) {
              completedDocsAdjustments.push({
                doc,
                invId,
                erpQty,
                sumGateQty,
                adjustment,
                docDate,
                docDateStr,
                gateInfo,
              });
            }
          }
        }
      }
    }

    for (const op of gateOps) {
      const opDate =
        op.cardType === 'OUT' ? op.createdAt : op.verifiedAt || op.createdAt;
      if (opDate && opDate >= dateRangeStart && opDate <= dateRangeEnd) {
        for (const p of op.products) {
          movedProductIdsSet.add(p.inventoryId);
        }
      }
    }
    const movedProductIds = Array.from(movedProductIdsSet);

    if (movedProductIds.length === 0) {
      return [];
    }

    // 3. Fetch details for products with movement
    const products = await this.prisma.inventory.findMany({
      where: {
        id: { in: movedProductIds },
        ...(query.productId ? { uuid: query.productId } : {}),
      },
      include: {
        quants: {
          where: {
            location: { warehouseId },
            quantity: { gt: 0 },
          },
        },
      },
    });

    // 4. Map location IDs to UUIDs and display names
    const locationsMap = new Map<number, (typeof dbLocations)[number]>(
      dbLocations.map((l) => [l.id, l]),
    );

    const reportRows: any[] = [];
    const datesList = this.generateDatesList(start, end);

    for (const prod of products) {
      // Ensure any location that had operations or has current quants or has active pending ops is included
      const activeLocationIds = new Set<number>();
      for (const q of prod.quants) {
        activeLocationIds.add(q.locationId);
      }
      for (const op of gateOps) {
        const matchingProducts = op.products.filter(
          (p) => p.inventoryId === prod.id,
        );
        for (const opProd of matchingProducts) {
          const { docRef } = this.resolveProductDocRefAndPartner(opProd, op);
          for (const alloc of this.allocateGateProduct(
            opProd,
            docRef,
            dbLocationIds,
            op.cardType,
          )) {
            activeLocationIds.add(alloc.locationId);
          }
        }
      }
      for (const op of activePendingOps) {
        const matchingProducts = op.products.filter(
          (p) => p.inventoryId === prod.id,
        );
        for (const opProd of matchingProducts) {
          if (opProd.locationId) {
            activeLocationIds.add(opProd.locationId);
          }
        }
      }
      // Also add locations of completed document gate operations for this product!
      for (const adjInfo of completedDocsAdjustments) {
        if (adjInfo.invId !== prod.id) continue;
        for (const [locId] of adjInfo.gateInfo.locations.entries()) {
          activeLocationIds.add(locId);
        }
      }

      // Get discrepancy-based mismatch map for this product
      const productQuants = prod.quants;
      const mismatchMap = await this.getProductMismatchMap(
        warehouseId,
        prod.id,
        dbLocations,
        productQuants,
      );

      const fallbackLocId = dbLocations[0]?.id;
      const mappedIndependentDocs: any[] = [];

      // Filter and sort independent docs for this product chronologically
      const prodIndependentDocs = independentCompletedDocs
        .filter((doc) => doc.items.some((item) => item.inventoryId === prod.id))
        .sort((a, b) => {
          const dateA = a.dateDone || a.updatedAt || a.createdAt;
          const dateB = b.dateDone || b.updatedAt || b.createdAt;
          return dateA.getTime() - dateB.getTime();
        });

      for (const doc of prodIndependentDocs) {
        const item = doc.items.find((i) => i.inventoryId === prod.id);
        if (!item) continue;

        const allocations = this.allocateIndependentDocItem(
          doc,
          item,
          dbLocationIds,
          () =>
            this.getBestMismatchLocation(
              dbLocations,
              mismatchMap,
              productQuants,
              fallbackLocId,
            ),
        );

        for (const alloc of allocations) {
          // Update mismatch for the mapped location
          const currentMismatch = mismatchMap.get(alloc.locationId) || 0;
          const movementQty =
            doc.pickingTypeCode === 'incoming' ? alloc.qty : -alloc.qty;
          mismatchMap.set(alloc.locationId, currentMismatch - movementQty);

          mappedIndependentDocs.push({ doc, item, ...alloc });

          // Add mapped location to activeLocationIds
          activeLocationIds.add(alloc.locationId);
        }
      }

      // Get current physical stock for this product at each location in this warehouse
      // Formula: realStock = erpStock (Quant quantity) + pendingInQty - pendingOutQty + cumulativeAdjustment
      const currentStockTrackerMap = new Map<number, number>();
      for (const locId of activeLocationIds) {
        // A location can hold several lots (stacks): sum all its quants
        const erpStock = prod.quants
          .filter((quant) => quant.locationId === locId)
          .reduce((sum, quant) => sum + quant.quantity, 0);

        let pendingInQty = 0;
        let pendingOutQty = 0;
        for (const op of activePendingOps) {
          const matchingProducts = op.products.filter(
            (p) => p.inventoryId === prod.id && p.locationId === locId,
          );
          for (const opProd of matchingProducts) {
            const { docRef } = this.resolveProductDocRefAndPartner(opProd, op);
            if (docRef && docRef.state === 'done') {
              continue;
            }
            if (op.cardType === 'IN') {
              pendingInQty += opProd.quantity;
            } else {
              pendingOutQty += opProd.quantity;
            }
          }
        }

        const adj =
          cumulativeLocationAdjustmentsMap.get(`${locId}_${prod.id}`) || 0;
        const realStock = erpStock + pendingInQty - pendingOutQty + adj;
        currentStockTrackerMap.set(locId, realStock);
      }

      // Collect all raw transactions into a list
      const rawTransactionsList: {
        txUuid: string;
        opNumber: string;
        driverName: string;
        licensePlate: string;
        clientPartner: string;
        cardType: 'IN' | 'OUT';
        quantity: number;
        referenceDocument: string;
        status: string;
        effectiveDate: Date;
        type: string;
        locationId: number;
        erpQty?: number;
        totalGateQty?: number;
        adjustmentQty?: number;
        reason?: string;
      }[] = [];

      for (const op of gateOps) {
        const matchingProducts = op.products.filter(
          (p) => p.inventoryId === prod.id,
        );
        for (const opProd of matchingProducts) {
          const {
            docRef,
            partnerName: resolvedPartner,
            documentNumber: resolvedDocNumber,
          } = this.resolveProductDocRefAndPartner(opProd, op);

          // Real location from the document's move lines when available, else the gate location
          const allocations = this.allocateGateProduct(
            opProd,
            docRef,
            dbLocationIds,
            op.cardType,
          );
          allocations.forEach((alloc, index) => {
            rawTransactionsList.push({
              txUuid: `${op.uuid}_${opProd.uuid || opProd.id}_${index}`,
              opNumber: op.opNumber,
              driverName: op.driverName,
              licensePlate: op.licensePlate,
              clientPartner: resolvedPartner,
              cardType: op.cardType,
              quantity: alloc.qty,
              referenceDocument: alloc.referenceDocument || resolvedDocNumber,
              status: op.status,
              effectiveDate:
                op.cardType === 'OUT'
                  ? op.createdAt
                  : op.verifiedAt || op.createdAt,
              type: 'GATE_OPERATION',
              locationId: alloc.locationId,
            });
          });
        }
      }

      // Add independent completed ERP documents to rawTransactionsList
      for (const m of mappedIndependentDocs) {
        const docDate = m.doc.dateDone || m.doc.updatedAt || m.doc.createdAt;
        rawTransactionsList.push({
          txUuid: `${m.doc.uuid}_${m.locationId}`,
          opNumber: m.doc.documentNumber,
          driverName: m.doc.driver || '-',
          licensePlate: m.doc.plateNumber || '-',
          clientPartner: m.doc.partnerName || m.doc.purchaseName || '-',
          cardType: m.doc.pickingTypeCode === 'incoming' ? 'IN' : 'OUT',
          quantity: m.qty,
          referenceDocument: m.referenceDocument,
          status: m.doc.state.toUpperCase(), // 'DONE'
          effectiveDate: docDate,
          type: 'ERP_DOCUMENT',
          locationId: m.locationId,
        });
      }

      // Add completed document adjustments to rawTransactionsList
      for (const adjInfo of completedDocsAdjustments) {
        if (adjInfo.invId !== prod.id) continue;

        const doc = adjInfo.doc;
        const erpQty = adjInfo.erpQty;
        const sumGateQty = adjInfo.sumGateQty;
        const adjustment = adjInfo.adjustment;
        const gateInfo = adjInfo.gateInfo;

        if (gateInfo.locations.size > 0) {
          const locList = Array.from(gateInfo.locations.entries()).map(
            ([id, qty]) => ({ id, qty }),
          );
          const distributed = this.distributeAdjustment(adjustment, locList);
          for (const [locId, locAdjustment] of distributed.entries()) {
            if (locAdjustment === 0) continue;

            rawTransactionsList.push({
              txUuid: `${doc.uuid}_adj_${locId}`,
              opNumber: doc.documentNumber,
              driverName: 'Penyesuaian Fisik',
              licensePlate: 'ERP Reconciliation',
              clientPartner: doc.partnerName || 'Penyesuaian Fisik',
              cardType: locAdjustment > 0 ? 'IN' : 'OUT',
              quantity: Math.abs(locAdjustment),
              referenceDocument: doc.documentNumber,
              status: locAdjustment > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
              effectiveDate: adjInfo.docDate,
              type: locAdjustment > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
              locationId: locId,
              erpQty,
              totalGateQty: sumGateQty,
              adjustmentQty: adjustment,
              reason: 'Partial physical realization after ERP completion',
            });
          }
        } else {
          const fallbackLoc = dbLocations[0];
          if (fallbackLoc) {
            const locId = fallbackLoc.id;
            rawTransactionsList.push({
              txUuid: `${doc.uuid}_adj_${locId}`,
              opNumber: doc.documentNumber,
              driverName: 'Penyesuaian Fisik',
              licensePlate: 'ERP Reconciliation',
              clientPartner: doc.partnerName || 'Penyesuaian Fisik',
              cardType: adjustment > 0 ? 'IN' : 'OUT',
              quantity: Math.abs(adjustment),
              referenceDocument: doc.documentNumber,
              status: adjustment > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
              effectiveDate: adjInfo.docDate,
              type: adjustment > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
              locationId: locId,
              erpQty,
              totalGateQty: sumGateQty,
              adjustmentQty: adjustment,
              reason: 'Partial physical realization after ERP completion',
            });
          }
        }
      }

      // Map to store daily metrics per location
      // Key: dateStr_locationId
      const locationDailyMetrics = new Map<
        string,
        {
          opening: number;
          incoming: number;
          outgoing: number;
          closing: number;
          inList: any[];
          outList: any[];
        }
      >();

      // Perform calculation for each active location using forward running balance
      for (const locId of activeLocationIds) {
        // Filter and sort transactions for this location chronologically
        const locTransactions = rawTransactionsList
          .filter((tx) => tx.locationId === locId)
          .sort((a, b) => {
            const timeA = a.effectiveDate.getTime();
            const timeB = b.effectiveDate.getTime();
            if (timeA !== timeB) return timeA - timeB;
            return a.txUuid.localeCompare(b.txUuid);
          });

        // 1. Opening stock at start date: backward calculation from today's real stock
        // (ERP quants + pending gate ops + adjustments), so the closing stock always ties
        // back to ERP instead of drifting from stored snapshots
        const openingStockAtStart = this.calculateOpeningStockBackward(
          currentStockTrackerMap.get(locId) || 0,
          locTransactions,
          start,
        );

        // 2. Perform forward running balance day by day
        let runningStock = openingStockAtStart;

        for (const dDate of datesList) {
          const dStr = formatDateInTimezone(dDate, timezone);
          const key = `${dStr}_${locId}`;

          const dayStart = getLocalStartOfDay(dStr, timezone);
          const dayEnd = getLocalEndOfDay(dStr, timezone);

          const dayTx = locTransactions.filter(
            (tx) => tx.effectiveDate >= dayStart && tx.effectiveDate <= dayEnd,
          );

          const dayLocOpening = runningStock;
          let inbound = 0;
          let outbound = 0;
          const inList: any[] = [];
          const outList: any[] = [];

          for (const tx of dayTx) {
            const txDetail = {
              uuid: tx.txUuid.includes('_adj_')
                ? tx.txUuid.split('_adj_')[0]
                : tx.txUuid.includes('_')
                ? tx.txUuid.split('_')[0]
                : tx.txUuid,
              opNumber: tx.opNumber,
              driverName: tx.driverName,
              licensePlate: tx.licensePlate,
              clientPartner: tx.clientPartner,
              cardType: tx.cardType,
              quantity: tx.quantity,
              referenceDocument: tx.referenceDocument,
              status: tx.status,
              createdAt: tx.effectiveDate,
              type: tx.type,
              erpQty: tx.erpQty,
              totalGateQty: tx.totalGateQty,
              adjustmentQty: tx.adjustmentQty,
              reason: tx.reason,
            };

            if (tx.cardType === 'IN') {
              inbound += tx.quantity;
              runningStock += tx.quantity;
              inList.push(txDetail);
            } else {
              outbound += tx.quantity;
              runningStock -= tx.quantity;
              outList.push(txDetail);
            }
          }

          const dayLocClosing = runningStock;

          locationDailyMetrics.set(key, {
            opening: dayLocOpening,
            incoming: inbound,
            outgoing: outbound,
            closing: dayLocClosing,
            inList,
            outList,
          });
        }
      }

      // Build report rows per date
      for (const dDate of datesList) {
        const dStr = formatDateInTimezone(dDate, timezone);

        // Sum metrics across all locations for this product and date
        let dayOpening = 0;
        let dayIncoming = 0;
        let dayOutgoing = 0;
        let dayClosing = 0;
        const locationsBreakdown: any[] = [];
        let hasMovementOnDay = false;

        for (const locId of activeLocationIds) {
          const key = `${dStr}_${locId}`;
          const metrics = locationDailyMetrics.get(key);
          if (!metrics) continue;

          if (metrics.incoming > 0 || metrics.outgoing > 0) {
            hasMovementOnDay = true;
          }

          dayOpening += metrics.opening;
          dayIncoming += metrics.incoming;
          dayOutgoing += metrics.outgoing;
          dayClosing += metrics.closing;

          const loc = locationsMap.get(locId);
          if (metrics.incoming > 0 || metrics.outgoing > 0) {
            locationsBreakdown.push({
              locationId: locId,
              locationUuid: loc?.uuid || '',
              locationName: loc?.displayName || `Lokasi #${locId}`,
              openingStock: metrics.opening,
              totalIn: metrics.incoming,
              totalOut: metrics.outgoing,
              closingStock: metrics.closing,
              inOperations: metrics.inList,
              outOperations: metrics.outList,
            });
          }
        }

        // If there was no movement on this day for this product, skip it
        if (!hasMovementOnDay) {
          continue;
        }

        reportRows.push({
          date: dStr,
          product: {
            uuid: prod.uuid,
            sku: prod.sku,
            name: prod.name,
            uom: prod.uom || 'Unit',
          },
          openingStock: dayOpening,
          incoming: dayIncoming,
          outgoing: dayOutgoing,
          closingStock: dayClosing,
          locations: locationsBreakdown.sort((a, b) =>
            a.locationName.localeCompare(b.locationName),
          ),
        });
      }
    }

    return reportRows.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return a.product.name.localeCompare(b.product.name);
    });
  }

  /**
   * Drill down details for daily stock movement transactions.
   */
  async getDailyStockMovementDetail(
    warehouseId: number,
    query: {
      date: string;
      productUuid: string;
    },
  ) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { uuid: query.productUuid },
    });

    if (!inventory) {
      throw new NotFoundException('Produk tidak ditemukan.');
    }

    const dbLocations = await this.prisma.location.findMany({
      where: { warehouseId },
    });
    const dbLocationIds = new Set(dbLocations.map((l) => l.id));

    const timezone = this.warehouseContext.getTimezone();
    const start = getLocalStartOfDay(query.date, timezone);
    const end = getLocalEndOfDay(query.date, timezone);

    const todayStr = formatDateInTimezone(new Date(), timezone);
    const today = getLocalEndOfDay(todayStr, timezone);

    // 1. Fetch independent ERP receipts and deliveries for this product on this day (and up to today for backward stock calculation)
    const independentCompletedDocs =
      await this.prisma.documentReference.findMany({
        where: {
          warehouseId,
          state: 'done',
          pickingTypeCode: { in: ['incoming', 'outgoing'] },
          items: {
            some: {
              inventoryId: inventory.id,
            },
          },
          ...NO_ACTIVE_GATE_OPERATION,
          OR: [
            {
              dateDone: {
                gte: start,
                lte: today,
              },
            },
            {
              dateDone: null,
              updatedAt: {
                gte: start,
                lte: today,
              },
            },
          ],
        },
        include: {
          items: {
            where: {
              inventoryId: inventory.id,
            },
          },
          moveLines: {
            where: {
              inventoryId: inventory.id,
            },
          },
        },
      });

    const targetDayIndependentDocs = independentCompletedDocs.filter((doc) => {
      const docDate = doc.dateDone || doc.updatedAt || doc.createdAt;
      return docDate >= start && docDate <= end;
    });

    const erpTransactions = targetDayIndependentDocs.map((doc) => {
      const item = doc.items[0];
      return {
        documentNumber: doc.documentNumber,
        partnerName: doc.partnerName || doc.purchaseName || 'Tanpa Partner',
        pickingTypeCode: doc.pickingTypeCode, // incoming / outgoing
        quantity: item ? item.productQty : 0,
        scheduledDate: doc.dateDone || doc.updatedAt || doc.createdAt,
        type: 'ERP_DOCUMENT',
      };
    });

    // 2. Fetch pending and verified gate operations for this product on this day
    const gateOps = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: { in: ['PENDING', 'VERIFIED'] },
        AND: [
          {
            OR: [
              {
                cardType: 'OUT',
                createdAt: {
                  gte: start,
                  lte: end,
                },
              },
              {
                cardType: 'IN',
                OR: [
                  {
                    verifiedAt: {
                      gte: start,
                      lte: end,
                    },
                  },
                  {
                    verifiedAt: null,
                    createdAt: {
                      gte: start,
                      lte: end,
                    },
                  },
                ],
              },
            ],
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
            documentReference: { include: { moveLines: true } },
          },
        },
        documentReference: { include: { moveLines: true } },
        documentReferences: {
          include: {
            documentReference: { include: { moveLines: true } },
          },
        },
      },
    });

    const unreconciledGateOps = gateOps.flatMap((op) => {
      return op.products
        .filter((opProd) => {
          const { docRef } = this.resolveProductDocRefAndPartner(opProd, op);
          return !docRef || docRef.state !== 'done';
        })
        .map((opProd) => {
          const { partnerName, documentNumber } =
            this.resolveProductDocRefAndPartner(opProd, op);
          return {
            documentNumber:
              documentNumber !== '-' ? documentNumber : op.opNumber,
            partnerName,
            pickingTypeCode: op.cardType === 'IN' ? 'incoming' : 'outgoing',
            quantity: opProd.quantity,
            scheduledDate:
              op.cardType === 'OUT'
                ? op.createdAt
                : op.verifiedAt || op.createdAt,
            type: 'GATE_OPERATION',
          };
        });
    });

    // Fetch all completed Document References for this product (up to TODAY)
    const allCompletedDocs = await this.prisma.documentReference.findMany({
      where: {
        warehouseId,
        state: 'done',
        items: {
          some: {
            inventoryId: inventory.id,
          },
        },
        OR: [
          {
            operationProducts: {
              some: {
                inventoryId: inventory.id,
                gateOperation: {
                  status: { notIn: ['CANCELED', 'REJECTED'] },
                },
              },
            },
          },
          {
            gateOperations: {
              some: {
                status: { notIn: ['CANCELED', 'REJECTED'] },
              },
            },
          },
          {
            gateOperationLinks: {
              some: {
                gateOperation: {
                  status: { notIn: ['CANCELED', 'REJECTED'] },
                },
              },
            },
          },
        ],
      },
      include: {
        items: {
          where: {
            inventoryId: inventory.id,
          },
        },
        moveLines: {
          where: {
            inventoryId: inventory.id,
          },
        },
        operationProducts: {
          where: {
            inventoryId: inventory.id,
            gateOperation: {
              status: { notIn: ['CANCELED', 'REJECTED'] },
            },
          },
        },
        gateOperations: {
          where: {
            status: { notIn: ['CANCELED', 'REJECTED'] },
          },
          include: {
            products: {
              where: {
                inventoryId: inventory.id,
                documentReferenceId: null,
              },
            },
          },
        },
      },
    });

    const cumulativeLocationAdjustmentsMap = new Map<string, number>(); // Key: `${locationId}_${inventoryId}`
    const completedDocsAdjustments: any[] = [];
    const adjustmentTransactionsOnTargetDay: any[] = [];

    for (const doc of allCompletedDocs) {
      const pickingTypeCode = doc.pickingTypeCode;
      if (pickingTypeCode !== 'incoming' && pickingTypeCode !== 'outgoing') {
        continue;
      }

      const item = doc.items[0];
      if (!item) continue;

      const erpQty = item.productQty;
      const locQties = new Map<number, number>();
      let sumGateQty = 0;

      const docProducts = [
        ...doc.operationProducts,
        ...doc.gateOperations.flatMap((op) => op.products),
      ];

      for (const gp of docProducts) {
        sumGateQty += gp.quantity;
        for (const alloc of this.allocateGateProduct(gp, doc, dbLocationIds)) {
          locQties.set(
            alloc.locationId,
            (locQties.get(alloc.locationId) || 0) + alloc.qty,
          );
        }
      }

      if (sumGateQty !== erpQty) {
        let adjustment = 0;
        if (pickingTypeCode === 'incoming') {
          adjustment = sumGateQty - erpQty;
        } else if (pickingTypeCode === 'outgoing') {
          adjustment = erpQty - sumGateQty;
        }

        if (adjustment !== 0) {
          // Distribute to cumulative location map (for today's stock tracker)
          if (locQties.size > 0) {
            const locList = Array.from(locQties.entries()).map(([id, qty]) => ({
              id,
              qty,
            }));
            const distributed = this.distributeAdjustment(adjustment, locList);
            for (const [locId, locAdj] of distributed.entries()) {
              const key = `${locId}_${inventory.id}`;
              cumulativeLocationAdjustmentsMap.set(
                key,
                (cumulativeLocationAdjustmentsMap.get(key) || 0) + locAdj,
              );
            }
          }

          const docDate = doc.dateDone || doc.updatedAt || doc.createdAt;
          const docDateStr = formatDateInTimezone(docDate, timezone);
          const isWithinRangeStr = docDate >= start && docDate <= today;

          const gateInfo = { locations: locQties };

          if (isWithinRangeStr) {
            completedDocsAdjustments.push({
              doc,
              erpQty,
              sumGateQty,
              adjustment,
              docDate,
              docDateStr,
              gateInfo,
            });

            if (docDate >= start && docDate <= end) {
              adjustmentTransactionsOnTargetDay.push({
                documentNumber: doc.documentNumber,
                partnerName:
                  doc.partnerName ||
                  'Partial physical realization after ERP completion',
                pickingTypeCode: adjustment > 0 ? 'incoming' : 'outgoing',
                quantity: Math.abs(adjustment),
                scheduledDate: docDate,
                type: adjustment > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
                erpQty,
                gateQty: sumGateQty,
                adjustmentQty: adjustment,
              });
            }
          }
        }
      }
    }

    const incomingTransactions = [
      ...erpTransactions.filter((tx) => tx.pickingTypeCode === 'incoming'),
      ...unreconciledGateOps.filter((tx) => tx.pickingTypeCode === 'incoming'),
      ...adjustmentTransactionsOnTargetDay.filter(
        (tx) => tx.pickingTypeCode === 'incoming',
      ),
    ];

    const outgoingTransactions = [
      ...erpTransactions.filter((tx) => tx.pickingTypeCode === 'outgoing'),
      ...unreconciledGateOps.filter((tx) => tx.pickingTypeCode === 'outgoing'),
      ...adjustmentTransactionsOnTargetDay.filter(
        (tx) => tx.pickingTypeCode === 'outgoing',
      ),
    ];

    // 3. Calculate opening stock and closing stock for this product on this day
    const gateOpsForProd = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: { in: ['PENDING', 'VERIFIED'] },
        OR: [
          {
            cardType: 'OUT',
            createdAt: {
              gte: start,
              lte: today,
            },
          },
          {
            cardType: 'IN',
            OR: [
              {
                verifiedAt: {
                  gte: start,
                  lte: today,
                },
              },
              {
                verifiedAt: null,
                createdAt: {
                  gte: start,
                  lte: today,
                },
              },
            ],
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
            documentReference: { include: { moveLines: true } },
          },
        },
        documentReference: { include: { moveLines: true } },
        documentReferences: {
          include: {
            documentReference: { include: { moveLines: true } },
          },
        },
      },
    });

    // Fetch all currently active pending/unreconciled Gate Operations for this product as of today to compute current real stock
    const activePendingOps = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: { in: ['PENDING', 'VERIFIED'] },
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
            documentReference: { include: { moveLines: true } },
          },
        },
        documentReference: { include: { moveLines: true } },
        documentReferences: {
          include: {
            documentReference: { include: { moveLines: true } },
          },
        },
      },
    });

    const quants = await this.prisma.quant.findMany({
      where: {
        inventoryId: inventory.id,
        location: { warehouseId },
        quantity: { gt: 0 },
      },
    });

    const activeLocationIds = new Set<number>();
    for (const q of quants) {
      activeLocationIds.add(q.locationId);
    }
    for (const op of gateOpsForProd) {
      const matchingProducts = op.products.filter(
        (p) => p.inventoryId === inventory.id,
      );
      for (const opProd of matchingProducts) {
        const { docRef } = this.resolveProductDocRefAndPartner(opProd, op);
        for (const alloc of this.allocateGateProduct(
          opProd,
          docRef,
          dbLocationIds,
          op.cardType,
        )) {
          activeLocationIds.add(alloc.locationId);
        }
      }
    }
    for (const op of activePendingOps) {
      const matchingProducts = op.products.filter(
        (p) => p.inventoryId === inventory.id,
      );
      for (const opProd of matchingProducts) {
        if (opProd.locationId) {
          activeLocationIds.add(opProd.locationId);
        }
      }
    }
    // Also add locations of completed document gate operations for this product!
    for (const adjInfo of completedDocsAdjustments) {
      for (const [locId] of adjInfo.gateInfo.locations.entries()) {
        activeLocationIds.add(locId);
      }
    }

    // Get discrepancy-based mismatch map for this product
    const mismatchMap = await this.getProductMismatchMap(
      warehouseId,
      inventory.id,
      dbLocations,
      quants,
    );

    const fallbackLocId = dbLocations[0]?.id;
    const mappedIndependentDocs: any[] = [];

    // Sort independent docs for this product chronologically
    const sortedIndependentDocs = [...independentCompletedDocs].sort((a, b) => {
      const dateA = a.dateDone || a.updatedAt || a.createdAt;
      const dateB = b.dateDone || b.updatedAt || b.createdAt;
      return dateA.getTime() - dateB.getTime();
    });

    for (const doc of sortedIndependentDocs) {
      const item = doc.items.find((i) => i.inventoryId === inventory.id);
      if (!item) continue;

      const allocations = this.allocateIndependentDocItem(
        doc,
        item,
        dbLocationIds,
        () =>
          this.getBestMismatchLocation(
            dbLocations,
            mismatchMap,
            quants,
            fallbackLocId,
          ),
      );

      for (const alloc of allocations) {
        // Update mismatch for the mapped location
        const currentMismatch = mismatchMap.get(alloc.locationId) || 0;
        const movementQty =
          doc.pickingTypeCode === 'incoming' ? alloc.qty : -alloc.qty;
        mismatchMap.set(alloc.locationId, currentMismatch - movementQty);

        mappedIndependentDocs.push({ doc, item, ...alloc });

        // Add mapped location to activeLocationIds
        activeLocationIds.add(alloc.locationId);
      }
    }

    // Collect all raw transactions into a list
    const rawTransactionsList: {
      txUuid: string;
      opNumber: string;
      driverName: string;
      licensePlate: string;
      clientPartner: string;
      cardType: 'IN' | 'OUT';
      quantity: number;
      referenceDocument: string;
      status: string;
      effectiveDate: Date;
      type: string;
      locationId: number;
      erpQty?: number;
      totalGateQty?: number;
      adjustmentQty?: number;
      reason?: string;
    }[] = [];

    for (const op of gateOpsForProd) {
      const matchingProducts = op.products.filter(
        (p) => p.inventoryId === inventory.id,
      );
      for (const opProd of matchingProducts) {
        const {
          docRef,
          partnerName: resolvedPartner,
          documentNumber: resolvedDocNumber,
        } = this.resolveProductDocRefAndPartner(opProd, op);

        // Real location from the document's move lines when available, else the gate location
        const allocations = this.allocateGateProduct(
          opProd,
          docRef,
          dbLocationIds,
          op.cardType,
        );
        allocations.forEach((alloc, index) => {
          rawTransactionsList.push({
            txUuid: `${op.uuid}_${opProd.uuid || opProd.id}_${index}`,
            opNumber: op.opNumber,
            driverName: op.driverName,
            licensePlate: op.licensePlate,
            clientPartner: resolvedPartner,
            cardType: op.cardType,
            quantity: alloc.qty,
            referenceDocument: alloc.referenceDocument || resolvedDocNumber,
            status: op.status,
            effectiveDate:
              op.cardType === 'OUT'
                ? op.createdAt
                : op.verifiedAt || op.createdAt,
            type: 'GATE_OPERATION',
            locationId: alloc.locationId,
          });
        });
      }
    }

    // Add independent completed ERP documents to rawTransactionsList
    for (const m of mappedIndependentDocs) {
      const docDate = m.doc.dateDone || m.doc.updatedAt || m.doc.createdAt;
      rawTransactionsList.push({
        txUuid: `${m.doc.uuid}_${m.locationId}`,
        opNumber: m.doc.documentNumber,
        driverName: m.doc.driver || '-',
        licensePlate: m.doc.plateNumber || '-',
        clientPartner: m.doc.partnerName || m.doc.purchaseName || '-',
        cardType: m.doc.pickingTypeCode === 'incoming' ? 'IN' : 'OUT',
        quantity: m.qty,
        referenceDocument: m.referenceDocument,
        status: m.doc.state.toUpperCase(), // 'DONE'
        effectiveDate: docDate,
        type: 'ERP_DOCUMENT',
        locationId: m.locationId,
      });
    }

    // Add completed document adjustments to rawTransactionsList
    for (const adjInfo of completedDocsAdjustments) {
      const doc = adjInfo.doc;
      const erpQty = adjInfo.erpQty;
      const sumGateQty = adjInfo.sumGateQty;
      const adjustment = adjInfo.adjustment;
      const gateInfo = adjInfo.gateInfo;

      if (gateInfo.locations.size > 0) {
        const locList = Array.from(gateInfo.locations.entries()).map(
          ([id, qty]) => ({ id, qty }),
        );
        const distributed = this.distributeAdjustment(adjustment, locList);
        for (const [locId, locAdjustment] of distributed.entries()) {
          if (locAdjustment === 0) continue;

          rawTransactionsList.push({
            txUuid: `${doc.uuid}_adj_${locId}`,
            opNumber: doc.documentNumber,
            driverName: 'Penyesuaian Fisik',
            licensePlate: 'ERP Reconciliation',
            clientPartner: doc.partnerName || 'Penyesuaian Fisik',
            cardType: locAdjustment > 0 ? 'IN' : 'OUT',
            quantity: Math.abs(locAdjustment),
            referenceDocument: doc.documentNumber,
            status: locAdjustment > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
            effectiveDate: adjInfo.docDate,
            type: locAdjustment > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
            locationId: locId,
            erpQty,
            totalGateQty: sumGateQty,
            adjustmentQty: adjustment,
            reason: 'Partial physical realization after ERP completion',
          });
        }
      } else {
        const fallbackLoc = dbLocations[0];
        if (fallbackLoc) {
          const locId = fallbackLoc.id;
          rawTransactionsList.push({
            txUuid: `${doc.uuid}_adj_${locId}`,
            opNumber: doc.documentNumber,
            driverName: 'Penyesuaian Fisik',
            licensePlate: 'ERP Reconciliation',
            clientPartner: doc.partnerName || 'Penyesuaian Fisik',
            cardType: adjustment > 0 ? 'IN' : 'OUT',
            quantity: Math.abs(adjustment),
            referenceDocument: doc.documentNumber,
            status: adjustment > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
            effectiveDate: adjInfo.docDate,
            type: adjustment > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
            locationId: locId,
            erpQty,
            totalGateQty: sumGateQty,
            adjustmentQty: adjustment,
            reason: 'Partial physical realization after ERP completion',
          });
        }
      }
    }

    const currentStockTrackerMap = new Map<number, number>();
    for (const locId of activeLocationIds) {
      // A location can hold several lots (stacks): sum all its quants
      const erpStock = quants
        .filter((quant) => quant.locationId === locId)
        .reduce((sum, quant) => sum + quant.quantity, 0);

      let pendingInQty = 0;
      let pendingOutQty = 0;
      for (const op of activePendingOps) {
        const matchingProducts = op.products.filter(
          (p) => p.inventoryId === inventory.id && p.locationId === locId,
        );
        for (const opProd of matchingProducts) {
          const { docRef } = this.resolveProductDocRefAndPartner(opProd, op);
          if (docRef && docRef.state === 'done') {
            continue;
          }
          if (op.cardType === 'IN') {
            pendingInQty += opProd.quantity;
          } else {
            pendingOutQty += opProd.quantity;
          }
        }
      }

      const adj =
        cumulativeLocationAdjustmentsMap.get(`${locId}_${inventory.id}`) || 0;
      const realStock = erpStock + pendingInQty - pendingOutQty + adj;
      currentStockTrackerMap.set(locId, realStock);
    }

    const targetDateStr = formatDateInTimezone(start, timezone);

    let dayOpening = 0;
    let dayClosing = 0;

    for (const locId of activeLocationIds) {
      // Filter and sort transactions for this location chronologically
      const locTransactions = rawTransactionsList
        .filter((tx) => tx.locationId === locId)
        .sort((a, b) => {
          const timeA = a.effectiveDate.getTime();
          const timeB = b.effectiveDate.getTime();
          if (timeA !== timeB) return timeA - timeB;
          return a.txUuid.localeCompare(b.txUuid);
        });

      // 1. Opening stock at the target date: backward calculation from today's real stock
      // (ERP quants + pending gate ops + adjustments), consistent with the stock movement report
      const openingStockAtStart = this.calculateOpeningStockBackward(
        currentStockTrackerMap.get(locId) || 0,
        locTransactions,
        start,
      );

      // 2. Perform forward running balance for the target date
      const dayStart = getLocalStartOfDay(targetDateStr, timezone);
      const dayEnd = getLocalEndOfDay(targetDateStr, timezone);

      const dayTx = locTransactions.filter(
        (tx) => tx.effectiveDate >= dayStart && tx.effectiveDate <= dayEnd,
      );

      let inbound = 0;
      let outbound = 0;
      for (const tx of dayTx) {
        if (tx.cardType === 'IN') {
          inbound += tx.quantity;
        } else {
          outbound += tx.quantity;
        }
      }

      dayOpening += openingStockAtStart;
      dayClosing += openingStockAtStart + inbound - outbound;
    }

    return {
      product: {
        sku: inventory.sku,
        name: inventory.name,
        uom: inventory.uom || 'Unit',
      },
      date: query.date,
      openingStock: dayOpening,
      incoming: incomingTransactions,
      outgoing: outgoingTransactions,
      closingStock: dayClosing,
    };
  }

  /**
   * Opening stock at `start`, calculated backward from the current real stock by undoing
   * every transaction from `start` until now.
   */
  private calculateOpeningStockBackward(
    currentStock: number,
    transactions: {
      cardType: 'IN' | 'OUT';
      quantity: number;
      effectiveDate: Date;
    }[],
    start: Date,
  ): number {
    return transactions
      .filter((tx) => tx.effectiveDate >= start)
      .reduce(
        (stock, tx) =>
          tx.cardType === 'IN' ? stock - tx.quantity : stock + tx.quantity,
        currentStock,
      );
  }

  /**
   * Helper to compute product mismatch per location
   * Mismatch = ERP Expected Qty - Current Location Qty
   */
  private async getProductMismatchMap(
    warehouseId: number,
    prodId: number,
    dbLocations: { id: number }[],
    quants: { locationId: number; quantity: number }[],
  ): Promise<Map<number, number>> {
    const gateProducts = await this.prisma.gateOperationProduct.findMany({
      where: {
        inventoryId: prodId,
        gateOperation: {
          warehouseId,
          status: { in: ['PENDING', 'VERIFIED'] },
        },
      },
      include: {
        gateOperation: true,
      },
    });

    const expectedStockMap = new Map<number, number>();
    for (const gp of gateProducts) {
      if (!gp.locationId) continue;
      const current = expectedStockMap.get(gp.locationId) || 0;
      if (gp.gateOperation.cardType === 'IN') {
        expectedStockMap.set(gp.locationId, current + gp.quantity);
      } else {
        expectedStockMap.set(gp.locationId, current - gp.quantity);
      }
    }

    const currentQtyMap = new Map<number, number>();
    for (const q of quants) {
      currentQtyMap.set(
        q.locationId,
        (currentQtyMap.get(q.locationId) || 0) + q.quantity,
      );
    }

    const mismatchMap = new Map<number, number>();
    for (const loc of dbLocations) {
      const expected = expectedStockMap.get(loc.id) || 0;
      const current = currentQtyMap.get(loc.id) || 0;
      mismatchMap.set(loc.id, expected - current);
    }

    return mismatchMap;
  }

  /**
   * Splits a quantity over the real stack locations recorded in a done ERP document's
   * move lines (WMS picking/putaway). The given quantity stays the total; it is split by
   * the picked quantities. Returns [] when no move line maps to a known warehouse location
   * (e.g. documents synced before move lines existed).
   */
  private getMoveLineAllocations(
    doc: MoveLineDocument | null | undefined,
    match: { inventoryId: number; itemId?: number },
    qty: number,
    validLocationIds: Set<number>,
    direction?: 'IN' | 'OUT',
  ): MoveLineAllocation[] {
    if (!doc || doc.state !== 'done' || !doc.moveLines?.length) return [];

    // Goods coming in land on the destination stack, goods going out leave the source stack.
    // Without an explicit direction (gate IN/OUT) it follows the document type.
    const isIncoming = direction
      ? direction === 'IN'
      : doc.pickingTypeCode === 'incoming';
    const grouped = new Map<
      number,
      { locationId: number; qty: number; pickings: Set<string> }
    >();

    for (const line of doc.moveLines) {
      if (line.quantity <= 0 || line.inventoryId !== match.inventoryId) {
        continue;
      }
      if (
        match.itemId !== undefined &&
        line.documentReferenceItemId !== match.itemId
      ) {
        continue;
      }
      const locationId = isIncoming
        ? line.destinationLocationId
        : line.sourceLocationId;
      if (!locationId || !validLocationIds.has(locationId)) continue;

      const current = grouped.get(locationId) || {
        locationId,
        qty: 0,
        pickings: new Set<string>(),
      };
      current.qty += line.quantity;
      if (line.pickingName && line.pickingName !== doc.documentNumber) {
        current.pickings.add(line.pickingName);
      }
      grouped.set(locationId, current);
    }

    const allocations = Array.from(grouped.values());
    const totalPickedQty = allocations.reduce((sum, a) => sum + a.qty, 0);
    if (totalPickedQty <= 0) return [];

    const scale =
      Math.abs(totalPickedQty - qty) < 1e-6 ? 1 : qty / totalPickedQty;

    return allocations.map((a) => ({
      locationId: a.locationId,
      qty: a.qty * scale,
      referenceDocument:
        a.pickings.size > 0
          ? `${doc.documentNumber} (${Array.from(a.pickings).join(', ')})`
          : doc.documentNumber,
    }));
  }

  /**
   * Allocates an independent ERP document item to the real stack locations recorded in
   * its move lines, falling back to a single heuristic location when there are none.
   */
  private allocateIndependentDocItem(
    doc: MoveLineDocument,
    item: { id: number; inventoryId: number; productQty: number },
    validLocationIds: Set<number>,
    getFallbackLocationId: () => number,
  ): MoveLineAllocation[] {
    const allocations = this.getMoveLineAllocations(
      doc,
      { inventoryId: item.inventoryId, itemId: item.id },
      item.productQty,
      validLocationIds,
    );
    if (allocations.length > 0) return allocations;

    return [
      {
        locationId: getFallbackLocationId(),
        qty: item.productQty,
        referenceDocument: doc.documentNumber,
      },
    ];
  }

  /**
   * Locations of a gate operation product. When its ERP document is done and has move
   * lines, the real stack from the WMS picking/putaway wins over the location picked at the gate.
   * referenceDocument is null when the gate location is used.
   */
  private allocateGateProduct(
    opProd: {
      inventoryId: number;
      quantity: number;
      locationId: number | null;
    },
    docRef: MoveLineDocument | null | undefined,
    validLocationIds: Set<number>,
    direction?: 'IN' | 'OUT',
  ): {
    locationId: number;
    qty: number;
    referenceDocument: string | null;
  }[] {
    const allocations = this.getMoveLineAllocations(
      docRef,
      { inventoryId: opProd.inventoryId },
      opProd.quantity,
      validLocationIds,
      direction,
    );
    if (allocations.length > 0) return allocations;

    return opProd.locationId
      ? [
          {
            locationId: opProd.locationId,
            qty: opProd.quantity,
            referenceDocument: null,
          },
        ]
      : [];
  }

  private getBestMismatchLocation(
    dbLocations: { id: number }[],
    mismatchMap: Map<number, number>,
    quants: { locationId: number; quantity: number }[],
    fallbackLocId?: number,
  ): number {
    let bestLocId = fallbackLocId;
    let maxAbsMismatch = -1;
    let maxCurrentQty = -1;

    const currentQtyMap = new Map<number, number>();
    for (const q of quants) {
      currentQtyMap.set(
        q.locationId,
        (currentQtyMap.get(q.locationId) || 0) + q.quantity,
      );
    }

    for (const loc of dbLocations) {
      const mismatch = mismatchMap.get(loc.id) || 0;
      const absMismatch = Math.abs(mismatch);
      const currentQty = currentQtyMap.get(loc.id) || 0;

      if (absMismatch > maxAbsMismatch) {
        maxAbsMismatch = absMismatch;
        maxCurrentQty = currentQty;
        bestLocId = loc.id;
      } else if (absMismatch === maxAbsMismatch) {
        if (currentQty > maxCurrentQty) {
          maxCurrentQty = currentQty;
          bestLocId = loc.id;
        }
      }
    }

    return bestLocId || dbLocations[0]?.id;
  }

  /**
   * Helper to resolve DocumentReference and Partner for a GateOperationProduct.
   * Prioritizes product.documentReference, with fallback to legacy single doc or junction doc.
   */
  private resolveProductDocRefAndPartner(
    prod: any,
    gateOp?: any,
  ): {
    docRef: any | null;
    partnerName: string;
    documentNumber: string;
  } {
    let docRef: any = prod?.documentReference || null;

    if (!docRef && gateOp) {
      if (gateOp.documentReference) {
        docRef = gateOp.documentReference;
      } else if (
        Array.isArray(gateOp.documentReferences) &&
        gateOp.documentReferences.length > 0
      ) {
        if (gateOp.documentReferences.length === 1) {
          docRef = gateOp.documentReferences[0].documentReference || null;
        } else {
          // Find the junction document reference that contains this inventoryId
          const matched = gateOp.documentReferences.find(
            (junction: any) =>
              junction.documentReference?.items?.some(
                (item: any) => item.inventoryId === prod.inventoryId,
              ),
          );
          if (matched) {
            docRef = matched.documentReference;
          }
        }
      }
    }

    const partnerName =
      docRef?.partnerName ||
      docRef?.purchaseName ||
      (docRef ? '-' : gateOp?.clientPartner || '-');
    const documentNumber = docRef?.documentNumber || '-';

    return {
      docRef,
      partnerName,
      documentNumber,
    };
  }

  /**
   * Helper to format Date to YYYY-MM-DD.
   */
  private formatDateString(date: Date): string {
    const YYYY = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const DD = String(date.getDate()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD}`;
  }

  /**
   * Generate list of Dates between start and end.
   */
  private generateDatesList(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  /**
   * Exports Stock Movement Report as PDF.
   */
  async generatePdfReport(
    warehouseId: number,
    query: {
      startDate: string;
      endDate: string;
      productId?: string;
    },
  ): Promise<Buffer> {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    const warehouseName = warehouse ? warehouse.name : 'Gudang WMS';

    const rows = await this.getDailyStockMovementReport(warehouseId, query);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 20, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const drawHeader = () => {
        doc
          .fillColor('#1e293b')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('LAPORAN MUTASI STOK HARIAN', 20, 20, {
            align: 'center',
            width: 555,
          });
        doc
          .fontSize(7.5)
          .font('Helvetica')
          .fillColor('#64748b')
          .text(
            `Gudang: ${warehouseName}  |  Periode: ${query.startDate} s/d ${query.endDate}`,
            20,
            34,
            { align: 'center', width: 555 },
          );

        doc.moveTo(20, 48).lineTo(575, 48).lineWidth(0.5).stroke('#475569');

        // Table Header
        doc.fillColor('#475569').fontSize(7.2).font('Helvetica-Bold');
        doc.text('Tanggal', 25, 54, { width: 55 });
        doc.text('Produk (SKU / Nama)', 85, 54, { width: 110 });
        doc.text('Lokasi', 200, 54, { width: 85 });
        doc.text('Stok Awal', 290, 54, { width: 55, align: 'right' });
        doc.text('Masuk', 350, 54, { width: 55, align: 'right' });
        doc.text('Keluar', 410, 54, { width: 55, align: 'right' });
        doc.text('Stok Akhir', 470, 54, { width: 100, align: 'right' });
        doc.font('Helvetica');

        doc.moveTo(20, 66).lineTo(575, 66).lineWidth(0.5).stroke('#475569');
        return 70;
      };

      let currentY = drawHeader();

      for (const row of rows) {
        for (const loc of row.locations) {
          if (loc.totalIn === 0 && loc.totalOut === 0) continue;

          // Calculate dynamic height for the row based on content text height
          doc.font('Helvetica-Bold').fontSize(6.8);
          const productNameHeight = doc.heightOfString(row.product.name, {
            width: 110,
          });

          doc.font('Helvetica').fontSize(6.8);
          const locationNameHeight = doc.heightOfString(loc.locationName, {
            width: 85,
          });

          const maxTextHeight = Math.max(productNameHeight, locationNameHeight);
          const rowHeight = Math.max(maxTextHeight + 8, 16); // padding 4pt top/bottom, min height 16

          if (currentY + rowHeight > 800) {
            doc.addPage();
            currentY = drawHeader();
          }

          doc.fillColor('#334155').fontSize(6.8).font('Helvetica');
          doc.text(row.date, 25, currentY + 4, { width: 55 });
          doc.fillColor('#1e293b').font('Helvetica-Bold');
          doc.text(`${row.product.name}`, 85, currentY + 4, {
            width: 110,
          });
          doc.fillColor('#475569').font('Helvetica');
          doc.text(`${loc.locationName}`, 200, currentY + 4, {
            width: 85,
          });

          // Stok Awal
          doc.fillColor('#334155');
          doc.text(
            loc.openingStock.toLocaleString('id-ID'),
            290,
            currentY + 4,
            { width: 55, align: 'right' },
          );

          // Masuk
          doc.fillColor('#16a34a'); // green for incoming
          doc.text(
            loc.totalIn > 0 ? `+${loc.totalIn.toLocaleString('id-ID')}` : '0',
            350,
            currentY + 4,
            { width: 55, align: 'right' },
          );

          // Keluar
          doc.fillColor('#dc2626'); // red for outgoing
          doc.text(
            loc.totalOut > 0 ? `-${loc.totalOut.toLocaleString('id-ID')}` : '0',
            410,
            currentY + 4,
            { width: 55, align: 'right' },
          );

          // Stok Akhir
          doc.fillColor('#1e293b').font('Helvetica-Bold');
          doc.text(
            loc.closingStock.toLocaleString('id-ID'),
            470,
            currentY + 4,
            { width: 100, align: 'right' },
          );

          doc
            .moveTo(20, currentY + rowHeight)
            .lineTo(575, currentY + rowHeight)
            .lineWidth(0.15)
            .stroke('#e2e8f0');
          currentY += rowHeight;
        }
      }

      doc.end();
    });
  }

  /**
   * Exports Stock Movement Report as CSV string.
   */
  async generateCsvReport(
    warehouseId: number,
    query: {
      startDate: string;
      endDate: string;
      productId?: string;
    },
  ): Promise<string> {
    const rows = await this.getDailyStockMovementReport(warehouseId, query);

    // CSV Header
    let csv = '\ufeff'; // Add UTF-8 BOM so Excel opens it with correct encoding
    csv +=
      'Tanggal,SKU,Nama Produk,Lokasi,UOM,Stok Awal,Masuk,Keluar,Stok Akhir\n';

    for (const r of rows) {
      const sanitizedName = r.product.name.replace(/"/g, '""');
      for (const loc of r.locations) {
        if (loc.totalIn === 0 && loc.totalOut === 0) continue;
        const sanitizedLocName = loc.locationName.replace(/"/g, '""');
        csv += `${r.date},${r.product.sku},"${sanitizedName}","${sanitizedLocName}",${r.product.uom},${loc.openingStock},${loc.totalIn},${loc.totalOut},${loc.closingStock}\n`;
      }
    }

    return csv;
  }
}

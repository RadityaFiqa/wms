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
import { Cron } from '@nestjs/schedule';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseContext: WarehouseContextService,
  ) {}

  /**
   * Cron Job to capture daily location-level stock snapshots at 05:00 AM (Asia/Makassar timezone)
   */
  @Cron('0 5 * * *', { timeZone: 'Asia/Makassar' })
  async handleDailyStockSnapshot() {
    const tz = 'Asia/Makassar';
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateStr = formatDateInTimezone(yesterday, tz);
    const start = getLocalStartOfDay(dateStr, tz);
    const end = getLocalEndOfDay(dateStr, tz);

    console.log(
      `[Cron] Running daily location stock snapshot for date: ${dateStr}`,
    );

    // Fetch all internal locations
    const locations = await this.prisma.location.findMany({
      include: {
        warehouse: true,
      },
    });

    // Fetch all inventories/products
    const inventories = await this.prisma.inventory.findMany();

    // Fetch all pending and verified Gate Operations that happened yesterday
    const yesterdayOps = await this.prisma.gateOperation.findMany({
      where: {
        status: { in: ['PENDING', 'VERIFIED'] },
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
      include: {
        products: true,
      },
    });

    // Fetch all active pending/unreconciled gate operations in the system
    const allPendingOps = await this.prisma.gateOperation.findMany({
      where: {
        status: { in: ['PENDING', 'VERIFIED'] },
        OR: [
          { documentReferenceId: null },
          {
            documentReference: {
              state: { not: 'done' },
            },
          },
        ],
      },
      include: {
        products: true,
      },
    });

    // Fetch all current quants to use as a fallback if no previous snapshot exists
    const currentQuants = await this.prisma.quant.findMany();

    // Fetch previous snapshots to get previous closing stock (start of yesterday - 1 day, i.e., start of day before yesterday)
    const dayBeforeYesterday = new Date(
      yesterday.getTime() - 24 * 60 * 60 * 1000,
    );
    const dayBeforeYesterdayStr = formatDateInTimezone(dayBeforeYesterday, tz);
    const dayBeforeYesterdayStart = getLocalStartOfDay(
      dayBeforeYesterdayStr,
      tz,
    );

    const prevSnaps = await this.prisma.dailyLocationStockSnapshot.findMany({
      where: {
        date: dayBeforeYesterdayStart,
      },
    });

    // Map of locationId_inventoryId to previous snapshot
    const prevSnapsMap = new Map<string, (typeof prevSnaps)[number]>();
    for (const snap of prevSnaps) {
      prevSnapsMap.set(`${snap.locationId}_${snap.inventoryId}`, snap);
    }

    // Build the set of unique location + product pairs
    // We want to capture snapshots for:
    // 1. Every location and product currently having a Quant (physical stock exists)
    // 2. Every location and product affected by yesterday's Gate Operations
    // 3. Every location and product that had stock in the previous snapshot (closingStock > 0)
    const uniqueKeys = new Set<string>();

    for (const q of currentQuants) {
      uniqueKeys.add(`${q.locationId}_${q.inventoryId}`);
    }

    for (const op of yesterdayOps) {
      for (const p of op.products) {
        if (p.locationId) {
          uniqueKeys.add(`${p.locationId}_${p.inventoryId}`);
        }
      }
    }

    for (const snap of prevSnaps) {
      if (snap.closingStock > 0) {
        uniqueKeys.add(`${snap.locationId}_${snap.inventoryId}`);
      }
    }

    // Process each location + product pair
    for (const key of uniqueKeys) {
      const [locationIdStr, inventoryIdStr] = key.split('_');
      const locationId = parseInt(locationIdStr, 10);
      const inventoryId = parseInt(inventoryIdStr, 10);

      const location = locations.find((l) => l.id === locationId);
      if (!location) continue;
      const warehouseId = location.warehouseId;

      // 1. erpStock
      const matchingQuants = currentQuants.filter(
        (q) => q.locationId === locationId && q.inventoryId === inventoryId,
      );
      const erpStock = matchingQuants.reduce((sum, q) => sum + q.quantity, 0);

      // 2. pendingInQty & pendingOutQty
      let pendingInQty = 0;
      let pendingOutQty = 0;
      const pendingOpRefs: string[] = [];

      for (const op of allPendingOps) {
        const matchingProducts = op.products.filter(
          (p) => p.locationId === locationId && p.inventoryId === inventoryId,
        );
        for (const matchingProduct of matchingProducts) {
          if (op.cardType === 'IN') {
            pendingInQty += matchingProduct.quantity;
          } else {
            pendingOutQty += matchingProduct.quantity;
          }
          pendingOpRefs.push(op.opNumber);
        }
      }
      const gateOpRefsStr =
        pendingOpRefs.length > 0 ? pendingOpRefs.join(', ') : null;

      // 3. closingStock
      const closingStock = erpStock + pendingInQty - pendingOutQty;

      // 4. openingStock
      const prevSnap = prevSnapsMap.get(key);
      let openingStock = 0;
      if (prevSnap) {
        openingStock = prevSnap.closingStock;
      } else {
        openingStock = erpStock;
      }

      // 5. totalIn & totalOut (yesterday's movements for backward compatibility and UI display)
      let totalIn = 0;
      let totalOut = 0;

      for (const op of yesterdayOps) {
        const isOut = op.cardType === 'OUT';
        const matchingProducts = op.products.filter(
          (p) => p.locationId === locationId && p.inventoryId === inventoryId,
        );
        for (const matchingProduct of matchingProducts) {
          if (isOut) {
            totalOut += matchingProduct.quantity;
          } else {
            totalIn += matchingProduct.quantity;
          }
        }
      }

      // 6. stackStr
      const stacks = Array.from(
        new Set(matchingQuants.map((q) => q.lotName).filter(Boolean)),
      );
      const stackStr = stacks.join(', ') || null;

      // Persist the daily snapshot
      await this.prisma.dailyLocationStockSnapshot.upsert({
        where: {
          date_warehouseId_locationId_inventoryId: {
            date: start,
            warehouseId,
            locationId,
            inventoryId,
          },
        },
        update: {
          openingStock,
          erpStock,
          pendingInQty,
          pendingOutQty,
          totalIn,
          totalOut,
          closingStock,
          stack: stackStr,
          gateOpRefs: gateOpRefsStr,
        },
        create: {
          date: start,
          warehouseId,
          locationId,
          inventoryId,
          openingStock,
          erpStock,
          pendingInQty,
          pendingOutQty,
          totalIn,
          totalOut,
          closingStock,
          stack: stackStr,
          gateOpRefs: gateOpRefsStr,
        },
      });
    }

    console.log(
      `[Cron] Completed daily stock snapshots for ${uniqueKeys.size} location-product quants.`,
    );

    // Also populate warehouse-level DailyStockSnapshot for backward compatibility
    // We group by warehouseId and inventoryId, summing up closingStock
    const snapshotsYesterday =
      await this.prisma.dailyLocationStockSnapshot.findMany({
        where: {
          date: start,
        },
      });

    const warehouseGroupMap = new Map<string, number>();
    for (const s of snapshotsYesterday) {
      const gKey = `${s.warehouseId}_${s.inventoryId}`;
      const currentSum = warehouseGroupMap.get(gKey) || 0;
      warehouseGroupMap.set(gKey, currentSum + s.closingStock);
    }

    for (const [gKey, closingStock] of warehouseGroupMap.entries()) {
      const [warehouseIdStr, inventoryIdStr] = gKey.split('_');
      const warehouseId = parseInt(warehouseIdStr, 10);
      const inventoryId = parseInt(inventoryIdStr, 10);

      await this.prisma.dailyStockSnapshot.upsert({
        where: {
          date_warehouseId_inventoryId: {
            date: start,
            warehouseId,
            inventoryId,
          },
        },
        update: {
          closingStock,
        },
        create: {
          date: start,
          warehouseId,
          inventoryId,
          closingStock,
        },
      });
    }
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

    // 1. Fetch pending and verified Gate Operations from start date until TODAY
    const gateOps = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: { in: ['PENDING', 'VERIFIED'] },
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
      include: {
        products: {
          include: {
            quant: true,
          },
        },
        documentReference: true,
      },
    });

    // 1b. Fetch all active pending/unreconciled Gate Operations in this warehouse as of today to compute current real stock
    const activePendingOps = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: { in: ['PENDING', 'VERIFIED'] },
        OR: [
          { documentReferenceId: null },
          {
            documentReference: {
              state: { not: 'done' },
            },
          },
        ],
      },
      include: {
        products: true,
      },
    });

    // 2. Identify products that had movement within the selected period
    const movedProductIdsSet = new Set<number>();
    const dateRangeStart = start;
    const dateRangeEnd = end;

    for (const op of gateOps) {
      const opDate = op.verifiedAt || op.createdAt;
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
          },
        },
      },
    });

    // 4. Load location-level snapshots
    const locationSnapshots =
      await this.prisma.dailyLocationStockSnapshot.findMany({
        where: {
          warehouseId,
          inventoryId: { in: movedProductIds },
          date: {
            gte: start,
            lte: today,
          },
        },
      });

    // 5. Fetch all locations in the warehouse to map IDs to UUIDs and display names
    const dbLocations = await this.prisma.location.findMany({
      where: { warehouseId },
    });
    const locationsMap = new Map<number, (typeof dbLocations)[number]>(
      dbLocations.map((l) => [l.id, l]),
    );

    const reportRows: any[] = [];
    const datesList = this.generateDatesList(start, end);
    const backwardDates = this.generateDatesList(start, today).reverse();

    for (const prod of products) {
      // Ensure any location that had operations or has current quants or has active pending ops is included
      const activeLocationIds = new Set<number>();
      for (const q of prod.quants) {
        activeLocationIds.add(q.locationId);
      }
      for (const op of gateOps) {
        const matchingProducts = op.products.filter((p) => p.inventoryId === prod.id);
        for (const opProd of matchingProducts) {
          if (opProd.locationId) {
            activeLocationIds.add(opProd.locationId);
          }
        }
      }
      for (const op of activePendingOps) {
        const matchingProducts = op.products.filter((p) => p.inventoryId === prod.id);
        for (const opProd of matchingProducts) {
          if (opProd.locationId) {
            activeLocationIds.add(opProd.locationId);
          }
        }
      }

      // Get current physical stock for this product at each location in this warehouse
      // Formula: realStock = erpStock (Quant quantity) + pendingInQty - pendingOutQty
      const currentStockTrackerMap = new Map<number, number>();
      for (const locId of activeLocationIds) {
        const q = prod.quants.find((quant) => quant.locationId === locId);
        const erpStock = q ? q.quantity : 0;

        let pendingInQty = 0;
        let pendingOutQty = 0;
        for (const op of activePendingOps) {
          const matchingProducts = op.products.filter(
            (p) => p.inventoryId === prod.id && p.locationId === locId,
          );
          for (const opProd of matchingProducts) {
            if (op.cardType === 'IN') {
              pendingInQty += opProd.quantity;
            } else {
              pendingOutQty += opProd.quantity;
            }
          }
        }

        const realStock = erpStock + pendingInQty - pendingOutQty;
        currentStockTrackerMap.set(locId, realStock);
      }

      // Group gate operations by date and location for this product
      // Key: dateStr_locationId
      const locationTransactionsMap = new Map<
        string,
        { incoming: number; outgoing: number; inList: any[]; outList: any[] }
      >();

      for (const op of gateOps) {
        const matchingProducts = op.products.filter((p) => p.inventoryId === prod.id);
        for (const opProd of matchingProducts) {
          if (!opProd.locationId) continue;

          const dateStr = formatDateInTimezone(
            op.verifiedAt || op.createdAt,
            timezone,
          );
          const locId = opProd.locationId;
          const key = `${dateStr}_${locId}`;

          const current = locationTransactionsMap.get(key) || {
            incoming: 0,
            outgoing: 0,
            inList: [],
            outList: [],
          };

          const txDetail = {
            uuid: op.uuid,
            opNumber: op.opNumber,
            driverName: op.driverName,
            licensePlate: op.licensePlate,
            cardType: op.cardType,
            quantity: opProd.quantity,
            referenceDocument: op.documentReference?.documentNumber || '-',
            status: op.status,
            createdAt: op.verifiedAt || op.createdAt,
            stack: opProd.quant?.lotName || '-',
          };

          if (op.cardType === 'IN') {
            current.incoming += opProd.quantity;
            current.inList.push(txDetail);
          } else {
            current.outgoing += opProd.quantity;
            current.outList.push(txDetail);
          }

          locationTransactionsMap.set(key, current);
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

      // Perform backward calculation for each active location
      for (const locId of activeLocationIds) {
        let currentStockTracker = currentStockTrackerMap.get(locId) || 0;

        for (const dDate of backwardDates) {
          const dStr = formatDateInTimezone(dDate, timezone);
          const key = `${dStr}_${locId}`;
          const txs = locationTransactionsMap.get(key) || {
            incoming: 0,
            outgoing: 0,
            inList: [],
            outList: [],
          };

          let closing = 0;
          const snap = locationSnapshots.find(
            (s) =>
              s.locationId === locId &&
              s.inventoryId === prod.id &&
              formatDateInTimezone(s.date, timezone) === dStr,
          );

          if (dStr === todayStr) {
            closing = currentStockTracker;
          } else if (snap) {
            closing = snap.closingStock;
          } else {
            closing = currentStockTracker;
            // Persist snapshot to database to speed up future queries
            const openingForSnap = closing - txs.incoming + txs.outgoing;
            await this.prisma.dailyLocationStockSnapshot
              .create({
                data: {
                  date: dDate,
                  warehouseId,
                  locationId: locId,
                  inventoryId: prod.id,
                  openingStock: openingForSnap,
                  totalIn: txs.incoming,
                  totalOut: txs.outgoing,
                  closingStock: closing,
                },
              })
              .catch(() => {});
          }

          const opening = closing - txs.incoming + txs.outgoing;
          locationDailyMetrics.set(key, {
            opening,
            incoming: txs.incoming,
            outgoing: txs.outgoing,
            closing,
            inList: txs.inList,
            outList: txs.outList,
          });

          currentStockTracker = opening;
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

    const timezone = this.warehouseContext.getTimezone();
    const start = getLocalStartOfDay(query.date, timezone);
    const end = getLocalEndOfDay(query.date, timezone);

    const todayStr = formatDateInTimezone(new Date(), timezone);
    const today = getLocalEndOfDay(todayStr, timezone);

    // 1. Fetch ERP receipts and deliveries for this product on this day
    const erpItems = await this.prisma.documentReferenceItem.findMany({
      where: {
        inventoryId: inventory.id,
        documentReference: {
          warehouseId,
          state: 'done',
          dateDone: {
            gte: start,
            lte: end,
          },
        },
      },
      include: {
        documentReference: true,
      },
    });

    const erpTransactions = erpItems.map((item) => ({
      documentNumber: item.documentReference.documentNumber,
      partnerName:
        item.documentReference.partnerName ||
        item.documentReference.purchaseName ||
        'Tanpa Partner',
      pickingTypeCode: item.documentReference.pickingTypeCode, // incoming / outgoing
      quantity: item.quantity,
      scheduledDate: item.documentReference.scheduledDate,
      type: 'ERP_DOCUMENT',
    }));

    // 2. Fetch pending and verified gate operations for this product on this day
    const gateOps = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: { in: ['PENDING', 'VERIFIED'] },
        AND: [
          {
            OR: [
              { documentReferenceId: null },
              {
                documentReference: {
                  state: { not: 'done' },
                },
              },
            ],
          },
          {
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
      },
    });

    const unreconciledGateOps = gateOps.flatMap((op) => {
      return op.products.map((opProd) => ({
        documentNumber: op.opNumber,
        partnerName: op.driverName + ' (' + op.licensePlate + ')',
        pickingTypeCode: op.cardType === 'IN' ? 'incoming' : 'outgoing',
        quantity: opProd.quantity,
        scheduledDate: op.verifiedAt || op.createdAt,
        type: 'GATE_OPERATION',
      }));
    });

    const incomingTransactions = [
      ...erpTransactions.filter((tx) => tx.pickingTypeCode === 'incoming'),
      ...unreconciledGateOps.filter((tx) => tx.pickingTypeCode === 'incoming'),
    ];

    const outgoingTransactions = [
      ...erpTransactions.filter((tx) => tx.pickingTypeCode === 'outgoing'),
      ...unreconciledGateOps.filter((tx) => tx.pickingTypeCode === 'outgoing'),
    ];

    // 3. Calculate opening stock and closing stock for this product on this day
    const gateOpsForProd = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: { in: ['PENDING', 'VERIFIED'] },
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
      },
    });

    // Fetch all currently active pending/unreconciled Gate Operations for this product as of today to compute current real stock
    const activePendingOps = await this.prisma.gateOperation.findMany({
      where: {
        warehouseId,
        status: { in: ['PENDING', 'VERIFIED'] },
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
        },
      },
    });

    const quants = await this.prisma.quant.findMany({
      where: {
        inventoryId: inventory.id,
        location: { warehouseId },
      },
    });

    const locationSnapshots =
      await this.prisma.dailyLocationStockSnapshot.findMany({
        where: {
          warehouseId,
          inventoryId: inventory.id,
          date: {
            gte: start,
            lte: today,
          },
        },
      });

    const activeLocationIds = new Set<number>();
    for (const q of quants) {
      activeLocationIds.add(q.locationId);
    }
    for (const op of gateOpsForProd) {
      const matchingProducts = op.products.filter((p) => p.inventoryId === inventory.id);
      for (const opProd of matchingProducts) {
        if (opProd.locationId) {
          activeLocationIds.add(opProd.locationId);
        }
      }
    }
    for (const op of activePendingOps) {
      const matchingProducts = op.products.filter((p) => p.inventoryId === inventory.id);
      for (const opProd of matchingProducts) {
        if (opProd.locationId) {
          activeLocationIds.add(opProd.locationId);
        }
      }
    }

    const locationTransactionsMap = new Map<
      string,
      { incoming: number; outgoing: number }
    >();
    for (const op of gateOpsForProd) {
      const matchingProducts = op.products.filter((p) => p.inventoryId === inventory.id);
      for (const opProd of matchingProducts) {
        if (!opProd.locationId) continue;

        const dateStr = formatDateInTimezone(
          op.verifiedAt || op.createdAt,
          timezone,
        );
        const locId = opProd.locationId;
        const key = `${dateStr}_${locId}`;

        const current = locationTransactionsMap.get(key) || {
          incoming: 0,
          outgoing: 0,
        };
        if (op.cardType === 'IN') {
          current.incoming += opProd.quantity;
        } else {
          current.outgoing += opProd.quantity;
        }
        locationTransactionsMap.set(key, current);
      }
    }

    const currentStockTrackerMap = new Map<number, number>();
    for (const locId of activeLocationIds) {
      const q = quants.find((quant) => quant.locationId === locId);
      const erpStock = q ? q.quantity : 0;

      let pendingInQty = 0;
      let pendingOutQty = 0;
      for (const op of activePendingOps) {
        const matchingProducts = op.products.filter(
          (p) => p.inventoryId === inventory.id && p.locationId === locId,
        );
        for (const opProd of matchingProducts) {
          if (op.cardType === 'IN') {
            pendingInQty += opProd.quantity;
          } else {
            pendingOutQty += opProd.quantity;
          }
        }
      }

      const realStock = erpStock + pendingInQty - pendingOutQty;
      currentStockTrackerMap.set(locId, realStock);
    }

    const backwardDates = this.generateDatesList(start, today).reverse();
    const targetDateStr = formatDateInTimezone(start, timezone);

    let dayOpening = 0;
    let dayClosing = 0;

    for (const locId of activeLocationIds) {
      let currentStockTracker = currentStockTrackerMap.get(locId) || 0;

      for (const dDate of backwardDates) {
        const dStr = formatDateInTimezone(dDate, timezone);
        const key = `${dStr}_${locId}`;
        const txs = locationTransactionsMap.get(key) || {
          incoming: 0,
          outgoing: 0,
        };

        let closing = 0;
        const snap = locationSnapshots.find(
          (s) =>
            s.locationId === locId &&
            s.inventoryId === inventory.id &&
            formatDateInTimezone(s.date, timezone) === dStr,
        );

        if (dStr === todayStr) {
          closing = currentStockTracker;
        } else if (snap) {
          closing = snap.closingStock;
        } else {
          closing = currentStockTracker;
          const openingForSnap = closing - txs.incoming + txs.outgoing;
          await this.prisma.dailyLocationStockSnapshot
            .create({
              data: {
                date: dDate,
                warehouseId,
                locationId: locId,
                inventoryId: inventory.id,
                openingStock: openingForSnap,
                totalIn: txs.incoming,
                totalOut: txs.outgoing,
                closingStock: closing,
              },
            })
            .catch(() => {});
        }

        const opening = closing - txs.incoming + txs.outgoing;

        if (dStr === targetDateStr) {
          dayOpening += opening;
          dayClosing += closing;
        }

        currentStockTracker = opening;
      }
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

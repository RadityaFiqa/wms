import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { OdooClient } from '../odoo/odoo-client';
import { OdooSessionManager } from '../odoo/odoo-session.manager';
import PDFDocument from 'pdfkit';
import { getReconciledStockForQuants } from '@/core/utils/stock-reconciliation';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooClient: OdooClient,
    private readonly odooSessionManager: OdooSessionManager,
  ) {}

  /**
   * Synchronize inventory from Odoo for a specific active warehouse.
   */
  async syncOdooInventory(
    warehouseId: number,
    triggeredBy: string,
  ): Promise<{ success: boolean; syncedCount: number }> {
    // 1. Get active OdooAccount configuration for this warehouse
    const account = await this.prisma.odooAccount.findUnique({
      where: { warehouseId },
      include: { warehouse: true },
    });

    if (!account) {
      throw new NotFoundException(
        'Akun Odoo untuk gudang aktif ini belum dikonfigurasi.',
      );
    }

    if (!account.isActive) {
      throw new BadRequestException('Akun Odoo untuk gudang ini tidak aktif.');
    }

    // Validate and refresh session upfront to get dynamic context
    await this.odooSessionManager.validateAndRefreshSession(account.id);
    const refreshedAccount = await this.prisma.odooAccount.findUnique({
      where: { id: account.id },
    });

    if (!refreshedAccount?.sessionId) {
      throw new BadRequestException('Session ID Odoo kosong setelah refresh.');
    }

    // Retrieve active Odoo user metadata dynamically using standard search_read on res.users
    let uid = 6900;
    let allowed_company_ids = [122];
    let current_company_id = 122;

    try {
      const userRes = await this.safeOdooCall(
        warehouseId,
        'res.users',
        'web_search_read',
        [],
        {
          domain: [['login', '=', account.username]],
          specification: {
            id: {},
            company_id: { fields: { display_name: {} } },
            company_ids: { fields: { display_name: {} } },
          },
          limit: 1,
        },
      );

      const userRecord = userRes?.records?.[0];
      if (userRecord) {
        uid = userRecord.id;
        current_company_id = userRecord.company_id?.id || 122;
        allowed_company_ids = Array.isArray(userRecord.company_ids)
          ? userRecord.company_ids.map((c: any) => c.id).filter(Boolean)
          : [current_company_id];
      }
    } catch (err: any) {
      this.logger.warn(
        `Gagal mengambil informasi user dari res.users: ${err.message}. Menggunakan default context.`,
      );
    }

    const context = {
      lang: 'id_ID',
      tz: 'Asia/Makassar',
      uid,
      allowed_company_ids,
      bin_size: true,
      current_company_id,
    };

    // 2. Fetch all products from Odoo directly
    let productResponse: any;
    try {
      productResponse = await this.safeOdooCall(
        warehouseId,
        'product.product',
        'web_search_read',
        [],
        {
          specification: {
            priority: {},
            default_code: {},
            barcode: {},
            name: {},
            is_published: {},
            product_template_variant_value_ids: { fields: { display_name: {} } },
            company_id: { fields: { display_name: {} } },
            lst_price: {},
            standard_price: {},
            categ_id: { fields: { display_name: {} } },
            product_tag_ids: { fields: { display_name: {} } },
            additional_product_tag_ids: { fields: { display_name: {} } },
            ribbon_id: { fields: { display_name: {} } },
            type: {},
            uom_id: { fields: { display_name: {} } },
            sh_secondary_uom_onhand: {},
            sh_secondary_uom_forecasted: {},
            sh_secondary_uom_id: { fields: { display_name: {} } },
            product_tmpl_id: { fields: {} },
            active: {},
          },
          offset: 0,
          order: '',
          limit: 5000,
          context,
          count_limit: 10001,
          domain: [],
        },
      );
    } catch (err: any) {
      await this.prisma.odooAccount
        .update({
          where: { id: account.id },
          data: {
            lastSyncInventoryAt: new Date(),
            lastSyncInventoryStatus: 'FAILED',
            lastSyncInventoryError: `Gagal memanggil API product.product: ${err.message}`,
            lastSyncInventoryBy: triggeredBy,
          },
        })
        .catch((e) => console.error('Failed to log sync status error', e));
      throw new BadRequestException(`Gagal memanggil API Odoo product.product: ${err.message}`);
    }

    const products = productResponse?.records || [];

    // 3. Fetch all locations from Odoo directly
    let locationResponse: any;
    try {
      locationResponse = await this.safeOdooCall(
        warehouseId,
        'stock.location',
        'web_search_read',
        [],
        {
          specification: {
            company_id: { fields: { display_name: {} } },
            triger_compute: {},
            branch_id: { fields: { display_name: {} } },
            warehouse_id: { fields: { display_name: {} } },
            active: {},
            complete_name: {},
            qty_on_hand: {},
            usage: {},
            barcode: {},
            posx: {},
            posy: {},
            posz: {},
            sizex: {},
            sizey: {},
            sizez: {},
            tag_ids: { fields: { display_name: {}, color: {} } },
          },
          offset: 0,
          order: '',
          limit: 5000,
          context: {
            ...context,
            params: {
              action: 2693,
              model: 'stock.location',
              view_type: 'list',
              cids: current_company_id,
              menu_id: 2090,
            },
            create: false,
            delete: false,
            edit: false,
          },
          count_limit: 10001,
          domain: [
            '&',
            '&',
            ['usage', '=', 'internal'],
            ['access_user_ids', 'in', [uid]],
            ['usage', '=', 'internal'],
          ],
        },
      );
    } catch (err: any) {
      await this.prisma.odooAccount
        .update({
          where: { id: account.id },
          data: {
            lastSyncInventoryAt: new Date(),
            lastSyncInventoryStatus: 'FAILED',
            lastSyncInventoryError: `Gagal memanggil API stock.location: ${err.message}`,
            lastSyncInventoryBy: triggeredBy,
          },
        })
        .catch((e) => console.error('Failed to log sync status error', e));
      throw new BadRequestException(`Gagal memanggil API Odoo stock.location: ${err.message}`);
    }

    const locations = locationResponse?.records || [];

    // 4. Fetch quants from Odoo in batch
    const domain = [
      ['quantity', '>=', 0.01],
      ['product_id.type', '=', 'product'],
      ['location_id.usage', '=', 'internal'],
    ];

    const specification = {
      id: {}, // Direct Odoo quant ID
      product_id: {
        fields: {
          display_name: {},
          default_code: {},
          uom_id: {
            fields: {
              display_name: {},
            },
          },
        },
      },
      location_id: {
        fields: {
          display_name: {},
        },
      },
      lot_id: {
        fields: {
          display_name: {},
        },
      },
      quantity: {},
      reserved_quantity: {},
      available_quantity: {},
      sh_secondary_unit_qty: {},
    };

    let response: any;
    try {
      response = await this.safeOdooCall(
        warehouseId,
        'stock.quant',
        'web_search_read',
        [],
        {
          domain,
          specification,
          limit: 5000,
        },
      );
    } catch (err: any) {
      await this.prisma.odooAccount
        .update({
          where: { id: account.id },
          data: {
            lastSyncInventoryAt: new Date(),
            lastSyncInventoryStatus: 'FAILED',
            lastSyncInventoryError: `Gagal memanggil API stock.quant: ${err.message}`,
            lastSyncInventoryBy: triggeredBy,
          },
        })
        .catch((e) => console.error('Failed to log sync status error', e));
      throw new BadRequestException(`Gagal memanggil API Odoo stock.quant: ${err.message}`);
    }

    const records = response?.records || [];

    try {
      // 5. DB Transaction to save results locally
      await this.prisma.$transaction(
        async (tx) => {
          await this.saveInventorySyncData(tx, warehouseId, products, locations, records);
        },
        { timeout: 900_000 },
      );

      console.log(`completed`)

      const finishedAt = new Date();
      await this.prisma.odooAccount.update({
        where: { id: account.id },
        data: {
          lastSyncInventoryAt: finishedAt,
          lastSyncInventoryStatus: 'SUCCESS',
          lastSyncInventoryError: null,
          lastSyncInventoryBy: triggeredBy,
          lastSyncInventoryCount: records.length,
        },
      });

      return {
        success: true,
        syncedCount: records.length,
      };
    } catch (err: any) {
      await this.prisma.odooAccount
        .update({
          where: { id: account.id },
          data: {
            lastSyncInventoryAt: new Date(),
            lastSyncInventoryStatus: 'FAILED',
            lastSyncInventoryError: `Gagal menyimpan ke database: ${err.message}`,
            lastSyncInventoryBy: triggeredBy,
          },
        })
        .catch((e) => console.error('Failed to log sync status error', e));
      throw err;
    }
  }

  public async saveInventorySyncData(
    tx: any,
    warehouseId: number,
    products: any[],
    locations: any[],
    records: any[], // quants
  ) {
    // --- Batch Sync Products ---
    const allProductIds = products.map((p: any) => p.id);
    const existingInv = await tx.inventory.findMany({
      where: { id: { in: allProductIds } },
      select: { id: true, sku: true, name: true, uom: true, warehouseId: true },
    });
    const existingMap = new Map<number, typeof existingInv[number]>(existingInv.map(p => [p.id, p]));

    const productsToCreate: any[] = [];
    const productsToUpdate: any[] = [];

    for (const record of products) {
      const odooProdId = record.id;
      const rawSku = record.default_code;
      const productName = record.name || record.display_name || 'Unnamed Product';
      const sku =
        rawSku && typeof rawSku === 'string' && rawSku.trim() !== ''
          ? rawSku.trim()
          : `OP-${odooProdId}`;
      const uom = record.uom_id?.display_name || 'Unit';

      const existing = existingMap.get(odooProdId);
      if (!existing) {
        productsToCreate.push({
          id: odooProdId,
          sku,
          name: productName,
          uom,
          warehouseId,
        });
      } else if (
        existing.sku !== sku ||
        existing.name !== productName ||
        existing.uom !== uom ||
        existing.warehouseId !== warehouseId
      ) {
        productsToUpdate.push({
          id: odooProdId,
          sku,
          name: productName,
          uom,
          warehouseId,
        });
      }
    }

    if (productsToCreate.length > 0) {
      await tx.inventory.createMany({
        data: productsToCreate,
        skipDuplicates: true,
      });
    }

    for (const item of productsToUpdate) {
      await tx.inventory.update({
        where: { id: item.id },
        data: {
          sku: item.sku,
          name: item.name,
          uom: item.uom,
          warehouseId: item.warehouseId,
        },
      });
    }

    // Safety check: process any products from stock.quant records that might not be in the products list
    const quantProductIds = records.map((r: any) => r.product_id?.id).filter(Boolean);
    const finalExistingInv = await tx.inventory.findMany({
      where: { id: { in: quantProductIds } },
      select: { id: true },
    });
    const finalExistingInvIds = new Set(finalExistingInv.map(p => p.id));

    for (const record of records) {
      const odooProd = record.product_id;
      if (!odooProd || finalExistingInvIds.has(odooProd.id)) continue;

      const odooProdId = odooProd.id;
      const rawSku = odooProd.default_code;
      const productName = odooProd.display_name || 'Unnamed Product';
      const sku =
        rawSku && typeof rawSku === 'string' && rawSku.trim() !== ''
          ? rawSku.trim()
          : `OP-${odooProdId}`;
      const uom = odooProd.uom_id?.display_name || 'Unit';

      await tx.inventory.upsert({
        where: { id: odooProdId },
        update: {
          sku,
          name: productName,
          uom,
          warehouseId,
        },
        create: {
          id: odooProdId,
          sku,
          name: productName,
          uom,
          warehouseId,
        },
      });
      finalExistingInvIds.add(odooProdId);
    }

    // --- Batch Sync Locations ---
    const allLocIds = locations.map((l: any) => l.id);
    const existingLocs = await tx.location.findMany({
      where: { id: { in: allLocIds } },
      select: { id: true, displayName: true, warehouseId: true },
    });
    const existingLocMap = new Map<number, typeof existingLocs[number]>(existingLocs.map(l => [l.id, l]));

    const locsToCreate: any[] = [];
    const locsToUpdate: any[] = [];

    for (const record of locations) {
      const odooLocId = record.id;
      const displayName = record.complete_name || record.display_name || 'Unnamed Location';

      const existing = existingLocMap.get(odooLocId);
      if (!existing) {
        locsToCreate.push({
          id: odooLocId,
          displayName,
          warehouseId,
        });
      } else if (
        existing.displayName !== displayName ||
        existing.warehouseId !== warehouseId
      ) {
        locsToUpdate.push({
          id: odooLocId,
          displayName,
          warehouseId,
        });
      }
    }

    if (locsToCreate.length > 0) {
      await tx.location.createMany({
        data: locsToCreate,
        skipDuplicates: true,
      });
    }

    for (const item of locsToUpdate) {
      await tx.location.update({
        where: { id: item.id },
        data: {
          displayName: item.displayName,
          warehouseId: item.warehouseId,
        },
      });
    }

    // Safety check: collect unique locations from stock.quant records and Upsert them
    const quantLocIds = records.map((r: any) => r.location_id?.id).filter(Boolean);
    const finalExistingLoc = await tx.location.findMany({
      where: { id: { in: quantLocIds } },
      select: { id: true },
    });
    const finalExistingLocIds = new Set(finalExistingLoc.map(l => l.id));

    const uniqueQuantLocations = new Map<number, string>();
    for (const record of records) {
      const odooLoc = record.location_id;
      if (odooLoc && !finalExistingLocIds.has(odooLoc.id)) {
        uniqueQuantLocations.set(
          odooLoc.id,
          odooLoc.display_name || 'Unnamed Location',
        );
      }
    }

    for (const [odooLocId, displayName] of uniqueQuantLocations.entries()) {
      await tx.location.upsert({
        where: { id: odooLocId },
        update: {
          displayName,
        },
        create: {
          id: odooLocId,
          displayName,
          warehouseId,
        },
      });
    }

    // Re-query locations to get correct IDs inside this warehouse
    const allLocations = await tx.location.findMany({
      where: { warehouseId },
    });

    const locationIds = allLocations.map((l) => l.id);

    // Get existing quants in these locations
    const existingQuants = await tx.quant.findMany({
      where: {
        locationId: { in: locationIds },
      },
      select: { id: true },
    });
    const existingQuantIds = new Set<number>(existingQuants.map((q: any) => q.id));

    // Prepare quants to create and update
    const quantsToCreate: any[] = [];
    const quantsToUpdate: any[] = [];
    const incomingQuantIds = new Set<number>();

    for (const record of records) {
      const odooProd = record.product_id;
      const odooLoc = record.location_id;
      if (!odooProd || !odooLoc || !record.id) continue;

      const odooProdId = odooProd.id;
      const odooLocId = odooLoc.id;
      const quantId = record.id;
      incomingQuantIds.add(quantId);

      const lotName = record.lot_id
        ? record.lot_id.display_name || null
        : null;
      const quantity = Number(record.quantity) || 0.0;
      const reservedQuantity = Number(record.reserved_quantity) || 0.0;
      const availableQuantity = Number(record.available_quantity) || 0.0;
      const secondaryUnitQty =
        record.sh_secondary_unit_qty !== undefined
          ? Number(record.sh_secondary_unit_qty) || 0.0
          : 0.0;

      const quantData = {
        id: quantId,
        inventoryId: odooProdId,
        locationId: odooLocId,
        quantity,
        reservedQuantity,
        availableQuantity,
        secondaryUnitQty,
        lotName,
      };

      if (existingQuantIds.has(quantId)) {
        quantsToUpdate.push(quantData);
      } else {
        quantsToCreate.push(quantData);
      }
    }

    // Update existing quants that are still present
    if (quantsToUpdate.length > 0) {
      await Promise.all(
        quantsToUpdate.map((quant) =>
          tx.quant.update({
            where: { id: quant.id },
            data: {
              inventoryId: quant.inventoryId,
              locationId: quant.locationId,
              quantity: quant.quantity,
              reservedQuantity: quant.reservedQuantity,
              availableQuantity: quant.availableQuantity,
              secondaryUnitQty: quant.secondaryUnitQty,
              lotName: quant.lotName,
            },
          }),
        ),
      );
    }

    // Set quants that are NOT in the incoming list to 0 quantity instead of deleting them,
    // to preserve their references in GateOperationProduct (due to ON DELETE SET NULL)
    const quantIdsToZero = [...existingQuantIds].filter((id) => !incomingQuantIds.has(id));
    if (quantIdsToZero.length > 0) {
      await tx.quant.updateMany({
        where: {
          id: { in: quantIdsToZero },
        },
        data: {
          quantity: 0.0,
          reservedQuantity: 0.0,
          availableQuantity: 0.0,
          secondaryUnitQty: 0.0,
        },
      });
    }

    // Bulk Insert new Quants
    if (quantsToCreate.length > 0) {
      await tx.quant.createMany({
        data: quantsToCreate,
        skipDuplicates: true,
      });
    }
  }

  /**
   * Find paginated inventory list for active warehouse, including summary totals.
   */
  async findAll(
    warehouseId: number,
    query: { search?: string; page?: number; limit?: number },
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      warehouseId,
      quants: {
        some: {
          location: {
            warehouseId,
          },
          quantity: {
            gt: 0,
          },
        },
      },
    };

    if (query.search) {
      where.AND = [
        {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { sku: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    // 1. Query paginated list
    const [total, data] = await Promise.all([
      this.prisma.inventory.count({ where }),
      this.prisma.inventory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          quants: {
            where: {
              location: {
                warehouseId,
              },
              quantity: {
                gt: 0,
              },
            },
            include: {
              location: true,
            },
          },
        },
      }),
    ]);

    const formattedData = data.map((inv) => {
      const quants = inv.quants || [];

      let totalQty = 0;
      let totalAvailable = 0;
      const uniqueLocationIds = new Set<number>();

      for (const q of quants) {
        totalQty += q.quantity;
        totalAvailable += q.availableQuantity;
        uniqueLocationIds.add(q.locationId);
      }

      return {
        uuid: inv.uuid,
        sku: inv.sku,
        name: inv.name,
        uom: inv.uom || 'Unit',
        totalQuantity: totalQty,
        totalAvailable: totalAvailable,
        locationCount: uniqueLocationIds.size,
      };
    });

    // 2. Query summary statistics for the ENTIRE warehouse
    const activeProducts = await this.prisma.quant.groupBy({
      by: ['inventoryId'],
      where: {
        location: { warehouseId },
        quantity: { gt: 0 },
      },
    });

    const [summaryLocations, quantAggregates] = await Promise.all([
      this.prisma.location.count({
        where: { warehouseId },
      }),
      this.prisma.quant.aggregate({
        where: {
          location: { warehouseId },
        },
        _sum: {
          quantity: true,
          reservedQuantity: true,
          availableQuantity: true,
        },
      }),
    ]);

    const summary = {
      totalProducts: activeProducts.length,
      totalLocations: summaryLocations,
      totalQuantity: quantAggregates._sum.quantity || 0,
      totalReserved: quantAggregates._sum.reservedQuantity || 0,
      totalAvailable: quantAggregates._sum.availableQuantity || 0,
    };

    return {
      data: formattedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    };
  }

  /**
   * Get detailed product inventory, grouped by locations and showing quants.
   */
  async findDetail(warehouseId: number, inventoryUuid: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { uuid: inventoryUuid },
      include: {
        quants: {
          where: {
            location: {
              warehouseId,
            },
            quantity: {
              gt: 0,
            },
          },
          include: {
            location: true,
          },
          orderBy: [{ location: { displayName: 'asc' } }, { lotName: 'asc' }],
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory tidak ditemukan.');
    }

    const reconciledStockMap = await getReconciledStockForQuants(
      this.prisma,
      warehouseId,
      inventory.id,
    );

    const locationsMap = new Map<
      string,
      {
        locationId: number;
        locationUuid: string;
        locationDisplayName: string;
        quants: any[];
      }
    >();

    for (const q of inventory.quants) {
      const loc = q.location;
      if (!locationsMap.has(loc.uuid)) {
        locationsMap.set(loc.uuid, {
          locationId: loc.id,
          locationUuid: loc.uuid,
          locationDisplayName: loc.displayName,
          quants: [],
        });
      }

      locationsMap.get(loc.uuid)!.quants.push({
        id: q.id,
        uuid: q.uuid,
        locationId: loc.id,
        lotName: q.lotName || '-',
        quantity: q.quantity,
        reservedQuantity: q.reservedQuantity,
        availableQuantity: reconciledStockMap.get(q.id) ?? q.availableQuantity,
        secondaryUnitQty: q.secondaryUnitQty || 0.0,
      });
    }

    return {
      product: {
        uuid: inventory.uuid,
        sku: inventory.sku,
        name: inventory.name,
        uom: inventory.uom || 'Unit',
      },
      locations: Array.from(locationsMap.values()),
    };
  }

  /**
   * Generates a print-ready PDF containing WMS stock status.
   */
  async generatePdfReport(
    warehouseId: number,
    query: { search?: string },
  ): Promise<Buffer> {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    const warehouseName = warehouse ? warehouse.name : 'Gudang WMS';

    const where: any = {
      quants: {
        some: {
          location: { warehouseId },
          quantity: { gt: 0 },
        },
      },
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const data = await this.prisma.inventory.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        quants: {
          where: {
            location: {
              warehouseId,
            },
            quantity: {
              gt: 0,
            },
          },
          include: {
            location: true,
          },
        },
      },
    });

    let totalItems = 0;
    for (const inv of data) {
      totalItems += inv.quants?.length || 0;
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 15, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Global Header drawing function
      const drawPageHeader = (pageDoc: any, isFirstPage = false) => {
        let y = 15;
        if (isFirstPage) {
          pageDoc
            .fillColor('#1e293b')
            .fontSize(10)
            .font('Helvetica-Bold')
            .text('LAPORAN INVENTORY', 15, y, { align: 'center', width: 565 });
          pageDoc
            .fontSize(6.8)
            .font('Helvetica')
            .fillColor('#64748b')
            .text(
              `Cetak: ${new Date().toLocaleString('id-ID')}  |  Warehouse: ${warehouseName}`,
              15,
              y + 14,
              { align: 'center', width: 565 },
            );
          y = 48;
        }

        // Global columns headers
        pageDoc.fillColor('#475569').fontSize(6.5).font('Helvetica-Bold');
        pageDoc.text('Produk (Nama)', 20, y, { width: 140, ellipsis: true });
        pageDoc.text('Lokasi', 165, y, { width: 80, ellipsis: true });
        pageDoc.text('Lot / Batch', 250, y, { width: 105, ellipsis: true });
        pageDoc.text('Qty', 360, y, { width: 50, align: 'right' });
        pageDoc.text('UOM', 415, y, { width: 75, ellipsis: true });
        pageDoc.text('Sekunder Qty', 495, y, { width: 70, align: 'right' });
        pageDoc.font('Helvetica');

        pageDoc
          .moveTo(15, y + 8)
          .lineTo(580, y + 8)
          .lineWidth(0.4)
          .stroke('#475569');
        return y + 12;
      };

      let currentY = drawPageHeader(doc, true);
      doc.y = currentY;

      if (data.length === 0) {
        doc
          .fillColor('#94a3b8')
          .fontSize(7.5)
          .text(
            'Tidak ada data persediaan barang dengan stok aktif.',
            15,
            doc.y + 10,
            { align: 'center' },
          );
      } else {
        for (const inv of data) {
          const quants = inv.quants || [];

          // Group by location
          const locationsMap = new Map<
            number,
            { name: string; quants: any[] }
          >();
          for (const q of quants) {
            const loc = q.location;
            if (!locationsMap.has(loc.id)) {
              locationsMap.set(loc.id, { name: loc.displayName, quants: [] });
            }
            locationsMap.get(loc.id)!.quants.push(q);
          }

          // Sort locations hierarchically and alphabetically by name (splitting by '/' and sorting before and after)
          const sortedLocations = Array.from(locationsMap.values()).sort(
            (a, b) => {
              const partsA = (a.name || '').split('/').map((p) => p.trim());
              const partsB = (b.name || '').split('/').map((p) => p.trim());
              const maxLen = Math.max(partsA.length, partsB.length);
              for (let i = 0; i < maxLen; i++) {
                if (partsA[i] === undefined) return -1;
                if (partsB[i] === undefined) return 1;
                const cmp = partsA[i].localeCompare(partsB[i], 'id', {
                  numeric: true,
                  sensitivity: 'base',
                });
                if (cmp !== 0) return cmp;
              }
              return 0;
            },
          );

          // Also sort lots inside each location alphabetically
          for (const locData of sortedLocations) {
            locData.quants.sort((a, b) => {
              const nameA = a.lotName || '';
              const nameB = b.lotName || '';
              return nameA.localeCompare(nameB, 'id', {
                numeric: true,
                sensitivity: 'base',
              });
            });
          }

          let productQtyTotal = 0;
          let productSecQtyTotal = 0;

          // Pre-calculate totals for Product Summary
          for (const locData of sortedLocations) {
            for (const q of locData.quants) {
              productQtyTotal += q.quantity;
              productSecQtyTotal += q.secondaryUnitQty || 0;
            }
          }

          // Render Product Summary Row at the TOP of the product block
          const prodTotalHeight = 16;
          if (currentY + prodTotalHeight > 815) {
            doc.addPage();
            currentY = drawPageHeader(doc);
          }

          // Draw thicker line above product summary
          doc
            .moveTo(15, currentY)
            .lineTo(580, currentY)
            .lineWidth(0.4)
            .stroke('#475569');

          doc.fillColor('#1e293b').fontSize(6.8).font('Helvetica-Bold');
          doc.text(`${inv.name}`, 20, currentY + 4, {
            width: 335,
            ellipsis: true,
          });
          doc.text(productQtyTotal.toLocaleString('id-ID'), 360, currentY + 4, {
            width: 50,
            align: 'right',
          });
          doc.text(inv.uom || 'Unit', 415, currentY + 4, {
            width: 75,
            ellipsis: true,
          });
          const prodSecQtyText =
            productSecQtyTotal > 0
              ? productSecQtyTotal.toLocaleString('id-ID')
              : '-';
          doc.text(prodSecQtyText, 495, currentY + 4, {
            width: 70,
            align: 'right',
          });
          doc.font('Helvetica');

          // Draw thicker line below product summary
          doc
            .moveTo(15, currentY + prodTotalHeight - 0.5)
            .lineTo(580, currentY + prodTotalHeight - 0.5)
            .lineWidth(0.4)
            .stroke('#475569');
          currentY += prodTotalHeight;

          // Add margin/gap after product summary border before starting location blocks
          currentY += 4;

          let isFirstLoc = true;

          for (const locData of sortedLocations) {
            let locQtyTotal = 0;
            let locSecQtyTotal = 0;

            for (const q of locData.quants) {
              locQtyTotal += q.quantity;
              locSecQtyTotal += q.secondaryUnitQty || 0;
            }

            // Render Location Summary Row at the TOP of the location block
            const locSubtotalHeight = 13;
            if (currentY + locSubtotalHeight > 815) {
              doc.addPage();
              currentY = drawPageHeader(doc);
            }

            // Draw line above location subtotal
            doc
              .moveTo(165, currentY)
              .lineTo(580, currentY)
              .lineWidth(0.2)
              .stroke('#94a3b8');

            doc.fillColor('#475569').fontSize(6.5).font('Helvetica-Bold');
            doc.text(`${locData.name}`, 165, currentY + 3, {
              width: 190,
              ellipsis: true,
            });
            doc.text(locQtyTotal.toLocaleString('id-ID'), 360, currentY + 3, {
              width: 50,
              align: 'right',
            });
            doc.text(inv.uom || 'Unit', 415, currentY + 3, {
              width: 75,
              ellipsis: true,
            });
            const locSecQtyText =
              locSecQtyTotal > 0 ? locSecQtyTotal.toLocaleString('id-ID') : '-';
            doc.text(locSecQtyText, 495, currentY + 3, {
              width: 70,
              align: 'right',
            });
            doc.font('Helvetica');

            // Draw line below location subtotal
            doc
              .moveTo(165, currentY + locSubtotalHeight - 0.5)
              .lineTo(580, currentY + locSubtotalHeight - 0.5)
              .lineWidth(0.2)
              .stroke('#94a3b8');
            currentY += locSubtotalHeight;

            // Add margin/gap after location summary border before rendering its lots
            currentY += 3;

            // Render each lot inside this location
            for (const q of locData.quants) {
              doc.font('Helvetica').fontSize(5.8);

              const lotName = q.lotName || '-';
              const lotHeight = doc.heightOfString(lotName, { width: 105 });
              const rowHeight = lotHeight + 1.2;

              // Check overflow
              if (currentY + rowHeight > 815) {
                doc.addPage();
                currentY = drawPageHeader(doc);

                // Reprint on new page for context
                const pageLocationText = `(Cont.) ${locData.name}`;

                const secQtyText =
                  q.secondaryUnitQty > 0
                    ? q.secondaryUnitQty.toLocaleString('id-ID')
                    : '-';

                doc.fillColor('#475569').fontSize(5.8);
                doc.text(pageLocationText, 165, currentY, {
                  width: 80,
                  ellipsis: true,
                });

                doc.fillColor('#334155');
                doc.text(lotName, 250, currentY, {
                  width: 105,
                  ellipsis: true,
                });
                doc.text(q.quantity.toLocaleString('id-ID'), 360, currentY, {
                  width: 50,
                  align: 'right',
                });
                doc.text(inv.uom || 'Unit', 415, currentY, {
                  width: 75,
                  ellipsis: true,
                });
                doc.text(secQtyText, 495, currentY, {
                  width: 70,
                  align: 'right',
                });

                doc
                  .moveTo(15, currentY + rowHeight - 0.5)
                  .lineTo(580, currentY + rowHeight - 0.5)
                  .lineWidth(0.08)
                  .stroke('#e2e8f0');
                currentY += rowHeight;
              } else {
                const secQtyText =
                  q.secondaryUnitQty > 0
                    ? q.secondaryUnitQty.toLocaleString('id-ID')
                    : '-';

                doc.fillColor('#334155').fontSize(5.8);
                doc.text(lotName, 250, currentY, {
                  width: 105,
                  ellipsis: true,
                });
                doc.text(q.quantity.toLocaleString('id-ID'), 360, currentY, {
                  width: 50,
                  align: 'right',
                });
                doc.text(inv.uom || 'Unit', 415, currentY, {
                  width: 75,
                  ellipsis: true,
                });
                doc.text(secQtyText, 495, currentY, {
                  width: 70,
                  align: 'right',
                });

                doc
                  .moveTo(15, currentY + rowHeight - 0.5)
                  .lineTo(580, currentY + rowHeight - 0.5)
                  .lineWidth(0.08)
                  .stroke('#e2e8f0');
                currentY += rowHeight;
              }
            }
            isFirstLoc = false;
          }

          // Add a spacing gap between products
          currentY += 6;
        }
      }

      doc.end();
    });
  }

  /**
   * Safe call to Odoo Client that automatically refreshes session on Session Expired error.
   */
  private async safeOdooCall(
    warehouseId: number,
    model: string,
    method: string,
    args: any[] = [],
    kwargs: any = {},
  ): Promise<any> {
    const account = await this.prisma.odooAccount.findUnique({
      where: { warehouseId },
    });

    if (!account) {
      throw new NotFoundException(
        'Akun Odoo untuk gudang aktif ini belum dikonfigurasi.',
      );
    }

    // 1. Validate session initially
    await this.odooSessionManager.validateAndRefreshSession(account.id);

    // Fetch the account again to get the fresh sessionId
    let refreshedAccount = await this.prisma.odooAccount.findUnique({
      where: { id: account.id },
    });

    if (!refreshedAccount?.sessionId || !refreshedAccount?.baseUrl) {
      throw new BadRequestException('Session ID Odoo kosong setelah refresh.');
    }

    const triedSessionId = refreshedAccount.sessionId;

    try {
      return await this.odooClient.call(
        refreshedAccount.baseUrl,
        triedSessionId,
        {
          model,
          method,
          args,
          kwargs,
        },
      );
    } catch (err: any) {
      const isSessionExpired =
        err.message.includes('Session expired') ||
        err.message.includes('Session Expired') ||
        err.message.includes('SessionExpiredException') ||
        err.message.includes('session expired');

      if (isSessionExpired) {
        // Query database again to see if session has changed in the meantime
        const currentAccount = await this.prisma.odooAccount.findUnique({
          where: { id: account.id },
        });

        const latestSessionId = currentAccount?.sessionId;
        if (latestSessionId && latestSessionId !== triedSessionId) {
          this.logger.log(
            `Session Odoo untuk gudang ${account.warehouseId} telah diperbarui oleh proses lain. Mencoba ulang dengan session baru...`,
          );
          return await this.odooClient.call(
            currentAccount.baseUrl,
            latestSessionId,
            {
              model,
              method,
              args,
              kwargs,
            },
          );
        }

        this.logger.log(
          `Session Odoo untuk gudang ${account.warehouseId} kedaluwarsa. Melakukan refresh session...`,
        );
        // Force refresh session
        await this.odooSessionManager.invalidateSession(account.id);
        await this.odooSessionManager.validateAndRefreshSession(account.id);

        refreshedAccount = await this.prisma.odooAccount.findUnique({
          where: { id: account.id },
        });

        if (refreshedAccount?.sessionId) {
          // Retry call once
          return await this.odooClient.call(
            refreshedAccount.baseUrl,
            refreshedAccount.sessionId,
            {
              model,
              method,
              args,
              kwargs,
            },
          );
        }
      }

      throw err;
    }
  }
}

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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var InventoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/prisma/prisma.service");
const odoo_client_1 = require("../odoo/odoo-client");
const odoo_session_manager_1 = require("../odoo/odoo-session.manager");
const pdfkit_1 = __importDefault(require("pdfkit"));
let InventoryService = InventoryService_1 = class InventoryService {
    prisma;
    odooClient;
    odooSessionManager;
    logger = new common_1.Logger(InventoryService_1.name);
    constructor(prisma, odooClient, odooSessionManager) {
        this.prisma = prisma;
        this.odooClient = odooClient;
        this.odooSessionManager = odooSessionManager;
    }
    async syncOdooInventory(warehouseId, triggeredBy) {
        const account = await this.prisma.odooAccount.findUnique({
            where: { warehouseId },
            include: { warehouse: true },
        });
        if (!account) {
            throw new common_1.NotFoundException('Akun Odoo untuk gudang aktif ini belum dikonfigurasi.');
        }
        if (!account.isActive) {
            throw new common_1.BadRequestException('Akun Odoo untuk gudang ini tidak aktif.');
        }
        const domain = [
            ['quantity', '>=', 0.01],
            ['product_id.type', '=', 'product'],
            ['location_id.usage', '=', 'internal'],
        ];
        const specification = {
            id: {},
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
        let response;
        try {
            response = await this.safeOdooCall(warehouseId, 'stock.quant', 'web_search_read', [], {
                domain,
                specification,
                limit: 5000,
            });
        }
        catch (err) {
            await this.prisma.odooAccount.update({
                where: { id: account.id },
                data: {
                    lastSyncAt: new Date(),
                    lastSyncStatus: 'FAILED',
                    lastSyncError: `Gagal memanggil API: ${err.message}`,
                    lastSyncBy: triggeredBy,
                },
            }).catch((e) => console.error('Failed to log sync status error', e));
            throw new common_1.BadRequestException(`Gagal memanggil API Odoo: ${err.message}`);
        }
        const records = response?.records || [];
        try {
            await this.prisma.$transaction(async (tx) => {
                for (const record of records) {
                    const odooProd = record.product_id;
                    if (!odooProd)
                        continue;
                    const odooProdId = odooProd.id;
                    const rawSku = odooProd.default_code;
                    const productName = odooProd.display_name || 'Unnamed Product';
                    const sku = rawSku && typeof rawSku === 'string' && rawSku.trim() !== ''
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
                }
                const uniqueOdooLocations = new Map();
                for (const record of records) {
                    const odooLoc = record.location_id;
                    if (odooLoc) {
                        uniqueOdooLocations.set(odooLoc.id, odooLoc.display_name || 'Unnamed Location');
                    }
                }
                for (const [odooLocId, displayName] of uniqueOdooLocations.entries()) {
                    await tx.location.upsert({
                        where: {
                            id: odooLocId,
                        },
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
                const allLocations = await tx.location.findMany({
                    where: { warehouseId },
                });
                const locationIds = allLocations.map((l) => l.id);
                await tx.quant.deleteMany({
                    where: {
                        locationId: { in: locationIds },
                    },
                });
                const quantsToCreate = [];
                for (const record of records) {
                    const odooProd = record.product_id;
                    const odooLoc = record.location_id;
                    if (!odooProd || !odooLoc || !record.id)
                        continue;
                    const odooProdId = odooProd.id;
                    const odooLocId = odooLoc.id;
                    const lotName = record.lot_id ? (record.lot_id.display_name || null) : null;
                    const quantity = Number(record.quantity) || 0.0;
                    const reservedQuantity = Number(record.reserved_quantity) || 0.0;
                    const availableQuantity = Number(record.available_quantity) || 0.0;
                    const secondaryUnitQty = record.sh_secondary_unit_qty !== undefined ? (Number(record.sh_secondary_unit_qty) || 0.0) : 0.0;
                    quantsToCreate.push({
                        id: record.id,
                        inventoryId: odooProdId,
                        locationId: odooLocId,
                        quantity,
                        reservedQuantity,
                        availableQuantity,
                        secondaryUnitQty,
                        lotName,
                    });
                }
                if (quantsToCreate.length > 0) {
                    await tx.quant.createMany({
                        data: quantsToCreate,
                        skipDuplicates: true,
                    });
                    const activeReservations = await tx.gateOperationProduct.groupBy({
                        by: ['quantId'],
                        where: {
                            gateOperation: {
                                cardType: 'OUT',
                                status: { in: ['PENDING', 'PARTIAL'] },
                            },
                            quantId: { not: null },
                        },
                        _sum: {
                            quantity: true,
                        },
                    });
                    for (const res of activeReservations) {
                        if (res.quantId && res._sum.quantity) {
                            const localReserved = res._sum.quantity;
                            const quant = await tx.quant.findUnique({
                                where: { id: res.quantId },
                            });
                            if (quant) {
                                const newReserved = quant.reservedQuantity + localReserved;
                                const newAvailable = Math.max(0, quant.quantity - newReserved);
                                await tx.quant.update({
                                    where: { id: res.quantId },
                                    data: {
                                        reservedQuantity: newReserved,
                                        availableQuantity: newAvailable,
                                    },
                                });
                            }
                        }
                    }
                }
            }, { timeout: 300_000 });
            await this.prisma.odooAccount.update({
                where: { id: account.id },
                data: {
                    lastSyncAt: new Date(),
                    lastSyncStatus: 'SUCCESS',
                    lastSyncError: null,
                    lastSyncBy: triggeredBy,
                    lastSyncCount: records.length,
                },
            });
            return {
                success: true,
                syncedCount: records.length,
            };
        }
        catch (err) {
            await this.prisma.odooAccount.update({
                where: { id: account.id },
                data: {
                    lastSyncAt: new Date(),
                    lastSyncStatus: 'FAILED',
                    lastSyncError: `Gagal menyimpan ke database: ${err.message}`,
                    lastSyncBy: triggeredBy,
                },
            }).catch((e) => console.error('Failed to log sync status error', e));
            throw err;
        }
    }
    async findAll(warehouseId, query) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const skip = (page - 1) * limit;
        const where = {
            warehouseId,
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
            const uniqueLocationIds = new Set();
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
    async findDetail(warehouseId, inventoryUuid) {
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
                    orderBy: [
                        { location: { displayName: 'asc' } },
                        { lotName: 'asc' },
                    ],
                },
            },
        });
        if (!inventory) {
            throw new common_1.NotFoundException('Inventory tidak ditemukan.');
        }
        const locationsMap = new Map();
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
            locationsMap.get(loc.uuid).quants.push({
                id: q.id,
                uuid: q.uuid,
                locationId: loc.id,
                lotName: q.lotName || '-',
                quantity: q.quantity,
                reservedQuantity: q.reservedQuantity,
                availableQuantity: q.availableQuantity,
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
    async generatePdfReport(warehouseId, query) {
        const warehouse = await this.prisma.warehouse.findUnique({
            where: { id: warehouseId },
        });
        const warehouseName = warehouse ? warehouse.name : 'Gudang WMS';
        const where = {
            quants: {
                some: {
                    location: { warehouseId },
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
            const doc = new pdfkit_1.default({ margin: 15, size: 'A4' });
            const buffers = [];
            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));
            const drawPageHeader = (pageDoc, isFirstPage = false) => {
                let y = 15;
                if (isFirstPage) {
                    pageDoc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold').text('LAPORAN INVENTORY', 15, y, { align: 'center', width: 565 });
                    pageDoc.fontSize(6.8).font('Helvetica').fillColor('#64748b').text(`Cetak: ${new Date().toLocaleString('id-ID')}  |  Warehouse: ${warehouseName}`, 15, y + 14, { align: 'center', width: 565 });
                    y = 48;
                }
                pageDoc.fillColor('#475569').fontSize(6.5).font('Helvetica-Bold');
                pageDoc.text('Produk (Nama)', 20, y, { width: 140, ellipsis: true });
                pageDoc.text('Lokasi', 165, y, { width: 80, ellipsis: true });
                pageDoc.text('Lot / Batch', 250, y, { width: 105, ellipsis: true });
                pageDoc.text('Qty', 360, y, { width: 50, align: 'right' });
                pageDoc.text('UOM', 415, y, { width: 75, ellipsis: true });
                pageDoc.text('Sekunder Qty', 495, y, { width: 70, align: 'right' });
                pageDoc.font('Helvetica');
                pageDoc.moveTo(15, y + 8).lineTo(580, y + 8).lineWidth(0.4).stroke('#475569');
                return y + 12;
            };
            let currentY = drawPageHeader(doc, true);
            doc.y = currentY;
            if (data.length === 0) {
                doc.fillColor('#94a3b8').fontSize(7.5).text('Tidak ada data persediaan barang dengan stok aktif.', 15, doc.y + 10, { align: 'center' });
            }
            else {
                for (const inv of data) {
                    const quants = inv.quants || [];
                    const locationsMap = new Map();
                    for (const q of quants) {
                        const loc = q.location;
                        if (!locationsMap.has(loc.id)) {
                            locationsMap.set(loc.id, { name: loc.displayName, quants: [] });
                        }
                        locationsMap.get(loc.id).quants.push(q);
                    }
                    const sortedLocations = Array.from(locationsMap.values()).sort((a, b) => {
                        const partsA = (a.name || '').split('/').map((p) => p.trim());
                        const partsB = (b.name || '').split('/').map((p) => p.trim());
                        const maxLen = Math.max(partsA.length, partsB.length);
                        for (let i = 0; i < maxLen; i++) {
                            if (partsA[i] === undefined)
                                return -1;
                            if (partsB[i] === undefined)
                                return 1;
                            const cmp = partsA[i].localeCompare(partsB[i], 'id', { numeric: true, sensitivity: 'base' });
                            if (cmp !== 0)
                                return cmp;
                        }
                        return 0;
                    });
                    for (const locData of sortedLocations) {
                        locData.quants.sort((a, b) => {
                            const nameA = a.lotName || '';
                            const nameB = b.lotName || '';
                            return nameA.localeCompare(nameB, 'id', { numeric: true, sensitivity: 'base' });
                        });
                    }
                    let productQtyTotal = 0;
                    let productSecQtyTotal = 0;
                    for (const locData of sortedLocations) {
                        for (const q of locData.quants) {
                            productQtyTotal += q.quantity;
                            productSecQtyTotal += q.secondaryUnitQty || 0;
                        }
                    }
                    const prodTotalHeight = 16;
                    if (currentY + prodTotalHeight > 815) {
                        doc.addPage();
                        currentY = drawPageHeader(doc);
                    }
                    doc.moveTo(15, currentY).lineTo(580, currentY).lineWidth(0.4).stroke('#475569');
                    doc.fillColor('#1e293b').fontSize(6.8).font('Helvetica-Bold');
                    doc.text(`${inv.name}`, 20, currentY + 4, { width: 335, ellipsis: true });
                    doc.text(productQtyTotal.toLocaleString('id-ID'), 360, currentY + 4, { width: 50, align: 'right' });
                    doc.text(inv.uom || 'Unit', 415, currentY + 4, { width: 75, ellipsis: true });
                    const prodSecQtyText = productSecQtyTotal > 0 ? productSecQtyTotal.toLocaleString('id-ID') : '-';
                    doc.text(prodSecQtyText, 495, currentY + 4, { width: 70, align: 'right' });
                    doc.font('Helvetica');
                    doc.moveTo(15, currentY + prodTotalHeight - 0.5).lineTo(580, currentY + prodTotalHeight - 0.5).lineWidth(0.4).stroke('#475569');
                    currentY += prodTotalHeight;
                    currentY += 4;
                    let isFirstLoc = true;
                    for (const locData of sortedLocations) {
                        let locQtyTotal = 0;
                        let locSecQtyTotal = 0;
                        for (const q of locData.quants) {
                            locQtyTotal += q.quantity;
                            locSecQtyTotal += q.secondaryUnitQty || 0;
                        }
                        const locSubtotalHeight = 13;
                        if (currentY + locSubtotalHeight > 815) {
                            doc.addPage();
                            currentY = drawPageHeader(doc);
                        }
                        doc.moveTo(165, currentY).lineTo(580, currentY).lineWidth(0.2).stroke('#94a3b8');
                        doc.fillColor('#475569').fontSize(6.5).font('Helvetica-Bold');
                        doc.text(`${locData.name}`, 165, currentY + 3, { width: 190, ellipsis: true });
                        doc.text(locQtyTotal.toLocaleString('id-ID'), 360, currentY + 3, { width: 50, align: 'right' });
                        doc.text(inv.uom || 'Unit', 415, currentY + 3, { width: 75, ellipsis: true });
                        const locSecQtyText = locSecQtyTotal > 0 ? locSecQtyTotal.toLocaleString('id-ID') : '-';
                        doc.text(locSecQtyText, 495, currentY + 3, { width: 70, align: 'right' });
                        doc.font('Helvetica');
                        doc.moveTo(165, currentY + locSubtotalHeight - 0.5).lineTo(580, currentY + locSubtotalHeight - 0.5).lineWidth(0.2).stroke('#94a3b8');
                        currentY += locSubtotalHeight;
                        currentY += 3;
                        for (const q of locData.quants) {
                            doc.font('Helvetica').fontSize(5.8);
                            const lotName = q.lotName || '-';
                            const lotHeight = doc.heightOfString(lotName, { width: 105 });
                            const rowHeight = lotHeight + 1.2;
                            if (currentY + rowHeight > 815) {
                                doc.addPage();
                                currentY = drawPageHeader(doc);
                                const pageLocationText = `(Cont.) ${locData.name}`;
                                const secQtyText = q.secondaryUnitQty > 0 ? q.secondaryUnitQty.toLocaleString('id-ID') : '-';
                                doc.fillColor('#475569').fontSize(5.8);
                                doc.text(pageLocationText, 165, currentY, { width: 80, ellipsis: true });
                                doc.fillColor('#334155');
                                doc.text(lotName, 250, currentY, { width: 105, ellipsis: true });
                                doc.text(q.quantity.toLocaleString('id-ID'), 360, currentY, { width: 50, align: 'right' });
                                doc.text(inv.uom || 'Unit', 415, currentY, { width: 75, ellipsis: true });
                                doc.text(secQtyText, 495, currentY, { width: 70, align: 'right' });
                                doc.moveTo(15, currentY + rowHeight - 0.5).lineTo(580, currentY + rowHeight - 0.5).lineWidth(0.08).stroke('#e2e8f0');
                                currentY += rowHeight;
                            }
                            else {
                                const secQtyText = q.secondaryUnitQty > 0 ? q.secondaryUnitQty.toLocaleString('id-ID') : '-';
                                doc.fillColor('#334155').fontSize(5.8);
                                doc.text(lotName, 250, currentY, { width: 105, ellipsis: true });
                                doc.text(q.quantity.toLocaleString('id-ID'), 360, currentY, { width: 50, align: 'right' });
                                doc.text(inv.uom || 'Unit', 415, currentY, { width: 75, ellipsis: true });
                                doc.text(secQtyText, 495, currentY, { width: 70, align: 'right' });
                                doc.moveTo(15, currentY + rowHeight - 0.5).lineTo(580, currentY + rowHeight - 0.5).lineWidth(0.08).stroke('#e2e8f0');
                                currentY += rowHeight;
                            }
                        }
                        isFirstLoc = false;
                    }
                    currentY += 6;
                }
            }
            doc.end();
        });
    }
    async safeOdooCall(warehouseId, model, method, args = [], kwargs = {}) {
        const account = await this.prisma.odooAccount.findUnique({
            where: { warehouseId },
        });
        if (!account) {
            throw new common_1.NotFoundException('Akun Odoo untuk gudang aktif ini belum dikonfigurasi.');
        }
        await this.odooSessionManager.validateAndRefreshSession(account.id);
        let refreshedAccount = await this.prisma.odooAccount.findUnique({
            where: { id: account.id },
        });
        if (!refreshedAccount?.sessionId || !refreshedAccount?.baseUrl) {
            throw new common_1.BadRequestException('Session ID Odoo kosong setelah refresh.');
        }
        const triedSessionId = refreshedAccount.sessionId;
        try {
            return await this.odooClient.call(refreshedAccount.baseUrl, triedSessionId, {
                model,
                method,
                args,
                kwargs,
            });
        }
        catch (err) {
            const isSessionExpired = err.message.includes('Session expired') ||
                err.message.includes('Session Expired') ||
                err.message.includes('SessionExpiredException') ||
                err.message.includes('session expired');
            if (isSessionExpired) {
                const currentAccount = await this.prisma.odooAccount.findUnique({
                    where: { id: account.id },
                });
                const latestSessionId = currentAccount?.sessionId;
                if (latestSessionId && latestSessionId !== triedSessionId) {
                    this.logger.log(`Session Odoo untuk gudang ${account.warehouseId} telah diperbarui oleh proses lain. Mencoba ulang dengan session baru...`);
                    return await this.odooClient.call(currentAccount.baseUrl, latestSessionId, {
                        model,
                        method,
                        args,
                        kwargs,
                    });
                }
                this.logger.log(`Session Odoo untuk gudang ${account.warehouseId} kedaluwarsa. Melakukan refresh session...`);
                await this.odooSessionManager.invalidateSession(account.id);
                await this.odooSessionManager.validateAndRefreshSession(account.id);
                refreshedAccount = await this.prisma.odooAccount.findUnique({
                    where: { id: account.id },
                });
                if (refreshedAccount?.sessionId) {
                    return await this.odooClient.call(refreshedAccount.baseUrl, refreshedAccount.sessionId, {
                        model,
                        method,
                        args,
                        kwargs,
                    });
                }
            }
            throw err;
        }
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = InventoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        odoo_client_1.OdooClient,
        odoo_session_manager_1.OdooSessionManager])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map
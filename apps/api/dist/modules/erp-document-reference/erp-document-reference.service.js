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
var ErpDocumentReferenceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErpDocumentReferenceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/prisma/prisma.service");
const odoo_client_1 = require("../odoo/odoo-client");
const odoo_session_manager_1 = require("../odoo/odoo-session.manager");
let ErpDocumentReferenceService = ErpDocumentReferenceService_1 = class ErpDocumentReferenceService {
    prisma;
    odooClient;
    odooSessionManager;
    logger = new common_1.Logger(ErpDocumentReferenceService_1.name);
    constructor(prisma, odooClient, odooSessionManager) {
        this.prisma = prisma;
        this.odooClient = odooClient;
        this.odooSessionManager = odooSessionManager;
    }
    getRelationalName(fieldVal) {
        if (!fieldVal)
            return null;
        if (Array.isArray(fieldVal)) {
            return fieldVal.length > 1 ? String(fieldVal[1]) : null;
        }
        if (typeof fieldVal === 'object') {
            return fieldVal.display_name || null;
        }
        return String(fieldVal);
    }
    getRelationalId(fieldVal) {
        if (!fieldVal)
            return null;
        if (Array.isArray(fieldVal)) {
            return fieldVal.length > 0 ? Number(fieldVal[0]) : null;
        }
        if (typeof fieldVal === 'object') {
            return fieldVal.id ? Number(fieldVal.id) : null;
        }
        return Number(fieldVal);
    }
    async triggerSync(warehouseId, createdBy) {
        this.logger.log(`[SYNC-TRIGGER] Warehouse ${warehouseId} — triggered by ${createdBy}`);
        const log = await this.prisma.odooSyncLog.create({
            data: {
                warehouseId,
                status: 'PENDING',
                createdBy,
            },
        });
        this.logger.log(`[SYNC-TRIGGER] Created sync log entry ID: ${log.id}`);
        this.executeSyncJob(warehouseId, log.id, createdBy)
            .then((result) => {
            this.logger.log(`[SYNC-COMPLETE] Warehouse ${warehouseId}, log ${log.id} — synced ${result.syncedCount} documents`);
        })
            .catch((err) => {
            this.logger.error(`[SYNC-FAILED] Warehouse ${warehouseId}, log ${log.id} — ${err.message}`, err.stack);
        });
        return { message: 'Sync started' };
    }
    async getSyncStatus(warehouseId) {
        const latestLog = await this.prisma.odooSyncLog.findFirst({
            where: { warehouseId },
            orderBy: { startedAt: 'desc' },
        });
        if (!latestLog) {
            return {
                status: 'SUCCESS',
                processedDocuments: 0,
                totalDocuments: 0,
                startedAt: null,
                lastSyncAt: null,
            };
        }
        const lastSuccess = await this.prisma.odooSyncLog.findFirst({
            where: { warehouseId, status: 'SUCCESS' },
            orderBy: { finishedAt: 'desc' },
        });
        return {
            status: latestLog.status,
            processedDocuments: latestLog.processedDocuments,
            totalDocuments: latestLog.totalDocuments,
            startedAt: latestLog.startedAt,
            lastSyncAt: lastSuccess?.finishedAt || null,
        };
    }
    async executeSyncJob(warehouseId, logId, triggeredBy) {
        this.logger.log(`[SYNC-JOB] Starting sync for warehouse ${warehouseId}, log ${logId}`);
        await this.prisma.odooSyncLog.update({
            where: { id: logId },
            data: { status: 'RUNNING' },
        });
        this.logger.log(`[SYNC-JOB] Log ${logId} status set to RUNNING`);
        this.logger.log(`[SYNC-JOB] Fetching OdooAccount for warehouse ${warehouseId}...`);
        const account = await this.prisma.odooAccount.findUnique({
            where: { warehouseId },
            include: { warehouse: true },
        });
        if (!account) {
            const errorMsg = 'Akun Odoo untuk gudang aktif ini belum dikonfigurasi.';
            this.logger.error(`[SYNC-JOB] ${errorMsg}`);
            await this.prisma.odooSyncLog.update({
                where: { id: logId },
                data: { status: 'FAILED', errorMessage: errorMsg, finishedAt: new Date() },
            });
            throw new common_1.NotFoundException(errorMsg);
        }
        if (!account.isActive) {
            const errorMsg = 'Akun Odoo untuk gudang ini tidak aktif.';
            this.logger.error(`[SYNC-JOB] ${errorMsg}`);
            await this.prisma.odooSyncLog.update({
                where: { id: logId },
                data: { status: 'FAILED', errorMessage: errorMsg, finishedAt: new Date() },
            });
            throw new common_1.BadRequestException(errorMsg);
        }
        this.logger.log(`[SYNC-JOB] OdooAccount found: ID=${account.id}, baseUrl=${account.baseUrl}, lastOffset=${account.lastOffset}`);
        const limit = 100;
        let offset = account.lastOffset ?? 0;
        let syncedCount = 0;
        let totalDocuments = offset;
        try {
            const totalCount = await this.safeOdooCall(warehouseId, 'stock.picking', 'search_count', [], {
                domain: [],
            });
            totalDocuments = totalCount?.result;
            this.logger.log(`[SYNC-JOB] Total matching documents in Odoo: ${totalCount}`);
        }
        catch (err) {
            this.logger.warn(`[SYNC-JOB] Failed to fetch total document count: ${err.message}`);
        }
        await this.prisma.odooSyncLog.update({
            where: { id: logId },
            data: { totalDocuments },
        });
        try {
            while (true) {
                this.logger.log(`[SYNC-JOB] Fetching PO documents: offset=${offset}, limit=${limit}`);
                const poRes = await this.safeOdooCall(warehouseId, 'stock.picking', 'web_search_read', [], {
                    domain: [],
                    specification: {
                        id: {},
                        name: {},
                        state: {},
                        picking_type_code: {},
                        partner_id: { fields: { display_name: {} } },
                        purchase_id: { fields: { display_name: {} } },
                        origin: {},
                        ref_fax: {},
                        location_id: { fields: { display_name: {} } },
                        location_dest_id: { fields: { display_name: {} } },
                        scheduled_date: {},
                        date_done: {},
                        driver: {},
                        plat_number: {},
                        move_ids_without_package: {
                            fields: {
                                id: {},
                                product_id: { fields: { display_name: {} } },
                                product_uom: { fields: { display_name: {} } },
                                analytic_account_id: { fields: { display_name: {} } },
                                quantity: {},
                                product_qty: {},
                                sh_sec_qty: {},
                                sh_sec_uom_id: { fields: { display_name: {} } },
                            },
                        },
                    },
                    offset,
                    limit,
                    order: "scheduled_date ASC",
                    count_limit: 999_999
                });
                const records = poRes?.records || [];
                this.logger.log(`[SYNC-JOB] Offset ${offset} fetched ${records.length} records`);
                if (records.length === 0)
                    break;
                await this.prisma.$transaction(async (tx) => {
                    for (const record of records) {
                        await this.upsertDocumentRecord(tx, record, warehouseId);
                    }
                }, {
                    timeout: 600000
                });
                syncedCount += records.length;
                offset += records.length;
                await this.prisma.odooAccount.update({
                    where: { id: account.id },
                    data: { lastOffset: offset },
                });
                await this.prisma.odooSyncLog.update({
                    where: { id: logId },
                    data: { processedDocuments: offset },
                });
                this.logger.log(`[SYNC-JOB] Progress offset updated to ${offset}`);
                if (records.length < limit)
                    break;
            }
            this.logger.log(`[SYNC-JOB] Starting refresh of open/active documents...`);
            const activeDocuments = await this.prisma.documentReference.findMany({
                where: {
                    warehouseId,
                    state: {
                        notIn: ['done', 'cancel'],
                    },
                },
                select: { id: true, documentNumber: true },
            });
            this.logger.log(`[SYNC-JOB] Found ${activeDocuments.length} active documents to refresh`);
            for (const doc of activeDocuments) {
                try {
                    this.logger.log(`[SYNC-JOB] Refreshing active document ID=${doc.id}, Number=${doc.documentNumber} from Odoo...`);
                    const res = await this.safeOdooCall(warehouseId, 'stock.picking', 'web_read', [[doc.id]], {
                        specification: {
                            id: {},
                            name: {},
                            state: {},
                            picking_type_code: {},
                            partner_id: { fields: { display_name: {} } },
                            purchase_id: { fields: { display_name: {} } },
                            origin: {},
                            ref_fax: {},
                            location_id: { fields: { display_name: {} } },
                            location_dest_id: { fields: { display_name: {} } },
                            scheduled_date: {},
                            date_done: {},
                            driver: {},
                            plat_number: {},
                            move_ids_without_package: {
                                fields: {
                                    id: {},
                                    product_id: { fields: { display_name: {} } },
                                    product_uom: { fields: { display_name: {} } },
                                    analytic_account_id: { fields: { display_name: {} } },
                                    quantity: {},
                                    product_qty: {},
                                    sh_sec_qty: {},
                                    sh_sec_uom_id: { fields: { display_name: {} } },
                                },
                            },
                        },
                    });
                    if (res && Array.isArray(res) && res.length > 0) {
                        const record = res[0];
                        await this.prisma.$transaction(async (tx) => {
                            await this.upsertDocumentRecord(tx, record, warehouseId);
                        }, {
                            timeout: 60000
                        });
                        this.logger.log(`[SYNC-JOB] Successfully refreshed active document ID=${doc.id}`);
                    }
                    else {
                        this.logger.warn(`[SYNC-JOB] Document ID=${doc.id} not found in Odoo during refresh. Skipping.`);
                    }
                }
                catch (err) {
                    this.logger.error(`[SYNC-JOB] Failed to refresh active document ID=${doc.id}: ${err.message}`);
                }
            }
            const finishedAt = new Date();
            await this.prisma.odooSyncLog.update({
                where: { id: logId },
                data: { status: 'SUCCESS', finishedAt, processedDocuments: offset },
            });
            await this.prisma.odooAccount.update({
                where: { id: account.id },
                data: {
                    lastSyncAt: finishedAt,
                    lastSyncStatus: 'SUCCESS',
                    lastSyncError: null,
                    lastSyncBy: triggeredBy,
                    lastSyncCount: syncedCount,
                },
            });
            this.logger.log(`[SYNC-JOB] ✅ Sync completed successfully for warehouse ${warehouseId}. Total synced: ${syncedCount}`);
            return {
                success: true,
                syncedCount,
            };
        }
        catch (err) {
            const finishedAt = new Date();
            this.logger.error(`[SYNC-JOB] ❌ Sync failed for warehouse ${warehouseId}: ${err.message}`, err.stack);
            await this.prisma.odooSyncLog.update({
                where: { id: logId },
                data: { status: 'FAILED', errorMessage: err.message, finishedAt },
            });
            await this.prisma.odooAccount.update({
                where: { id: account.id },
                data: {
                    lastSyncAt: finishedAt,
                    lastSyncStatus: 'FAILED',
                    lastSyncError: `Gagal menyimpan data ke database: ${err.message}`,
                    lastSyncBy: triggeredBy,
                },
            }).catch((e) => this.logger.error('[SYNC-JOB] Failed to update OdooAccount sync status', e));
            throw err;
        }
    }
    async findAll(warehouseId, query) {
        this.logger.log(`[findAll] Fetching documents for warehouseId=${warehouseId}, search="${query.search || ''}", type="${query.type || ''}", page=${query.page || 1}, limit=${query.limit || 10}`);
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const skip = (page - 1) * limit;
        const where = {
            warehouseId,
        };
        const andConditions = [];
        if (query.search) {
            andConditions.push({
                OR: [
                    { documentNumber: { contains: query.search, mode: 'insensitive' } },
                    { origin: { contains: query.search, mode: 'insensitive' } },
                    { partnerName: { contains: query.search, mode: 'insensitive' } },
                ],
            });
        }
        if (query.type) {
            if (query.type === 'IN') {
                andConditions.push({
                    pickingTypeCode: 'incoming',
                });
            }
            else {
                andConditions.push({
                    OR: [
                        { pickingTypeCode: 'outgoing' },
                        {
                            pickingTypeCode: 'internal',
                            origin: {
                                startsWith: 'CT',
                            },
                        },
                    ],
                });
            }
        }
        if (andConditions.length > 0) {
            where.AND = andConditions;
        }
        if (query.refFax) {
            where.ref_fax = { contains: query.refFax, mode: 'insensitive' };
        }
        if (query.state) {
            where.state = query.state;
        }
        if (query.startDate || query.endDate) {
            where.scheduledDate = {};
            if (query.startDate) {
                where.scheduledDate.gte = new Date(query.startDate);
            }
            if (query.endDate) {
                const end = new Date(query.endDate);
                end.setHours(23, 59, 59, 999);
                where.scheduledDate.lte = end;
            }
        }
        const [total, data] = await Promise.all([
            this.prisma.documentReference.count({ where }),
            this.prisma.documentReference.findMany({
                where,
                skip,
                take: limit,
                orderBy: { scheduledDate: 'desc' },
                include: {
                    items: true,
                },
            }),
        ]);
        const [totalCount, incomingCount, outgoingCount, odooAccount] = await Promise.all([
            this.prisma.documentReference.count({ where: { warehouseId } }),
            this.prisma.documentReference.count({ where: { warehouseId, pickingTypeCode: 'incoming' } }),
            this.prisma.documentReference.count({ where: { warehouseId, pickingTypeCode: 'outgoing' } }),
            this.prisma.odooAccount.findUnique({ where: { warehouseId } }),
        ]);
        const summary = {
            totalDocuments: totalCount,
            totalIncoming: incomingCount,
            totalOutgoing: outgoingCount,
            lastSyncTime: odooAccount?.lastSyncAt || null,
        };
        const sanitizedData = await this.sanitizeDocReferences(data);
        this.logger.log(`[findAll] Found total=${total} matching documents, returning ${sanitizedData.length} documents for current page`);
        return {
            data: sanitizedData,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
            summary,
        };
    }
    async findOne(warehouseId, uuid) {
        const item = await this.prisma.documentReference.findFirst({
            where: {
                warehouseId,
                uuid,
            },
            include: {
                items: true,
            },
        });
        if (!item) {
            throw new common_1.NotFoundException('Dokumen ERP tidak ditemukan di gudang ini.');
        }
        return this.sanitizeDocReference(item);
    }
    async forceSyncDocument(warehouseId, idOrUuid, triggeredBy) {
        this.logger.log(`[FORCE-SYNC] Document ${idOrUuid} for warehouse ${warehouseId}, triggered by ${triggeredBy}`);
        const doc = await this.prisma.documentReference.findFirst({
            where: {
                warehouseId,
                uuid: idOrUuid,
            },
        });
        if (!doc) {
            this.logger.error(`[FORCE-SYNC] Document not found: ${idOrUuid}`);
            throw new common_1.NotFoundException('Dokumen ERP tidak ditemukan.');
        }
        this.logger.log(`[FORCE-SYNC] Found local document: id=${doc.id}, number=${doc.documentNumber}`);
        const account = await this.prisma.odooAccount.findUnique({
            where: { warehouseId },
        });
        if (!account) {
            throw new common_1.NotFoundException('Akun Odoo untuk gudang aktif ini belum dikonfigurasi.');
        }
        if (!account.isActive) {
            throw new common_1.BadRequestException('Akun Odoo untuk gudang ini tidak aktif.');
        }
        const specification = {
            id: {},
            name: {},
            state: {},
            picking_type_code: {},
            partner_id: { fields: { display_name: {} } },
            purchase_id: { fields: { display_name: {} } },
            origin: {},
            ref_fax: {},
            location_id: { fields: { display_name: {} } },
            location_dest_id: { fields: { display_name: {} } },
            scheduled_date: {},
            date_done: {},
            driver: {},
            plat_number: {},
            move_ids_without_package: {
                fields: {
                    id: {},
                    product_id: { fields: { display_name: {} } },
                    product_uom: { fields: { display_name: {} } },
                    analytic_account_id: { fields: { display_name: {} } },
                    quantity: {},
                    product_qty: {},
                    sh_sec_qty: {},
                    sh_sec_uom_id: { fields: { display_name: {} } },
                },
            },
        };
        let record;
        try {
            this.logger.log(`[FORCE-SYNC] Fetching document id=${doc.id} from Odoo...`);
            const res = await this.safeOdooCall(warehouseId, 'stock.picking', 'web_read', [[doc.id]], {
                specification,
            });
            if (!res || !Array.isArray(res) || res.length === 0) {
                throw new common_1.NotFoundException('Dokumen tidak ditemukan di Odoo.');
            }
            record = res[0];
            this.logger.log(`[FORCE-SYNC] Fetched document from Odoo: name=${record.name}, state=${record.state}`);
        }
        catch (err) {
            this.logger.error(`[FORCE-SYNC] Failed to fetch from Odoo: ${err.message}`, err.stack);
            throw new common_1.BadRequestException(`Gagal mengambil detail dokumen dari Odoo: ${err.message}`);
        }
        this.logger.log(`[FORCE-SYNC] Updating local DB for document id=${doc.id}...`);
        const updatedDoc = await this.prisma.$transaction(async (tx) => {
            const docRef = await this.upsertDocumentRecord(tx, record, warehouseId);
            return tx.documentReference.findUnique({
                where: { id: docRef.id },
                include: { items: true },
            });
        }, {
            timeout: 60000
        });
        this.logger.log(`[FORCE-SYNC] ✅ Document ${doc.documentNumber} force-synced successfully`);
        return this.sanitizeDocReference(updatedDoc);
    }
    async upsertDocumentRecord(tx, record, warehouseId) {
        const erpId = record.id;
        const documentNumber = record.name || `DOC-${erpId}`;
        const state = record.state || 'draft';
        const pickingTypeCode = record.picking_type_code || 'internal';
        const partnerName = this.getRelationalName(record.partner_id);
        const purchaseName = this.getRelationalName(record.purchase_id);
        const origin = record.origin || null;
        const ref_fax = record.ref_fax || null;
        const sourceLocationName = this.getRelationalName(record.location_id);
        const destinationLocationName = this.getRelationalName(record.location_dest_id);
        const scheduledDate = record.scheduled_date ? new Date(record.scheduled_date) : null;
        const dateDone = record.date_done ? new Date(record.date_done) : null;
        const driver = record.driver || null;
        const plateNumber = record.plat_number || null;
        const rawItems = record.move_ids_without_package || [];
        const totalItems = rawItems.length;
        const totalQuantity = rawItems.reduce((sum, item) => sum + (Number(item.quantity) || 0.0), 0.0);
        this.logger.log(`[SYNC-JOB] Upserting document: erpId=${erpId}, number=${documentNumber}, ` +
            `state=${state}, type=${pickingTypeCode}, items=${totalItems}, ref_fax=${ref_fax}`);
        const docRef = await tx.documentReference.upsert({
            where: {
                id: erpId,
            },
            update: {
                documentNumber,
                state,
                pickingTypeCode,
                partnerName,
                purchaseName,
                origin,
                ref_fax,
                sourceLocationName,
                destinationLocationName,
                scheduledDate,
                dateDone,
                driver,
                plateNumber,
                totalItems,
                totalQuantity,
                rawPayload: record,
                lastSyncedAt: new Date(),
            },
            create: {
                id: erpId,
                warehouseId,
                documentNumber,
                state,
                pickingTypeCode,
                partnerName,
                purchaseName,
                origin,
                ref_fax,
                sourceLocationName,
                destinationLocationName,
                scheduledDate,
                dateDone,
                driver,
                plateNumber,
                totalItems,
                totalQuantity,
                rawPayload: record,
            },
        });
        if (rawItems.length > 0) {
            const itemsData = rawItems.map((item) => {
                const moveId = item.id;
                const inventoryId = this.getRelationalId(item.product_id) || 0;
                const productName = this.getRelationalName(item.product_id) || 'Unnamed Product';
                const uom = this.getRelationalName(item.product_uom) || 'Unit';
                const analyticAccountName = this.getRelationalName(item.analytic_account_id);
                const quantity = Number(item.quantity) || 0.0;
                const productQty = Number(item.product_qty) || 0.0;
                const secondaryQuantity = item.sh_sec_qty !== undefined ? Number(item.sh_sec_qty) : null;
                const secondaryUom = this.getRelationalName(item.sh_sec_uom_id);
                return {
                    id: moveId,
                    documentReferenceId: docRef.id,
                    inventoryId,
                    productName,
                    uom,
                    analyticAccountName,
                    quantity,
                    productQty,
                    secondaryQuantity,
                    secondaryUom,
                };
            });
            for (const item of itemsData) {
                await tx.documentReferenceItem.upsert({
                    where: { id: item.id },
                    update: {
                        productName: item.productName,
                        uom: item.uom,
                        analyticAccountName: item.analyticAccountName,
                        quantity: item.quantity,
                        productQty: item.productQty,
                        secondaryQuantity: item.secondaryQuantity,
                        secondaryUom: item.secondaryUom,
                    },
                    create: item,
                });
            }
            const odooItemIds = itemsData.map((i) => i.id);
            await tx.documentReferenceItem.deleteMany({
                where: {
                    documentReferenceId: docRef.id,
                    id: { notIn: odooItemIds },
                },
            });
            this.logger.log(`[SYNC-JOB] Upserted ${itemsData.length} items for document id=${docRef.id}`);
        }
        else {
            await tx.documentReferenceItem.deleteMany({
                where: { documentReferenceId: docRef.id },
            });
        }
        return docRef;
    }
    async findUniquePartners(warehouseId) {
        const results = await this.prisma.documentReference.findMany({
            where: {
                warehouseId,
                partnerName: {
                    not: '',
                },
                NOT: {
                    partnerName: null,
                },
            },
            select: {
                partnerName: true,
            },
            distinct: ['partnerName'],
        });
        return results
            .map((r) => r.partnerName)
            .filter((name) => name !== null && name !== '');
    }
    async sanitizeDocReferences(docs) {
        if (!docs || docs.length === 0)
            return [];
        const inventoryIds = [];
        for (const doc of docs) {
            if (doc.items) {
                for (const item of doc.items) {
                    if (item.inventoryId) {
                        inventoryIds.push(item.inventoryId);
                    }
                }
            }
        }
        const inventoryMap = new Map();
        if (inventoryIds.length > 0) {
            const inventories = await this.prisma.inventory.findMany({
                where: { id: { in: inventoryIds } },
                select: { id: true, uuid: true, sku: true, name: true, uom: true },
            });
            for (const inv of inventories) {
                inventoryMap.set(inv.id, inv);
            }
        }
        return docs.map((doc) => {
            const { warehouseId, rawPayload, items, ...restDoc } = doc;
            const sanitizedItems = items ? items.map((item) => {
                const { id: itemId, documentReferenceId, inventoryId, ...restItem } = item;
                const inv = inventoryMap.get(inventoryId);
                return {
                    ...restItem,
                    inventoryId,
                    inventoryUuid: inv?.uuid || null,
                    inventorySku: inv?.sku || null,
                    inventoryName: inv?.name || null,
                    inventoryUom: inv?.uom || null,
                };
            }) : [];
            return {
                ...restDoc,
                items: sanitizedItems,
            };
        });
    }
    async sanitizeDocReference(doc) {
        if (!doc)
            return null;
        const sanitized = await this.sanitizeDocReferences([doc]);
        return sanitized[0];
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
exports.ErpDocumentReferenceService = ErpDocumentReferenceService;
exports.ErpDocumentReferenceService = ErpDocumentReferenceService = ErpDocumentReferenceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        odoo_client_1.OdooClient,
        odoo_session_manager_1.OdooSessionManager])
], ErpDocumentReferenceService);
//# sourceMappingURL=erp-document-reference.service.js.map
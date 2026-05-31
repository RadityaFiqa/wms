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
exports.GateService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/prisma/prisma.service");
const warehouse_context_service_1 = require("../../core/warehouse-context/warehouse-context.service");
const storage_service_1 = require("../storage/storage.service");
let GateService = class GateService {
    prisma;
    warehouseContext;
    storageService;
    constructor(prisma, warehouseContext, storageService) {
        this.prisma = prisma;
        this.warehouseContext = warehouseContext;
        this.storageService = storageService;
    }
    getStartAndEndOfToday() {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }
    async generateOpNumber(tx) {
        const today = new Date();
        const YYYY = today.getFullYear();
        const MM = String(today.getMonth() + 1).padStart(2, '0');
        const DD = String(today.getDate()).padStart(2, '0');
        const dateStr = `${YYYY}${MM}${DD}`;
        const { start, end } = this.getStartAndEndOfToday();
        const count = await tx.gateOperation.count({
            where: {
                createdAt: {
                    gte: start,
                    lte: end,
                },
            },
        });
        const nextSeq = String(count + 1).padStart(4, '0');
        return `GO-${dateStr}-${nextSeq}`;
    }
    async createGateOperation(createdByUserId, body) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Konteks warehouse (header x-warehouse-id) diperlukan.');
        }
        return this.prisma.$transaction(async (tx) => {
            const opNumber = await this.generateOpNumber(tx);
            const gateOperation = await tx.gateOperation.create({
                data: {
                    opNumber,
                    cardType: body.cardType,
                    driverName: body.driverName,
                    licensePlate: body.licensePlate.toUpperCase(),
                    notes: body.notes,
                    status: 'PENDING',
                    warehouseId,
                    createdByUserId,
                },
            });
            if (body.attachmentPaths && body.attachmentPaths.length > 0) {
                await tx.fileAttachment.updateMany({
                    where: { filePath: { in: body.attachmentPaths } },
                    data: { gateOperationId: gateOperation.id },
                });
            }
            if (body.products && body.products.length > 0) {
                for (const prod of body.products) {
                    await tx.gateOperationProduct.create({
                        data: {
                            gateOperationId: gateOperation.id,
                            productId: prod.productId,
                            quantity: prod.quantity,
                        },
                    });
                }
            }
            return this.mapOperationUrls(await tx.gateOperation.findUnique({
                where: { id: gateOperation.id },
                include: {
                    attachments: true,
                    products: {
                        include: { product: true },
                    },
                    createdByUser: {
                        select: { name: true, email: true },
                    },
                },
            }));
        });
    }
    async getGateOperations(query) {
        const warehouseId = this.warehouseContext.getWarehouseId();
        if (!warehouseId) {
            throw new common_1.BadRequestException('Konteks warehouse (header x-warehouse-id) diperlukan.');
        }
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const skip = (page - 1) * limit;
        const where = {
            warehouseId,
        };
        if (query.startDate || query.endDate) {
            const verifiedAtFilter = {};
            if (query.startDate) {
                const start = new Date(query.startDate);
                start.setHours(0, 0, 0, 0);
                verifiedAtFilter.gte = start;
            }
            if (query.endDate) {
                const end = new Date(query.endDate);
                end.setHours(23, 59, 59, 999);
                verifiedAtFilter.lte = end;
            }
            where.verification = {
                verifiedAt: verifiedAtFilter,
            };
        }
        if (query.search) {
            where.OR = [
                { opNumber: { contains: query.search, mode: 'insensitive' } },
                { driverName: { contains: query.search, mode: 'insensitive' } },
                { licensePlate: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        if (query.cardType) {
            where.cardType = query.cardType;
        }
        if (query.status) {
            if (query.status.includes(',')) {
                where.status = { in: query.status.split(',') };
            }
            else {
                where.status = query.status;
            }
        }
        const [total, items] = await Promise.all([
            this.prisma.gateOperation.count({ where }),
            this.prisma.gateOperation.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    attachments: true,
                    products: {
                        include: { product: true },
                    },
                    createdByUser: {
                        select: { name: true, email: true },
                    },
                    verification: {
                        include: {
                            attachments: true,
                            verifiedBy: { select: { name: true } },
                            products: {
                                include: { product: true },
                            },
                        },
                    },
                },
            }),
        ]);
        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            items: items.map((item) => this.mapOperationUrls(item)),
        };
    }
    async getGateOperationByUuid(uuid) {
        const item = await this.prisma.gateOperation.findUnique({
            where: { uuid },
            include: {
                attachments: true,
                createdByUser: {
                    select: { name: true, email: true },
                },
                products: {
                    include: { product: true },
                },
                verification: {
                    include: {
                        attachments: true,
                        verifiedBy: {
                            select: { name: true, email: true },
                        },
                        products: {
                            include: { product: true },
                        },
                        references: {
                            include: {
                                erpDocument: true,
                                erpDocumentItem: true,
                            },
                        },
                    },
                },
            },
        });
        if (!item) {
            throw new common_1.NotFoundException('Gate operation tidak ditemukan.');
        }
        return this.mapOperationUrls(item);
    }
    async getAvailableReferences(operationUuid, productId, gateItemId) {
        const gateOperation = await this.prisma.gateOperation.findUnique({
            where: { uuid: operationUuid },
            include: { verification: true },
        });
        if (!gateOperation) {
            throw new common_1.NotFoundException('Gate operation tidak ditemukan.');
        }
        const pickingTypeCode = gateOperation.cardType === 'IN' ? 'incoming' : 'outgoing';
        const documents = await this.prisma.documentReference.findMany({
            where: {
                warehouseId: gateOperation.warehouseId,
                pickingTypeCode,
                items: {
                    some: {
                        productId,
                    },
                },
            },
            include: {
                items: {
                    where: {
                        productId,
                    },
                },
            },
            orderBy: {
                scheduledDate: 'desc',
            },
        });
        const results = [];
        for (const doc of documents) {
            for (const item of doc.items) {
                const otherAssignments = await this.prisma.gateDocumentReference.aggregate({
                    where: {
                        erpDocumentItemId: item.id,
                        gateVerification: {
                            gateOperationId: {
                                not: gateOperation.id,
                            },
                        },
                    },
                    _sum: {
                        assignedQuantity: true,
                    },
                });
                const usedQty = otherAssignments._sum.assignedQuantity || 0;
                const remainingQty = Math.max(0, item.quantity - usedQty);
                let currentAssignedQty = 0;
                if (gateOperation.verification && gateItemId) {
                    const currentAssignment = await this.prisma.gateDocumentReference.findFirst({
                        where: {
                            gateVerificationId: gateOperation.verification.id,
                            gateItemId,
                            erpDocumentItemId: item.id,
                        },
                    });
                    currentAssignedQty = currentAssignment?.assignedQuantity || 0;
                }
                results.push({
                    erpDocumentId: doc.id,
                    erpDocumentItemId: item.id,
                    documentNumber: doc.documentNumber,
                    scheduledDate: doc.scheduledDate,
                    partnerName: doc.partnerName || doc.purchaseName || 'Tanpa Partner',
                    productName: item.productName,
                    totalQty: item.quantity,
                    remainingQty,
                    currentAssignedQty,
                });
            }
        }
        return results;
    }
    async assignReferences(operationUuid, userId, userName, body) {
        const gateOperation = await this.prisma.gateOperation.findUnique({
            where: { uuid: operationUuid },
            include: { verification: true },
        });
        if (!gateOperation) {
            throw new common_1.NotFoundException('Gate operation tidak ditemukan.');
        }
        const gateItem = await this.prisma.gateOperationProduct.findFirst({
            where: {
                id: body.gateItemId,
                gateOperationId: gateOperation.id,
            },
        });
        if (!gateItem) {
            throw new common_1.BadRequestException('Item Gate Operation tidak ditemukan.');
        }
        return this.prisma.$transaction(async (tx) => {
            let verification = gateOperation.verification;
            if (!verification) {
                verification = await tx.gateVerification.create({
                    data: {
                        gateOperationId: gateOperation.id,
                        verifiedById: userId,
                        status: 'PENDING',
                        notes: 'Assignment referensi ERP',
                    },
                });
            }
            for (const assign of body.assignments) {
                const docItem = await tx.documentReferenceItem.findUnique({
                    where: { id: assign.erpDocumentItemId },
                    include: { documentReference: true },
                });
                if (!docItem) {
                    throw new common_1.BadRequestException(`Item Dokumen ERP dengan ID ${assign.erpDocumentItemId} tidak ditemukan.`);
                }
                if (docItem.productId !== gateItem.productId) {
                    throw new common_1.BadRequestException(`Produk ${docItem.productName} tidak cocok dengan item Gate Operation.`);
                }
                const otherAssignments = await tx.gateDocumentReference.aggregate({
                    where: {
                        erpDocumentItemId: assign.erpDocumentItemId,
                        gateVerificationId: {
                            not: verification.id,
                        },
                    },
                    _sum: {
                        assignedQuantity: true,
                    },
                });
                const usedQty = otherAssignments._sum.assignedQuantity || 0;
                const remainingQty = Math.max(0, docItem.quantity - usedQty);
                if (assign.assignedQuantity > remainingQty) {
                    throw new common_1.BadRequestException(`Kuantitas assignment (${assign.assignedQuantity}) melebihi kuantitas tersisa di dokumen ${docItem.documentReference.documentNumber} (${remainingQty}).`);
                }
            }
            await tx.gateDocumentReference.deleteMany({
                where: {
                    gateVerificationId: verification.id,
                    gateItemId: body.gateItemId,
                },
            });
            for (const assign of body.assignments) {
                const docItem = await tx.documentReferenceItem.findUnique({
                    where: { id: assign.erpDocumentItemId },
                });
                if (!docItem) {
                    throw new common_1.BadRequestException(`Item Dokumen ERP dengan ID ${assign.erpDocumentItemId} tidak ditemukan.`);
                }
                await tx.gateDocumentReference.create({
                    data: {
                        gateVerificationId: verification.id,
                        gateItemId: body.gateItemId,
                        erpDocumentId: docItem.documentReferenceId,
                        erpDocumentItemId: assign.erpDocumentItemId,
                        productId: gateItem.productId,
                        assignedQuantity: assign.assignedQuantity,
                        createdBy: userName,
                    },
                });
            }
            await this.updateGateStatusAndRealisasi(tx, gateOperation.id, verification.id);
            const result = await tx.gateVerification.findUnique({
                where: { id: verification.id },
                include: {
                    attachments: true,
                    references: {
                        include: {
                            erpDocument: true,
                            erpDocumentItem: true,
                        },
                    },
                },
            });
            return this.sanitizeVerification(result);
        });
    }
    async unassignReference(referenceUuid, userId, userName) {
        const docRef = await this.prisma.gateDocumentReference.findUnique({
            where: { uuid: referenceUuid },
            include: {
                gateVerification: {
                    include: {
                        gateOperation: true,
                    },
                },
                erpDocument: true,
            },
        });
        if (!docRef) {
            throw new common_1.NotFoundException('Referensi dokumen tidak ditemukan.');
        }
        const gateOperationId = docRef.gateVerification.gateOperationId;
        const verificationId = docRef.gateVerificationId;
        const documentNumber = docRef.erpDocument.documentNumber;
        await this.prisma.$transaction(async (tx) => {
            await tx.gateDocumentReference.delete({
                where: { id: docRef.id },
            });
            await this.updateGateStatusAndRealisasi(tx, gateOperationId, verificationId);
        });
        return {
            success: true,
            message: 'Referensi ERP berhasil dilepas.',
            auditDetails: {
                previousReference: documentNumber,
                unassignedBy: userName,
                timestamp: new Date().toISOString(),
            },
        };
    }
    async updateGateStatusAndRealisasi(tx, gateOperationId, verificationId) {
        const gateOperation = await tx.gateOperation.findUnique({
            where: { id: gateOperationId },
        });
        if (!gateOperation)
            return;
        const operationProducts = await tx.gateOperationProduct.findMany({
            where: { gateOperationId },
        });
        const totalGateQty = operationProducts.reduce((sum, p) => sum + p.quantity, 0);
        const references = await tx.gateDocumentReference.findMany({
            where: { gateVerificationId: verificationId },
            include: { erpDocument: true },
        });
        const totalAssignedQty = references.reduce((sum, r) => sum + r.assignedQuantity, 0);
        let newStatus = 'PENDING';
        if (totalAssignedQty > 0) {
            if (totalAssignedQty >= totalGateQty) {
                newStatus = 'COMPLETED';
            }
            else {
                newStatus = 'PARTIAL';
            }
        }
        const docNumbers = Array.from(new Set(references.map((r) => r.erpDocument.documentNumber)));
        const prevVerification = await tx.gateVerification.findUnique({
            where: { id: verificationId },
            select: { status: true },
        });
        const verificationData = {
            status: newStatus,
        };
        if (newStatus === 'COMPLETED' && prevVerification?.status !== 'COMPLETED') {
            verificationData.verifiedAt = new Date();
        }
        await tx.gateOperation.update({
            where: { id: gateOperationId },
            data: {
                status: newStatus,
                poReferences: gateOperation.cardType === 'IN' ? docNumbers : [],
                soReferences: gateOperation.cardType === 'OUT' ? docNumbers : [],
            },
        });
        await tx.gateVerification.update({
            where: { id: verificationId },
            data: verificationData,
        });
        await tx.gateVerificationProduct.deleteMany({
            where: { gateVerificationId: verificationId },
        });
        const productAssignedTotals = new Map();
        for (const ref of references) {
            const current = productAssignedTotals.get(ref.productId) || 0;
            productAssignedTotals.set(ref.productId, current + ref.assignedQuantity);
        }
        for (const [productId, quantity] of productAssignedTotals.entries()) {
            await tx.gateVerificationProduct.create({
                data: {
                    gateVerificationId: verificationId,
                    productId,
                    quantity,
                },
            });
        }
    }
    async verifyGateOperation(uuid, verifiedById, body) {
        const gateOperation = await this.prisma.gateOperation.findUnique({
            where: { uuid },
            include: { verification: true },
        });
        if (!gateOperation) {
            throw new common_1.NotFoundException('Gate operation tidak ditemukan.');
        }
        return this.prisma.$transaction(async (tx) => {
            let verification = gateOperation.verification;
            if (!verification) {
                verification = await tx.gateVerification.create({
                    data: {
                        gateOperationId: gateOperation.id,
                        verifiedById,
                        status: 'PENDING',
                        notes: body.notes,
                    },
                });
            }
            else {
                verification = await tx.gateVerification.update({
                    where: { id: verification.id },
                    data: {
                        verifiedById,
                        notes: body.notes,
                    },
                });
            }
            await tx.fileAttachment.updateMany({
                where: { gateVerificationId: verification.id },
                data: { gateVerificationId: null },
            });
            if (body.attachmentPaths && body.attachmentPaths.length > 0) {
                await tx.fileAttachment.updateMany({
                    where: { filePath: { in: body.attachmentPaths } },
                    data: { gateVerificationId: verification.id },
                });
            }
            await this.updateGateStatusAndRealisasi(tx, gateOperation.id, verification.id);
            const result = await tx.gateVerification.findUnique({
                where: { id: verification.id },
                include: {
                    attachments: true,
                    products: {
                        include: { product: true },
                    },
                    references: {
                        include: {
                            erpDocument: true,
                            erpDocumentItem: true,
                        },
                    },
                },
            });
            return this.sanitizeVerification(result);
        });
    }
    async cancelGateVerification(uuid, verifiedById) {
        const gateOperation = await this.prisma.gateOperation.findUnique({
            where: { uuid },
            include: { verification: true },
        });
        if (!gateOperation) {
            throw new common_1.NotFoundException('Gate operation tidak ditemukan.');
        }
        return this.prisma.$transaction(async (tx) => {
            let verification = gateOperation.verification;
            if (!verification) {
                verification = await tx.gateVerification.create({
                    data: {
                        gateOperationId: gateOperation.id,
                        verifiedById,
                        status: 'CANCELED',
                        notes: 'Dibatalkan oleh Admin',
                    },
                });
            }
            else {
                verification = await tx.gateVerification.update({
                    where: { id: verification.id },
                    data: {
                        verifiedById,
                        status: 'CANCELED',
                        notes: verification.notes ? `${verification.notes} (Dibatalkan)` : 'Dibatalkan',
                    },
                });
            }
            await tx.gateOperation.update({
                where: { id: gateOperation.id },
                data: {
                    status: 'CANCELED',
                },
            });
            const result = await tx.gateVerification.findUnique({
                where: { id: verification.id },
                include: {
                    attachments: true,
                    products: {
                        include: { product: true },
                    },
                },
            });
            return this.sanitizeVerification(result);
        });
    }
    mapOperationUrls(item) {
        if (!item)
            return null;
        const mapped = { ...item };
        if (mapped.attachments && Array.isArray(mapped.attachments)) {
            mapped.attachments = mapped.attachments.map((attach) => ({
                ...attach,
                url: this.storageService.getFilePublicUrl(attach.filePath),
            }));
        }
        if (mapped.verification) {
            if (mapped.verification.attachments && Array.isArray(mapped.verification.attachments)) {
                mapped.verification.attachments = mapped.verification.attachments.map((attach) => ({
                    ...attach,
                    url: this.storageService.getFilePublicUrl(attach.filePath),
                }));
            }
        }
        return this.stripIdField(mapped);
    }
    stripIdField(obj) {
        if (obj === null || obj === undefined)
            return obj;
        if (obj instanceof Date)
            return obj;
        if (Array.isArray(obj)) {
            return obj.map(item => this.stripIdField(item));
        }
        if (typeof obj === 'object') {
            const isProduct = 'sku' in obj && 'name' in obj;
            const isGateOpProduct = 'gateOperationId' in obj && 'productId' in obj;
            const isGateVerificationProduct = 'gateVerificationId' in obj && 'productId' in obj;
            const newObj = {};
            for (const key of Object.keys(obj)) {
                if (key === 'id' && !isProduct && !isGateOpProduct && !isGateVerificationProduct)
                    continue;
                newObj[key] = this.stripIdField(obj[key]);
            }
            return newObj;
        }
        return obj;
    }
    async addCargoItem(operationUuid, body) {
        const { productId, quantity, notes } = body;
        if (quantity <= 0) {
            throw new common_1.BadRequestException('Quantity harus lebih besar dari 0');
        }
        return this.prisma.$transaction(async (tx) => {
            const gateOperation = await tx.gateOperation.findUnique({
                where: { uuid: operationUuid },
                include: { verification: true },
            });
            if (!gateOperation) {
                throw new common_1.NotFoundException('Gate operation tidak ditemukan');
            }
            const product = await tx.product.findUnique({
                where: { id: productId },
            });
            if (!product) {
                throw new common_1.NotFoundException('Produk tidak ditemukan');
            }
            const existing = await tx.gateOperationProduct.findFirst({
                where: {
                    gateOperationId: gateOperation.id,
                    productId,
                },
            });
            if (existing) {
                throw new common_1.BadRequestException('Produk sudah terdaftar di gate operation ini.');
            }
            const cargoItem = await tx.gateOperationProduct.create({
                data: {
                    gateOperationId: gateOperation.id,
                    productId,
                    quantity,
                    notes: notes || null,
                },
                include: {
                    product: true,
                },
            });
            if (gateOperation.verification) {
                await this.updateGateStatusAndRealisasi(tx, gateOperation.id, gateOperation.verification.id);
            }
            return this.stripIdField(cargoItem);
        });
    }
    async deleteCargoItem(gateOperationProductUuid) {
        return this.prisma.$transaction(async (tx) => {
            const cargoItem = await tx.gateOperationProduct.findUnique({
                where: { uuid: gateOperationProductUuid },
                include: {
                    product: true,
                    gateOperation: {
                        include: { verification: true },
                    },
                },
            });
            if (!cargoItem) {
                throw new common_1.NotFoundException('Barang muatan tidak ditemukan');
            }
            const gateOperation = cargoItem.gateOperation;
            await tx.gateOperationProduct.delete({
                where: { id: cargoItem.id },
            });
            if (gateOperation.verification) {
                await this.updateGateStatusAndRealisasi(tx, gateOperation.id, gateOperation.verification.id);
            }
            return {
                success: true,
                message: 'Barang muatan berhasil dihapus',
                deletedItem: this.stripIdField(cargoItem),
            };
        });
    }
    sanitizeVerification(verification) {
        if (!verification)
            return null;
        const mapped = { ...verification };
        if (mapped.attachments && Array.isArray(mapped.attachments)) {
            mapped.attachments = mapped.attachments.map((attach) => ({
                ...attach,
                url: this.storageService.getFilePublicUrl(attach.filePath),
            }));
        }
        return this.stripIdField(mapped);
    }
};
exports.GateService = GateService;
exports.GateService = GateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        warehouse_context_service_1.WarehouseContextService,
        storage_service_1.StorageService])
], GateService);
//# sourceMappingURL=gate.service.js.map
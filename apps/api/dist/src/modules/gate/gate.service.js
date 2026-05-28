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
const client_1 = require("@prisma/client");
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
            let vehiclePhotoId = null;
            if (body.vehiclePhotoPath) {
                const attachment = await tx.fileAttachment.findFirst({
                    where: { filePath: body.vehiclePhotoPath },
                });
                if (attachment) {
                    vehiclePhotoId = attachment.id;
                }
            }
            const opNumber = await this.generateOpNumber(tx);
            const gateOperation = await tx.gateOperation.create({
                data: {
                    opNumber,
                    cardType: body.cardType,
                    driverName: body.driverName,
                    licensePlate: body.licensePlate.toUpperCase(),
                    notes: body.notes,
                    status: client_1.VerificationStatus.PENDING,
                    warehouseId,
                    createdByUserId,
                    vehiclePhotoId,
                },
            });
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
                    vehiclePhoto: true,
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
            where.status = query.status;
        }
        const [total, items] = await Promise.all([
            this.prisma.gateOperation.count({ where }),
            this.prisma.gateOperation.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    vehiclePhoto: true,
                    products: {
                        include: { product: true },
                    },
                    createdByUser: {
                        select: { name: true, email: true },
                    },
                    verification: {
                        include: {
                            verifiedBy: { select: { name: true } },
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
                vehiclePhoto: true,
                createdByUser: {
                    select: { name: true, email: true },
                },
                products: {
                    include: { product: true },
                },
                verification: {
                    include: {
                        attachment: true,
                        verifiedBy: {
                            select: { name: true, email: true },
                        },
                        products: {
                            include: { product: true },
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
    async verifyGateOperation(uuid, verifiedById, body) {
        const gateOperation = await this.prisma.gateOperation.findUnique({
            where: { uuid },
            include: { verification: true },
        });
        if (!gateOperation) {
            throw new common_1.NotFoundException('Gate operation tidak ditemukan.');
        }
        if (gateOperation.verification) {
            throw new common_1.BadRequestException('Gate operation ini sudah diverifikasi sebelumnya.');
        }
        return this.prisma.$transaction(async (tx) => {
            let attachmentId = null;
            if (body.attachmentPath) {
                const attach = await tx.fileAttachment.findFirst({
                    where: { filePath: body.attachmentPath },
                });
                if (attach) {
                    attachmentId = attach.id;
                }
            }
            const verification = await tx.gateVerification.create({
                data: {
                    gateOperationId: gateOperation.id,
                    verifiedById,
                    status: body.status,
                    notes: body.notes,
                    attachmentId,
                },
            });
            if (body.products && body.products.length > 0) {
                for (const prod of body.products) {
                    await tx.gateVerificationProduct.create({
                        data: {
                            gateVerificationId: verification.id,
                            productId: prod.productId,
                            quantity: prod.quantity,
                        },
                    });
                }
            }
            await tx.gateOperation.update({
                where: { id: gateOperation.id },
                data: {
                    status: body.status,
                },
            });
            return tx.gateVerification.findUnique({
                where: { id: verification.id },
                include: {
                    attachment: true,
                    products: {
                        include: { product: true },
                    },
                },
            });
        });
    }
    mapOperationUrls(item) {
        if (!item)
            return null;
        const mapped = { ...item };
        if (mapped.vehiclePhoto && mapped.vehiclePhoto.filePath) {
            mapped.vehiclePhoto.url = this.storageService.getFilePublicUrl(mapped.vehiclePhoto.filePath);
        }
        if (mapped.verification) {
            if (mapped.verification.attachment && mapped.verification.attachment.filePath) {
                mapped.verification.attachment.url = this.storageService.getFilePublicUrl(mapped.verification.attachment.filePath);
            }
        }
        return mapped;
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
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTagihanSchema = exports.TagihanSummaryItemInputSchema = exports.TagihanManualDocumentInputSchema = exports.UpdateMasterTagihanStatusSchema = exports.CreateMasterTagihanStatusSchema = exports.MasterTagihanStatusSchema = exports.TagihanTypeEnum = exports.BulkRejectSchema = exports.BulkApproveSchema = exports.GenerateDocumentSchema = exports.UpdatePlaceholdersSchema = exports.PlaceholderItemSchema = exports.PlaceholderColumnSchema = exports.UpdateAssemblySchema = exports.AssemblyItemSchema = exports.UpdateDocumentTemplateSchema = exports.CreateDocumentTemplateSchema = exports.UpdateKartuTumpukanSourceSchema = exports.StackCardQuerySchema = exports.UpdateStackCardSchema = exports.ImportStackCardSchema = exports.StackCardRowSchema = exports.SignDocumentSchema = exports.CreateManualDocumentSchema = exports.UpdateSignatureTemplateSchema = exports.CreateSignatureTemplateSchema = exports.UpdateDocumentCategorySchema = exports.CreateDocumentCategorySchema = exports.UpdateWarehouseSchema = exports.CreateWarehouseSchema = exports.PendingPickupQuerySchema = exports.ErpDocumentReferenceQuerySchema = exports.GateAllocationSummarySchema = exports.GateAllocationSummaryItemSchema = exports.AttachDocumentReferenceSchema = exports.CreateGateVerificationSchema = exports.CreateGateOperationSchema = exports.GateOperationProductSchema = exports.VerificationStatusEnum = exports.CardTypeEnum = exports.PurchaseOrderQuerySchema = exports.UpdateOdooAccountSchema = exports.CreateOdooAccountSchema = exports.CreateRoleSchema = exports.UpdateUserSchema = exports.CreateUserSchema = exports.ChangePasswordSchema = exports.ResetPasswordSchema = exports.ForgotPasswordSchema = exports.LoginSchema = void 0;
exports.BuruhQuerySchema = exports.UpdateBuruhSchema = exports.CreateBuruhSchema = exports.TagihanReportStageEnum = exports.TagihanReportJobStatusEnum = exports.GenerateTagihanReportInputSchema = exports.TagihanReportTypeEnum = exports.TagihanQuerySchema = exports.UpdateTagihanSchema = void 0;
exports.validateTagihanTypeRules = validateTagihanTypeRules;
exports.getSecondaryQty = getSecondaryQty;
exports.getSecondaryUnit = getSecondaryUnit;
exports.formatSecondaryQty = formatSecondaryQty;
var zod_1 = require("zod");
var tagihan_document_1 = require("./tagihan-document");
__exportStar(require("./tagihan-document"), exports);
__exportStar(require("./quantity-expression"), exports);
// Authentication Schemas
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Format email tidak valid"),
    password: zod_1.z.string().min(6, "Password minimal harus 6 karakter"),
});
exports.ForgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email("Format email tidak valid"),
});
exports.ResetPasswordSchema = zod_1.z
    .object({
    token: zod_1.z.string().min(1, "Token harus diisi"),
    password: zod_1.z.string().min(6, "Password minimal harus 6 karakter"),
    confirmPassword: zod_1.z
        .string()
        .min(6, "Konfirmasi password minimal harus 6 karakter"),
})
    .refine(function (data) { return data.password === data.confirmPassword; }, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
});
exports.ChangePasswordSchema = zod_1.z
    .object({
    oldPassword: zod_1.z.string().min(6, "Password lama minimal harus 6 karakter"),
    newPassword: zod_1.z.string().min(6, "Password baru minimal harus 6 karakter"),
    confirmNewPassword: zod_1.z
        .string()
        .min(6, "Konfirmasi password baru minimal harus 6 karakter"),
})
    .refine(function (data) { return data.newPassword === data.confirmNewPassword; }, {
    message: "Konfirmasi password baru tidak cocok",
    path: ["confirmNewPassword"],
});
// User Management Schemas
exports.CreateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email("Format email tidak valid"),
    name: zod_1.z.string().min(3, "Nama minimal harus 3 karakter"),
    roleId: zod_1.z.number().int("Role ID harus berupa angka"),
    warehouseId: zod_1.z
        .number()
        .int("Warehouse ID harus berupa angka")
        .optional()
        .nullable(),
});
exports.UpdateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email("Format email tidak valid"),
    name: zod_1.z.string().min(3, "Nama minimal harus 3 karakter"),
    roleId: zod_1.z.number().int("Role ID harus berupa angka"),
    warehouseId: zod_1.z
        .number()
        .int("Warehouse ID harus berupa angka")
        .optional()
        .nullable(),
    isActive: zod_1.z.boolean(),
});
// Role & Permission Schemas
exports.CreateRoleSchema = zod_1.z.object({
    name: zod_1.z.string().min(3, "Nama role minimal harus 3 karakter"),
    description: zod_1.z.string().optional().nullable(),
    permissionIds: zod_1.z.array(zod_1.z.number().int()).optional().default([]),
});
// Odoo Configuration Schemas
exports.CreateOdooAccountSchema = zod_1.z
    .object({
    warehouseId: zod_1.z.number().int("ID Gudang harus berupa angka"),
    baseUrl: zod_1.z.string().url("URL Odoo tidak valid"),
    username: zod_1.z.string().min(1, "Username Odoo harus diisi"),
    password: zod_1.z.string().min(4, "Password Odoo minimal 4 karakter"),
    isNonCommodity: zod_1.z.boolean().optional().default(false),
    is_non_comodity: zod_1.z.boolean().optional(),
})
    .transform(function (data) {
    var _a, _b;
    return (__assign(__assign({}, data), { isNonCommodity: (_b = (_a = data.isNonCommodity) !== null && _a !== void 0 ? _a : data.is_non_comodity) !== null && _b !== void 0 ? _b : false }));
});
exports.UpdateOdooAccountSchema = zod_1.z
    .object({
    warehouseId: zod_1.z.number().int("ID Gudang harus berupa angka"),
    baseUrl: zod_1.z.string().url("URL Odoo tidak valid"),
    username: zod_1.z.string().min(1, "Username Odoo harus diisi"),
    password: zod_1.z
        .string()
        .min(4, "Password Odoo minimal 4 karakter")
        .optional()
        .nullable()
        .or(zod_1.z.literal("")),
    isActive: zod_1.z.boolean(),
    isNonCommodity: zod_1.z.boolean().optional(),
    is_non_comodity: zod_1.z.boolean().optional(),
})
    .transform(function (data) { return (__assign(__assign({}, data), { isNonCommodity: data.isNonCommodity !== undefined
        ? data.isNonCommodity
        : data.is_non_comodity !== undefined
            ? data.is_non_comodity
            : undefined })); });
// Finance & Non Commodity Purchase Order Schemas
exports.PurchaseOrderQuerySchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    page: zod_1.z.string().or(zod_1.z.number()).optional(),
    limit: zod_1.z.string().or(zod_1.z.number()).optional(),
    state: zod_1.z.string().optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(["asc", "desc"]).optional(),
});
// Gate Operation Schemas
exports.CardTypeEnum = zod_1.z.enum(["IN", "OUT"]);
exports.VerificationStatusEnum = zod_1.z.enum([
    "PENDING",
    "CANCELED",
    "VERIFIED",
    "REJECTED",
]);
exports.GateOperationProductSchema = zod_1.z.object({
    productId: zod_1.z.number().int("ID Produk harus berupa angka"),
    quantity: zod_1.z.number().positive("Quantity harus lebih besar dari 0"),
    quantId: zod_1.z.number().int().optional().nullable(),
    locationId: zod_1.z.number().int().optional().nullable(),
    documentReferenceId: zod_1.z.number().int().optional().nullable(),
});
exports.CreateGateOperationSchema = zod_1.z.object({
    cardType: exports.CardTypeEnum,
    driverName: zod_1.z.string().min(2, "Nama driver minimal harus 2 karakter"),
    licensePlate: zod_1.z.string().min(3, "Plat nomor minimal harus 3 karakter"),
    notes: zod_1.z.string().min(1, "Keterangan/catatan wajib diisi"),
    attachmentPaths: zod_1.z.array(zod_1.z.string()).optional().default([]),
    products: zod_1.z.array(exports.GateOperationProductSchema).optional().default([]),
    documentReferenceId: zod_1.z.number().int().optional().nullable(),
    documentReferenceIds: zod_1.z.array(zod_1.z.number().int()).optional().default([]),
    clientPartner: zod_1.z.string().optional().nullable(),
    driverPhone: zod_1.z.string().optional().nullable(),
});
exports.CreateGateVerificationSchema = zod_1.z.object({
    status: exports.VerificationStatusEnum,
    notes: zod_1.z.string().optional().nullable().or(zod_1.z.literal("")),
    attachmentPaths: zod_1.z.array(zod_1.z.string()).optional().default([]),
    products: zod_1.z
        .array(zod_1.z.object({
        productId: zod_1.z.number().int(),
        quantity: zod_1.z.number().nonnegative("Quantity tidak boleh negatif"),
        quantId: zod_1.z.number().int().optional().nullable(),
        locationId: zod_1.z.number().int().optional().nullable(),
        documentReferenceId: zod_1.z.number().int().optional().nullable(),
    }))
        .optional()
        .default([]),
    documentReferenceId: zod_1.z.number().int().optional().nullable(),
    documentReferenceIds: zod_1.z.array(zod_1.z.number().int()).optional().default([]),
});
exports.AttachDocumentReferenceSchema = zod_1.z.object({
    documentReferenceId: zod_1.z.number().int("ID Dokumen Referensi harus berupa angka"),
});
// Gate Operation cargo allocation per product: totalQty = allocatedQty + remainingQty
exports.GateAllocationSummaryItemSchema = zod_1.z.object({
    productId: zod_1.z.number().int(),
    productName: zod_1.z.string(),
    sku: zod_1.z.string(),
    uom: zod_1.z.string().nullable(),
    totalQty: zod_1.z.number(),
    allocatedQty: zod_1.z.number(),
    remainingQty: zod_1.z.number(),
    allocations: zod_1.z.array(zod_1.z.object({
        documentReferenceId: zod_1.z.number().int(),
        documentNumber: zod_1.z.string(),
        quantity: zod_1.z.number(),
    })),
});
exports.GateAllocationSummarySchema = zod_1.z.object({
    items: zod_1.z.array(exports.GateAllocationSummaryItemSchema),
    totalQty: zod_1.z.number(),
    allocatedQty: zod_1.z.number(),
    remainingQty: zod_1.z.number(),
});
exports.ErpDocumentReferenceQuerySchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    page: zod_1.z.number().int().positive().optional(),
    limit: zod_1.z.number().int().positive().optional(),
    type: zod_1.z.enum(["IN", "OUT"]).optional(),
    state: zod_1.z.string().optional(),
    refFax: zod_1.z.string().optional(),
    gateOperationUuid: zod_1.z.string().optional(),
});
exports.PendingPickupQuerySchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    partner: zod_1.z.string().optional(),
    scheduledDate: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
    page: zod_1.z.string().or(zod_1.z.number()).optional(),
    limit: zod_1.z.string().or(zod_1.z.number()).optional(),
});
// Warehouse CRUD Schemas
exports.CreateWarehouseSchema = zod_1.z.object({
    code: zod_1.z.string().min(2, "Kode warehouse minimal 2 karakter").max(50),
    name: zod_1.z.string().min(3, "Nama warehouse minimal 3 karakter"),
    location: zod_1.z.string().min(3, "Lokasi warehouse minimal 3 karakter"),
    address: zod_1.z.string().min(5, "Alamat minimal 5 karakter").optional().nullable(),
    capacity: zod_1.z.number().nonnegative("Kapasitas tidak boleh negatif"),
    type: zod_1.z.string().optional().nullable(),
    odooReference: zod_1.z.string().optional().nullable(),
});
exports.UpdateWarehouseSchema = zod_1.z.object({
    code: zod_1.z.string().min(2, "Kode warehouse minimal 2 karakter").max(50),
    name: zod_1.z.string().min(3, "Nama warehouse minimal 3 karakter"),
    location: zod_1.z.string().min(3, "Lokasi warehouse minimal 3 karakter"),
    address: zod_1.z.string().min(5, "Alamat minimal 5 karakter").optional().nullable(),
    capacity: zod_1.z.number().nonnegative("Kapasitas tidak boleh negatif"),
    type: zod_1.z.string().optional().nullable(),
    odooReference: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional().default(true),
});
// Document Category Schemas
exports.CreateDocumentCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Nama kategori minimal 2 karakter").max(100),
    description: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional().default(true),
});
exports.UpdateDocumentCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Nama kategori minimal 2 karakter").max(100),
    description: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean(),
});
// Signature Template Schemas
exports.CreateSignatureTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(3, "Nama template minimal 3 karakter").max(100),
    description: zod_1.z.string().optional().nullable(),
    pageNumber: zod_1.z
        .number()
        .int("Halaman harus berupa angka bulat")
        .min(1, "Halaman minimal 1"),
    posX: zod_1.z.number().nonnegative("Position X tidak boleh negatif"),
    posY: zod_1.z.number().nonnegative("Position Y tidak boleh negatif"),
    width: zod_1.z.number().positive("Lebar harus lebih besar dari 0"),
    height: zod_1.z.number().positive("Tinggi harus lebih besar dari 0"),
    qrPosX: zod_1.z.number().nonnegative("QR Position X tidak boleh negatif"),
    qrPosY: zod_1.z.number().nonnegative("QR Position Y tidak boleh negatif"),
    qrWidth: zod_1.z.number().positive("QR Lebar harus lebih besar dari 0"),
    qrHeight: zod_1.z.number().positive("QR Tinggi harus lebih besar dari 0"),
    isDefault: zod_1.z.boolean().optional().default(false),
    isActive: zod_1.z.boolean().optional().default(true),
});
exports.UpdateSignatureTemplateSchema = exports.CreateSignatureTemplateSchema.extend({
    isActive: zod_1.z.boolean(),
});
// Manual Document Schemas
exports.CreateManualDocumentSchema = zod_1.z.object({
    title: zod_1.z.string().min(3, "Judul minimal 3 karakter").max(200),
    categoryId: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    description: zod_1.z.string().optional().nullable(),
    fileUrl: zod_1.z.string().min(1, "File PDF wajib diunggah"),
});
// Sign Document Workflow Schema
exports.SignDocumentSchema = zod_1.z.object({
    templateId: zod_1.z.number().int("Template harus dipilih").optional().nullable(),
    categoryId: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    pageNumber: zod_1.z.number().int().min(1),
    posX: zod_1.z.number().nonnegative(),
    posY: zod_1.z.number().nonnegative(),
    width: zod_1.z.number().positive(),
    height: zod_1.z.number().positive(),
    qrPosX: zod_1.z.number().nonnegative(),
    qrPosY: zod_1.z.number().nonnegative(),
    qrWidth: zod_1.z.number().positive(),
    qrHeight: zod_1.z.number().positive(),
    clientTime: zod_1.z.string().optional(),
    clientTimeZone: zod_1.z.string().optional(),
});
// Stack Card (Kartu Tumpukan) Schemas
exports.StackCardRowSchema = zod_1.z.object({
    productName: zod_1.z.string().min(1, "Nama produk wajib diisi"),
    sku: zod_1.z.string().min(1, "SKU wajib diisi"),
    lot: zod_1.z.string().min(1, "Lot wajib diisi"),
    shelfLife: zod_1.z.number().int().nonnegative("Umur simpan tidak boleh negatif"),
    expiredDate: zod_1.z.string().nullable().optional(),
    placementDate: zod_1.z.string().min(1, "Tanggal penempatan wajib diisi"),
    locationName: zod_1.z.string().min(1, "Lokasi wajib diisi"),
    quantity: zod_1.z.number().nonnegative("Kuantitas tidak boleh negatif"),
    quantum: zod_1.z.number().nonnegative("Kuantum tidak boleh negatif"),
    uom: zod_1.z.string().min(1, "UoM wajib diisi"),
    spraying: zod_1.z.string().nullable().optional(),
    fumigasi: zod_1.z.string().nullable().optional(),
    fogging: zod_1.z.string().nullable().optional(),
    keterangan: zod_1.z.string().nullable().optional(),
});
exports.ImportStackCardSchema = zod_1.z.object({
    snapshotDate: zod_1.z.string().min(1, "Tanggal snapshot wajib diisi"),
    locationName: zod_1.z.string().min(1, "Lokasi wajib diisi"),
    actionType: zod_1.z.enum(["REPLACE", "APPEND"]),
    filename: zod_1.z.string().min(1, "Nama file wajib diisi"),
    rows: zod_1.z.array(exports.StackCardRowSchema).min(1, "Data baris CSV minimal harus ada 1"),
});
exports.UpdateStackCardSchema = zod_1.z.object({
    productName: zod_1.z.string().min(1, "Nama produk wajib diisi"),
    sku: zod_1.z.string().min(1, "SKU wajib diisi"),
    lot: zod_1.z.string().min(1, "Lot wajib diisi"),
    shelfLife: zod_1.z.number().int().nonnegative("Umur simpan tidak boleh negatif"),
    expiredDate: zod_1.z.string().nullable().optional(),
    placementDate: zod_1.z.string().min(1, "Tanggal penempatan wajib diisi"),
    locationName: zod_1.z.string().min(1, "Lokasi wajib diisi"),
    quantity: zod_1.z.number().nonnegative("Kuantitas tidak boleh negatif"),
    quantum: zod_1.z.number().nonnegative("Kuantum tidak boleh negatif"),
    uom: zod_1.z.string().min(1, "UoM wajib diisi"),
    spraying: zod_1.z.string().nullable().optional(),
    fumigasi: zod_1.z.string().nullable().optional(),
    fogging: zod_1.z.string().nullable().optional(),
    keterangan: zod_1.z.string().nullable().optional(),
    isPublished: zod_1.z.boolean().optional(),
});
exports.StackCardQuerySchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    page: zod_1.z.string().or(zod_1.z.number()).optional(),
    limit: zod_1.z.string().or(zod_1.z.number()).optional(),
    locationName: zod_1.z.string().optional(),
    sku: zod_1.z.string().optional(),
    lot: zod_1.z.string().optional(),
    snapshotDate: zod_1.z.string().optional(),
    isPublished: zod_1.z.string().optional(),
    dataSource: zod_1.z.enum(["REAL_STOCK", "CSV"]).optional(),
});
exports.UpdateKartuTumpukanSourceSchema = zod_1.z.object({
    source: zod_1.z.enum(["REAL_STOCK", "CSV"]),
});
// Document Template Schemas
exports.CreateDocumentTemplateSchema = zod_1.z.object({
    categoryId: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    code: zod_1.z.string().min(2, "Kode template wajib diisi").max(100),
    name: zod_1.z.string().min(2, "Nama template wajib diisi").max(255),
    description: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional().default(true),
}).merge(tagihan_document_1.TagihanTemplateUsageSchema);
exports.UpdateDocumentTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Nama template wajib diisi").max(255),
    description: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean(),
}).merge(tagihan_document_1.TagihanTemplateUsageSchema);
// Document Assembly Schema
exports.AssemblyItemSchema = zod_1.z.object({
    type: zod_1.z.enum(["TEMPLATE", "PDF"]),
    templateCode: zod_1.z.string().optional().nullable(),
    order: zod_1.z.number().int().nonnegative(),
    condition: zod_1.z.string().optional().nullable(),
    source: zod_1.z.string().optional().nullable(),
    position: zod_1.z.enum(["AFTER_DOCUMENT", "AFTER_SECTION", "BEFORE_SECTION", "LAST_PAGE"]).optional().nullable(),
});
exports.UpdateAssemblySchema = zod_1.z.array(exports.AssemblyItemSchema);
// Document Placeholder Schemas
exports.PlaceholderColumnSchema = zod_1.z.object({
    key: zod_1.z.string(),
    label: zod_1.z.string(),
});
exports.PlaceholderItemSchema = zod_1.z.object({
    key: zod_1.z.string(),
    label: zod_1.z.string(),
    type: zod_1.z.enum([
        "TEXT",
        "TEXTAREA",
        "NUMBER",
        "CURRENCY",
        "DATE",
        "TIME",
        "DATETIME",
        "BOOLEAN",
        "SELECT",
        "MULTI_SELECT",
        "IMAGE",
        "TABLE",
    ]),
    required: zod_1.z.boolean(),
    options: zod_1.z.array(zod_1.z.string()).optional().nullable(),
    columns: zod_1.z.array(exports.PlaceholderColumnSchema).optional().nullable(),
});
exports.UpdatePlaceholdersSchema = zod_1.z.array(exports.PlaceholderItemSchema);
// Document Generation Schema
exports.GenerateDocumentSchema = zod_1.z.object({
    templateId: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    title: zod_1.z.string().min(3, "Judul dokumen wajib diisi").max(255),
    documentNumber: zod_1.z.string().min(1, "Nomor dokumen wajib diisi").max(150),
    placeholder: zod_1.z.record(zod_1.z.any()),
    attachments: zod_1.z
        .array(zod_1.z.object({
        type: zod_1.z.enum(["PDF"]),
        objectKey: zod_1.z.string().min(1, "Object key attachment wajib diisi"),
    }))
        .optional()
        .default([]),
});
// Bulk Gate Verification Schemas
exports.BulkApproveSchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.string().uuid("Format UUID tidak valid")),
});
exports.BulkRejectSchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.string().uuid("Format UUID tidak valid")),
    reason: zod_1.z.string().min(1, "Alasan penolakan tidak boleh kosong"),
});
// Tagihan Finance Schemas
exports.TagihanTypeEnum = zod_1.z.enum([
    "LOADING",
    "UNLOADING",
    "REBAGGING",
    "REPROSES",
    "OVERSTAPEL",
]);
exports.MasterTagihanStatusSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Nama status minimal 2 karakter").max(100),
    description: zod_1.z.string().optional().nullable(),
    color: zod_1.z.string().optional().nullable(),
    isDefault: zod_1.z.boolean().optional(),
});
exports.CreateMasterTagihanStatusSchema = exports.MasterTagihanStatusSchema;
exports.UpdateMasterTagihanStatusSchema = exports.MasterTagihanStatusSchema.partial();
exports.TagihanManualDocumentInputSchema = zod_1.z.object({
    uuid: zod_1.z.string().optional(),
    documentNumber: zod_1.z.string().min(1, "Nomor dokumen manual wajib diisi"),
    description: zod_1.z.string().optional().nullable(),
});
exports.TagihanSummaryItemInputSchema = zod_1.z.object({
    documentType: zod_1.z.string().min(1, "Tipe dokumen wajib diisi"), // IN, OUT, INT
    uom: zod_1.z.string().min(1, "Satuan / UOM wajib diisi"),
    quantity: zod_1.z.number().nonnegative("Kuantitas tidak boleh negatif").optional().default(0),
    costPerUnit: zod_1.z.number().nonnegative("Tarif per unit tidak boleh negatif").default(0),
    subtotal: zod_1.z.number().nonnegative("Subtotal tidak boleh negatif").optional().default(0),
});
exports.CreateTagihanSchema = zod_1.z.object({
    documentNumber: zod_1.z.string().min(1, "Nomor Dokumen / SDI wajib diisi"),
    type: exports.TagihanTypeEnum,
    statusUuid: zod_1.z.string().optional().nullable(),
    tagihanDate: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional().nullable(),
    erpDocumentUuids: zod_1.z.array(zod_1.z.string()).optional().default([]),
    nonCommodityDocumentUuids: zod_1.z.array(zod_1.z.string()).optional().default([]),
    manualDocuments: zod_1.z
        .array(exports.TagihanManualDocumentInputSchema)
        .optional()
        .default([]),
    summaries: zod_1.z.array(exports.TagihanSummaryItemInputSchema).optional().default([]),
});
exports.UpdateTagihanSchema = zod_1.z.object({
    documentNumber: zod_1.z.string().min(1, "Nomor Dokumen / SDI wajib diisi").optional(),
    type: exports.TagihanTypeEnum.optional(),
    statusUuid: zod_1.z.string().optional().nullable(),
    tagihanDate: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional().nullable(),
    erpDocumentUuids: zod_1.z.array(zod_1.z.string()).optional(),
    nonCommodityDocumentUuids: zod_1.z.array(zod_1.z.string()).optional(),
    manualDocuments: zod_1.z.array(exports.TagihanManualDocumentInputSchema).optional(),
    summaries: zod_1.z.array(exports.TagihanSummaryItemInputSchema).optional(),
});
exports.TagihanQuerySchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    page: zod_1.z.string().or(zod_1.z.number()).optional(),
    limit: zod_1.z.string().or(zod_1.z.number()).optional(),
    type: zod_1.z.string().optional(),
    statusUuid: zod_1.z.string().optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    documentNumber: zod_1.z.string().optional(),
    relatedDocumentNumber: zod_1.z.string().optional(),
    productName: zod_1.z.string().optional(),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(["asc", "desc"]).optional(),
});
exports.TagihanReportTypeEnum = zod_1.z.enum([
    "COMMODITY_RECAP_EXCEL",
    "COMMODITY_RECAP_PDF",
    "ODOO_REPORT_PDF",
]);
exports.GenerateTagihanReportInputSchema = zod_1.z.object({
    reportType: exports.TagihanReportTypeEnum,
});
exports.TagihanReportJobStatusEnum = zod_1.z.enum([
    "IDLE",
    "PENDING",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
]);
exports.TagihanReportStageEnum = zod_1.z.enum([
    "PREPARING",
    "DOWNLOADING",
    "OPTIMIZING",
    "MERGING",
    "SAVING",
    "COMPLETED",
    "FAILED",
]);
function validateTagihanTypeRules(type, documents) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    if (!documents || documents.length === 0) {
        return { isValid: true };
    }
    // 1. Loading: OUT only, same month (Multiple SKUs permitted)
    if (type === "LOADING") {
        for (var _i = 0, documents_1 = documents; _i < documents_1.length; _i++) {
            var doc = documents_1[_i];
            if (doc.pickingTypeCode !== "outgoing") {
                return {
                    isValid: false,
                    error: "Dokumen ".concat(doc.documentNumber, " bertipe ").concat(doc.pickingTypeCode.toUpperCase(), ", bukan OUT (outgoing). Tipe Loading hanya mengizinkan dokumen OUT."),
                };
            }
        }
        // Check same month
        var getMonthYear = function (d) {
            if (!d)
                return null;
            var date = d instanceof Date ? d : new Date(String(d));
            if (isNaN(date.getTime()))
                return null;
            var m = date.getMonth() + 1;
            return "".concat(date.getFullYear(), "-").concat(m < 10 ? "0" + m : m);
        };
        var firstMonth = getMonthYear(((_a = documents[0]) === null || _a === void 0 ? void 0 : _a.scheduledDate) || ((_b = documents[0]) === null || _b === void 0 ? void 0 : _b.dateDone));
        if (firstMonth) {
            for (var _o = 0, documents_2 = documents; _o < documents_2.length; _o++) {
                var doc = documents_2[_o];
                var docMonth = getMonthYear(doc.scheduledDate || doc.dateDone);
                if (docMonth && docMonth !== firstMonth) {
                    return {
                        isValid: false,
                        error: "Dokumen ".concat(doc.documentNumber, " berada di bulan ").concat(docMonth, ", berbeda dari bulan dokumen pertama (").concat(firstMonth, "). Tipe Loading harus dalam bulan yang sama."),
                    };
                }
            }
        }
    }
    // 2. Unloading: IN only, same month (Multiple SKUs permitted)
    if (type === "UNLOADING") {
        for (var _p = 0, documents_3 = documents; _p < documents_3.length; _p++) {
            var doc = documents_3[_p];
            if (doc.pickingTypeCode !== "incoming") {
                return {
                    isValid: false,
                    error: "Dokumen ".concat(doc.documentNumber, " bertipe ").concat(doc.pickingTypeCode.toUpperCase(), ", bukan IN (incoming). Tipe Unloading hanya mengizinkan dokumen IN."),
                };
            }
        }
        // Check same month
        var getMonthYear = function (d) {
            if (!d)
                return null;
            var date = d instanceof Date ? d : new Date(String(d));
            if (isNaN(date.getTime()))
                return null;
            var m = date.getMonth() + 1;
            return "".concat(date.getFullYear(), "-").concat(m < 10 ? "0" + m : m);
        };
        var firstMonth = getMonthYear(((_c = documents[0]) === null || _c === void 0 ? void 0 : _c.scheduledDate) || ((_d = documents[0]) === null || _d === void 0 ? void 0 : _d.dateDone));
        if (firstMonth) {
            for (var _q = 0, documents_4 = documents; _q < documents_4.length; _q++) {
                var doc = documents_4[_q];
                var docMonth = getMonthYear(doc.scheduledDate || doc.dateDone);
                if (docMonth && docMonth !== firstMonth) {
                    return {
                        isValid: false,
                        error: "Dokumen ".concat(doc.documentNumber, " berada di bulan ").concat(docMonth, ", berbeda dari bulan dokumen pertama (").concat(firstMonth, "). Tipe Unloading harus dalam bulan yang sama."),
                    };
                }
            }
        }
    }
    // 3. Rebagging: IN & OUT, same refFax
    if (type === "REBAGGING") {
        for (var _r = 0, documents_5 = documents; _r < documents_5.length; _r++) {
            var doc = documents_5[_r];
            if (doc.pickingTypeCode !== "incoming" &&
                doc.pickingTypeCode !== "outgoing") {
                return {
                    isValid: false,
                    error: "Dokumen ".concat(doc.documentNumber, " bertipe ").concat(doc.pickingTypeCode.toUpperCase(), ". Tipe Rebagging hanya mengizinkan dokumen IN & OUT."),
                };
            }
        }
        var firstRefFax = ((_f = (_e = documents[0]) === null || _e === void 0 ? void 0 : _e.refFax) === null || _f === void 0 ? void 0 : _f.trim()) || null;
        if (!firstRefFax) {
            return {
                isValid: false,
                error: "Dokumen ".concat((_g = documents[0]) === null || _g === void 0 ? void 0 : _g.documentNumber, " tidak memiliki Ref Fax. Tipe Rebagging mewajibkan dokumen dengan refFax yang sama."),
            };
        }
        for (var _s = 0, documents_6 = documents; _s < documents_6.length; _s++) {
            var doc = documents_6[_s];
            var docRefFax = ((_h = doc.refFax) === null || _h === void 0 ? void 0 : _h.trim()) || null;
            if (!docRefFax || docRefFax.toLowerCase() !== firstRefFax.toLowerCase()) {
                return {
                    isValid: false,
                    error: "Dokumen ".concat(doc.documentNumber, " memiliki Ref Fax \"").concat(docRefFax || "KOSONG", "\", berbeda dari \"").concat(firstRefFax, "\". Tipe Rebagging mewajibkan refFax yang sama."),
                };
            }
        }
    }
    // 4. Reproses: IN & OUT, same refFax
    if (type === "REPROSES") {
        for (var _t = 0, documents_7 = documents; _t < documents_7.length; _t++) {
            var doc = documents_7[_t];
            if (doc.pickingTypeCode !== "incoming" &&
                doc.pickingTypeCode !== "outgoing") {
                return {
                    isValid: false,
                    error: "Dokumen ".concat(doc.documentNumber, " bertipe ").concat(doc.pickingTypeCode.toUpperCase(), ". Tipe Reproses hanya mengizinkan dokumen IN & OUT."),
                };
            }
        }
        var firstRefFax = ((_k = (_j = documents[0]) === null || _j === void 0 ? void 0 : _j.refFax) === null || _k === void 0 ? void 0 : _k.trim()) || null;
        if (!firstRefFax) {
            return {
                isValid: false,
                error: "Dokumen ".concat((_l = documents[0]) === null || _l === void 0 ? void 0 : _l.documentNumber, " tidak memiliki Ref Fax. Tipe Reproses mewajibkan dokumen dengan refFax yang sama."),
            };
        }
        for (var _u = 0, documents_8 = documents; _u < documents_8.length; _u++) {
            var doc = documents_8[_u];
            var docRefFax = ((_m = doc.refFax) === null || _m === void 0 ? void 0 : _m.trim()) || null;
            if (!docRefFax || docRefFax.toLowerCase() !== firstRefFax.toLowerCase()) {
                return {
                    isValid: false,
                    error: "Dokumen ".concat(doc.documentNumber, " memiliki Ref Fax \"").concat(docRefFax || "KOSONG", "\", berbeda dari \"").concat(firstRefFax, "\". Tipe Reproses mewajibkan refFax yang sama."),
                };
            }
        }
    }
    // 5. Overstapel: INT / internal only
    if (type === "OVERSTAPEL") {
        for (var _v = 0, documents_9 = documents; _v < documents_9.length; _v++) {
            var doc = documents_9[_v];
            if (doc.pickingTypeCode !== "internal") {
                return {
                    isValid: false,
                    error: "Dokumen ".concat(doc.documentNumber, " bertipe ").concat(doc.pickingTypeCode.toUpperCase(), ", bukan INT (internal). Tipe Overstapel hanya mengizinkan dokumen INT."),
                };
            }
        }
    }
    return { isValid: true };
}
/**
 * Calculates the secondary quantity based on product quantity and UoM.
 * Extracted numeric multiplier from UoM (e.g. "Pack 5 Kg" -> multiplier is 5).
 * If no numeric value exists inside the UoM, the multiplier defaults to 1.
 */
function getSecondaryQty(qty, uom) {
    if (!uom)
        return qty;
    var match = uom.match(/(\d+(?:\.\d+)?)/);
    var multiplier = match ? parseFloat(match[0]) : 1;
    return qty * multiplier;
}
function getSecondaryUnit(uom) {
    if (!uom)
        return "Kg";
    var uomLower = uom.toLowerCase();
    if (uomLower.indexOf("liter") !== -1 || uomLower.indexOf("litre") !== -1) {
        return "Liter";
    }
    if (/\d+(?:\.\d+)?\s*(l|L)(?![a-zA-Z])/.test(uom)) {
        return "L";
    }
    if (uomLower.indexOf("lembar") !== -1) {
        return "Lembar";
    }
    if (uomLower.indexOf("pcs") !== -1) {
        return "Pcs";
    }
    return "Kg";
}
function formatSecondaryQty(qty, uom) {
    var secondaryQty = getSecondaryQty(qty, uom);
    var unit = getSecondaryUnit(uom);
    return "".concat(secondaryQty.toLocaleString("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    }), " ").concat(unit);
}
// Buruh (Labor) Master Schemas
// Multipart form fields arrive as strings, so "false" must not coerce to true.
var FormBooleanSchema = zod_1.z.preprocess(function (v) { return (typeof v === "string" ? v === "true" : v); }, zod_1.z.boolean());
exports.CreateBuruhSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, "Nama buruh minimal 2 karakter").max(150),
    nik: zod_1.z
        .string()
        .trim()
        .regex(/^\d{16}$/, "NIK harus 16 digit angka")
        .optional()
        .nullable()
        .or(zod_1.z.literal("")),
    isActive: FormBooleanSchema.optional().default(true),
    // Only one mandor per warehouse; setting this replaces the current mandor
    isMandor: FormBooleanSchema.optional().default(false),
});
exports.UpdateBuruhSchema = exports.CreateBuruhSchema.partial().extend({
    removeKtpPhoto: FormBooleanSchema.optional(),
});
exports.BuruhQuerySchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    page: zod_1.z.string().or(zod_1.z.number()).optional(),
    limit: zod_1.z.string().or(zod_1.z.number()).optional(),
    isActive: zod_1.z.enum(["true", "false"]).optional(),
    isMandor: zod_1.z.enum(["true", "false"]).optional(),
});

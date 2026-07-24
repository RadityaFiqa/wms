"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateKartuTumpukanSourceSchema = exports.StackCardQuerySchema = exports.UpdateStackCardSchema = exports.ImportStackCardSchema = exports.StackCardRowSchema = exports.SignDocumentSchema = exports.CreateManualDocumentSchema = exports.UpdateSignatureTemplateSchema = exports.CreateSignatureTemplateSchema = exports.UpdateDocumentCategorySchema = exports.CreateDocumentCategorySchema = exports.UpdateWarehouseSchema = exports.CreateWarehouseSchema = exports.PendingPickupQuerySchema = exports.ErpDocumentReferenceQuerySchema = exports.CreateGateVerificationSchema = exports.CreateGateOperationSchema = exports.GateOperationProductSchema = exports.VerificationStatusEnum = exports.CardTypeEnum = exports.UpdateOdooAccountSchema = exports.CreateOdooAccountSchema = exports.CreateRoleSchema = exports.UpdateUserSchema = exports.CreateUserSchema = exports.ChangePasswordSchema = exports.ResetPasswordSchema = exports.ForgotPasswordSchema = exports.LoginSchema = void 0;
var zod_1 = require("zod");
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
exports.CreateOdooAccountSchema = zod_1.z.object({
    warehouseId: zod_1.z.number().int("ID Gudang harus berupa angka"),
    baseUrl: zod_1.z.string().url("URL Odoo tidak valid"),
    username: zod_1.z.string().min(1, "Username Odoo harus diisi"),
    password: zod_1.z.string().min(4, "Password Odoo minimal 4 karakter"),
});
exports.UpdateOdooAccountSchema = zod_1.z.object({
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
});
exports.CreateGateOperationSchema = zod_1.z.object({
    cardType: exports.CardTypeEnum,
    driverName: zod_1.z.string().min(2, "Nama driver minimal harus 2 karakter"),
    licensePlate: zod_1.z.string().min(3, "Plat nomor minimal harus 3 karakter"),
    notes: zod_1.z.string().min(1, "Keterangan/catatan wajib diisi"),
    attachmentPaths: zod_1.z.array(zod_1.z.string()).optional().default([]),
    products: zod_1.z.array(exports.GateOperationProductSchema).optional().default([]),
    documentReferenceId: zod_1.z.number().int().optional().nullable(),
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
    }))
        .optional()
        .default([]),
    documentReferenceId: zod_1.z.number().int().optional().nullable(),
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

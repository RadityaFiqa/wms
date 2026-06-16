"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignDocumentSchema = exports.CreateManualDocumentSchema = exports.UpdateSignatureTemplateSchema = exports.CreateSignatureTemplateSchema = exports.UpdateDocumentCategorySchema = exports.CreateDocumentCategorySchema = exports.UpdateWarehouseSchema = exports.CreateWarehouseSchema = exports.ErpDocumentReferenceQuerySchema = exports.AssignReferencesSchema = exports.CreateGateVerificationSchema = exports.CreateGateOperationSchema = exports.GateOperationProductSchema = exports.VerificationStatusEnum = exports.CardTypeEnum = exports.UpdateOdooAccountSchema = exports.CreateOdooAccountSchema = exports.CreateRoleSchema = exports.UpdateUserSchema = exports.CreateUserSchema = exports.ChangePasswordSchema = exports.ResetPasswordSchema = exports.ForgotPasswordSchema = exports.LoginSchema = void 0;
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
    "PARTIAL",
    "COMPLETED",
    "CANCELED",
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
    poReferences: zod_1.z.array(zod_1.z.string()).optional().default([]),
    soReferences: zod_1.z.array(zod_1.z.string()).optional().default([]),
    documentReferenceId: zod_1.z.number().int().optional().nullable(),
});
exports.AssignReferencesSchema = zod_1.z.object({
    gateItemId: zod_1.z.number().int(),
    assignments: zod_1.z.array(zod_1.z.object({
        erpDocumentItemId: zod_1.z.number().int(),
        assignedQuantity: zod_1.z
            .number()
            .positive("Kuantitas harus lebih besar dari 0"),
    })),
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
});

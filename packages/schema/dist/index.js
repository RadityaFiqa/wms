"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateGateVerificationSchema = exports.CreateGateOperationSchema = exports.GateOperationProductSchema = exports.VerificationStatusEnum = exports.CardTypeEnum = exports.UpdateOdooAccountSchema = exports.CreateOdooAccountSchema = exports.CreateRoleSchema = exports.UpdateUserSchema = exports.CreateUserSchema = exports.ChangePasswordSchema = exports.ResetPasswordSchema = exports.ForgotPasswordSchema = exports.LoginSchema = void 0;
var zod_1 = require("zod");
// Authentication Schemas
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Format email tidak valid'),
    password: zod_1.z.string().min(6, 'Password minimal harus 6 karakter'),
});
exports.ForgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Format email tidak valid'),
});
exports.ResetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token harus diisi'),
    password: zod_1.z.string().min(6, 'Password minimal harus 6 karakter'),
    confirmPassword: zod_1.z.string().min(6, 'Konfirmasi password minimal harus 6 karakter'),
}).refine(function (data) { return data.password === data.confirmPassword; }, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword'],
});
exports.ChangePasswordSchema = zod_1.z.object({
    oldPassword: zod_1.z.string().min(6, 'Password lama minimal harus 6 karakter'),
    newPassword: zod_1.z.string().min(6, 'Password baru minimal harus 6 karakter'),
    confirmNewPassword: zod_1.z.string().min(6, 'Konfirmasi password baru minimal harus 6 karakter'),
}).refine(function (data) { return data.newPassword === data.confirmNewPassword; }, {
    message: 'Konfirmasi password baru tidak cocok',
    path: ['confirmNewPassword'],
});
// User Management Schemas
exports.CreateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email('Format email tidak valid'),
    name: zod_1.z.string().min(3, 'Nama minimal harus 3 karakter'),
    roleId: zod_1.z.number().int('Role ID harus berupa angka'),
    warehouseId: zod_1.z.number().int('Warehouse ID harus berupa angka').optional().nullable(),
});
exports.UpdateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email('Format email tidak valid'),
    name: zod_1.z.string().min(3, 'Nama minimal harus 3 karakter'),
    roleId: zod_1.z.number().int('Role ID harus berupa angka'),
    warehouseId: zod_1.z.number().int('Warehouse ID harus berupa angka').optional().nullable(),
    isActive: zod_1.z.boolean(),
});
// Role & Permission Schemas
exports.CreateRoleSchema = zod_1.z.object({
    name: zod_1.z.string().min(3, 'Nama role minimal harus 3 karakter'),
    description: zod_1.z.string().optional().nullable(),
    permissionIds: zod_1.z.array(zod_1.z.number().int()).optional().default([]),
});
// Odoo Configuration Schemas
exports.CreateOdooAccountSchema = zod_1.z.object({
    warehouseId: zod_1.z.number().int('ID Gudang harus berupa angka'),
    baseUrl: zod_1.z.string().url('URL Odoo tidak valid'),
    username: zod_1.z.string().min(1, 'Username Odoo harus diisi'),
    password: zod_1.z.string().min(4, 'Password Odoo minimal 4 karakter'),
});
exports.UpdateOdooAccountSchema = zod_1.z.object({
    warehouseId: zod_1.z.number().int('ID Gudang harus berupa angka'),
    baseUrl: zod_1.z.string().url('URL Odoo tidak valid'),
    username: zod_1.z.string().min(1, 'Username Odoo harus diisi'),
    password: zod_1.z.string().min(4, 'Password Odoo minimal 4 karakter').optional().nullable().or(zod_1.z.literal('')),
    isActive: zod_1.z.boolean(),
});
// Gate Operation Schemas
exports.CardTypeEnum = zod_1.z.enum(['IN', 'OUT']);
exports.VerificationStatusEnum = zod_1.z.enum(['PENDING', 'VERIFIED', 'REJECTED']);
exports.GateOperationProductSchema = zod_1.z.object({
    productId: zod_1.z.number().int('ID Produk harus berupa angka'),
    quantity: zod_1.z.number().positive('Quantity harus lebih besar dari 0'),
});
exports.CreateGateOperationSchema = zod_1.z.object({
    cardType: exports.CardTypeEnum,
    driverName: zod_1.z.string().min(2, 'Nama driver minimal harus 2 karakter'),
    licensePlate: zod_1.z.string().min(3, 'Plat nomor minimal harus 3 karakter'),
    notes: zod_1.z.string().optional().nullable().or(zod_1.z.literal('')),
    vehiclePhotoPath: zod_1.z.string().min(1, 'Foto bukti kendaraan wajib diunggah'),
    products: zod_1.z.array(exports.GateOperationProductSchema).optional().default([]),
});
exports.CreateGateVerificationSchema = zod_1.z.object({
    status: zod_1.z.enum(['VERIFIED', 'REJECTED']),
    notes: zod_1.z.string().min(1, 'Catatan verifikasi wajib diisi'),
    attachmentPath: zod_1.z.string().optional().nullable().or(zod_1.z.literal('')),
    products: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z.number().int(),
        quantity: zod_1.z.number().nonnegative('Quantity tidak boleh negatif'),
    })).optional().default([]),
});

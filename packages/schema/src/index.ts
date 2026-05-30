import { z } from 'zod';

// Authentication Schemas
export const LoginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal harus 6 karakter'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid'),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token harus diisi'),
  password: z.string().min(6, 'Password minimal harus 6 karakter'),
  confirmPassword: z.string().min(6, 'Konfirmasi password minimal harus 6 karakter'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Konfirmasi password tidak cocok',
  path: ['confirmPassword'],
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(6, 'Password lama minimal harus 6 karakter'),
  newPassword: z.string().min(6, 'Password baru minimal harus 6 karakter'),
  confirmNewPassword: z.string().min(6, 'Konfirmasi password baru minimal harus 6 karakter'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Konfirmasi password baru tidak cocok',
  path: ['confirmNewPassword'],
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

// User Management Schemas
export const CreateUserSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  name: z.string().min(3, 'Nama minimal harus 3 karakter'),
  roleId: z.number().int('Role ID harus berupa angka'),
  warehouseId: z.number().int('Warehouse ID harus berupa angka').optional().nullable(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  name: z.string().min(3, 'Nama minimal harus 3 karakter'),
  roleId: z.number().int('Role ID harus berupa angka'),
  warehouseId: z.number().int('Warehouse ID harus berupa angka').optional().nullable(),
  isActive: z.boolean(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// Role & Permission Schemas
export const CreateRoleSchema = z.object({
  name: z.string().min(3, 'Nama role minimal harus 3 karakter'),
  description: z.string().optional().nullable(),
  permissionIds: z.array(z.number().int()).optional().default([]),
});
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;

// Odoo Configuration Schemas
export const CreateOdooAccountSchema = z.object({
  warehouseId: z.number().int('ID Gudang harus berupa angka'),
  baseUrl: z.string().url('URL Odoo tidak valid'),
  username: z.string().min(1, 'Username Odoo harus diisi'),
  password: z.string().min(4, 'Password Odoo minimal 4 karakter'),
});
export type CreateOdooAccountInput = z.infer<typeof CreateOdooAccountSchema>;

export const UpdateOdooAccountSchema = z.object({
  warehouseId: z.number().int('ID Gudang harus berupa angka'),
  baseUrl: z.string().url('URL Odoo tidak valid'),
  username: z.string().min(1, 'Username Odoo harus diisi'),
  password: z.string().min(4, 'Password Odoo minimal 4 karakter').optional().nullable().or(z.literal('')),
  isActive: z.boolean(),
});
export type UpdateOdooAccountInput = z.infer<typeof UpdateOdooAccountSchema>;

// Gate Operation Schemas
export const CardTypeEnum = z.enum(['IN', 'OUT']);
export const VerificationStatusEnum = z.enum(['PENDING', 'PARTIAL', 'COMPLETED', 'CANCELED']);

export const GateOperationProductSchema = z.object({
  productId: z.number().int('ID Produk harus berupa angka'),
  quantity: z.number().positive('Quantity harus lebih besar dari 0'),
});

export const CreateGateOperationSchema = z.object({
  cardType: CardTypeEnum,
  driverName: z.string().min(2, 'Nama driver minimal harus 2 karakter'),
  licensePlate: z.string().min(3, 'Plat nomor minimal harus 3 karakter'),
  notes: z.string().min(1, 'Keterangan/catatan wajib diisi'),
  attachmentPaths: z.array(z.string()).optional().default([]),
  products: z.array(GateOperationProductSchema).optional().default([]),
});
export type CreateGateOperationInput = z.infer<typeof CreateGateOperationSchema>;

export const CreateGateVerificationSchema = z.object({
  status: VerificationStatusEnum,
  notes: z.string().min(1, 'Catatan verifikasi wajib diisi'),
  attachmentPaths: z.array(z.string()).optional().default([]),
  products: z.array(z.object({
    productId: z.number().int(),
    quantity: z.number().nonnegative('Quantity tidak boleh negatif'),
  })).optional().default([]),
  poReferences: z.array(z.string()).optional().default([]),
  soReferences: z.array(z.string()).optional().default([]),
});
export type CreateGateVerificationInput = z.infer<typeof CreateGateVerificationSchema>;

export const AssignReferencesSchema = z.object({
  gateItemId: z.number().int(),
  assignments: z.array(z.object({
    erpDocumentItemId: z.number().int(),
    assignedQuantity: z.number().positive('Kuantitas harus lebih besar dari 0'),
  })),
});
export type AssignReferencesInput = z.infer<typeof AssignReferencesSchema>;

export const ErpDocumentReferenceQuerySchema = z.object({
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  type: z.enum(['IN', 'OUT']).optional(),
  state: z.string().optional(),
});
export type ErpDocumentReferenceQueryInput = z.infer<typeof ErpDocumentReferenceQuerySchema>;

// Warehouse CRUD Schemas
export const CreateWarehouseSchema = z.object({
  code: z.string().min(2, 'Kode warehouse minimal 2 karakter').max(50),
  name: z.string().min(3, 'Nama warehouse minimal 3 karakter'),
  location: z.string().min(3, 'Lokasi warehouse minimal 3 karakter'),
  address: z.string().min(5, 'Alamat minimal 5 karakter').optional().nullable(),
  capacity: z.number().nonnegative('Kapasitas tidak boleh negatif'),
  type: z.string().optional().nullable(),
  odooReference: z.string().optional().nullable(),
});
export type CreateWarehouseInput = z.infer<typeof CreateWarehouseSchema>;

export const UpdateWarehouseSchema = z.object({
  code: z.string().min(2, 'Kode warehouse minimal 2 karakter').max(50),
  name: z.string().min(3, 'Nama warehouse minimal 3 karakter'),
  location: z.string().min(3, 'Lokasi warehouse minimal 3 karakter'),
  address: z.string().min(5, 'Alamat minimal 5 karakter').optional().nullable(),
  capacity: z.number().nonnegative('Kapasitas tidak boleh negatif'),
  type: z.string().optional().nullable(),
  odooReference: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});
export type UpdateWarehouseInput = z.infer<typeof UpdateWarehouseSchema>;


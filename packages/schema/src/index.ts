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

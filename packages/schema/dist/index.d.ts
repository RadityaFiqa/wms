import { z } from 'zod';
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof LoginSchema>;
export declare const ForgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export declare const ResetPasswordSchema: z.ZodEffects<z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
    confirmPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    token: string;
    confirmPassword: string;
}, {
    password: string;
    token: string;
    confirmPassword: string;
}>, {
    password: string;
    token: string;
    confirmPassword: string;
}, {
    password: string;
    token: string;
    confirmPassword: string;
}>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export declare const ChangePasswordSchema: z.ZodEffects<z.ZodObject<{
    oldPassword: z.ZodString;
    newPassword: z.ZodString;
    confirmNewPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    oldPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}, {
    oldPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}>, {
    oldPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}, {
    oldPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export declare const CreateUserSchema: z.ZodObject<{
    email: z.ZodString;
    name: z.ZodString;
    roleId: z.ZodNumber;
    warehouseId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    name: string;
    roleId: number;
    warehouseId?: number | null | undefined;
}, {
    email: string;
    name: string;
    roleId: number;
    warehouseId?: number | null | undefined;
}>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export declare const UpdateUserSchema: z.ZodObject<{
    email: z.ZodString;
    name: z.ZodString;
    roleId: z.ZodNumber;
    warehouseId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    isActive: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    email: string;
    name: string;
    roleId: number;
    isActive: boolean;
    warehouseId?: number | null | undefined;
}, {
    email: string;
    name: string;
    roleId: number;
    isActive: boolean;
    warehouseId?: number | null | undefined;
}>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export declare const CreateRoleSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    permissionIds: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    permissionIds: number[];
    description?: string | null | undefined;
}, {
    name: string;
    description?: string | null | undefined;
    permissionIds?: number[] | undefined;
}>;
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export declare const CreateOdooAccountSchema: z.ZodObject<{
    warehouseId: z.ZodNumber;
    baseUrl: z.ZodString;
    username: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    warehouseId: number;
    baseUrl: string;
    username: string;
}, {
    password: string;
    warehouseId: number;
    baseUrl: string;
    username: string;
}>;
export type CreateOdooAccountInput = z.infer<typeof CreateOdooAccountSchema>;
export declare const UpdateOdooAccountSchema: z.ZodObject<{
    warehouseId: z.ZodNumber;
    baseUrl: z.ZodString;
    username: z.ZodString;
    password: z.ZodUnion<[z.ZodNullable<z.ZodOptional<z.ZodString>>, z.ZodLiteral<"">]>;
    isActive: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    warehouseId: number;
    isActive: boolean;
    baseUrl: string;
    username: string;
    password?: string | null | undefined;
}, {
    warehouseId: number;
    isActive: boolean;
    baseUrl: string;
    username: string;
    password?: string | null | undefined;
}>;
export type UpdateOdooAccountInput = z.infer<typeof UpdateOdooAccountSchema>;
//# sourceMappingURL=index.d.ts.map
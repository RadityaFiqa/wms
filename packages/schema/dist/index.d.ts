import { z } from "zod";
export * from "./tagihan-document";
export * from "./quantity-expression";
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
    name: string;
    email: string;
    roleId: number;
    warehouseId?: number | null | undefined;
}, {
    name: string;
    email: string;
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
    name: string;
    email: string;
    roleId: number;
    isActive: boolean;
    warehouseId?: number | null | undefined;
}, {
    name: string;
    email: string;
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
export declare const CreateOdooAccountSchema: z.ZodEffects<z.ZodObject<{
    warehouseId: z.ZodNumber;
    baseUrl: z.ZodString;
    username: z.ZodString;
    password: z.ZodString;
    isNonCommodity: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    is_non_comodity: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    password: string;
    warehouseId: number;
    baseUrl: string;
    username: string;
    isNonCommodity: boolean;
    is_non_comodity?: boolean | undefined;
}, {
    password: string;
    warehouseId: number;
    baseUrl: string;
    username: string;
    isNonCommodity?: boolean | undefined;
    is_non_comodity?: boolean | undefined;
}>, {
    isNonCommodity: boolean;
    password: string;
    warehouseId: number;
    baseUrl: string;
    username: string;
    is_non_comodity?: boolean | undefined;
}, {
    password: string;
    warehouseId: number;
    baseUrl: string;
    username: string;
    isNonCommodity?: boolean | undefined;
    is_non_comodity?: boolean | undefined;
}>;
export type CreateOdooAccountInput = z.infer<typeof CreateOdooAccountSchema>;
export declare const UpdateOdooAccountSchema: z.ZodEffects<z.ZodObject<{
    warehouseId: z.ZodNumber;
    baseUrl: z.ZodString;
    username: z.ZodString;
    password: z.ZodUnion<[z.ZodNullable<z.ZodOptional<z.ZodString>>, z.ZodLiteral<"">]>;
    isActive: z.ZodBoolean;
    isNonCommodity: z.ZodOptional<z.ZodBoolean>;
    is_non_comodity: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    warehouseId: number;
    isActive: boolean;
    baseUrl: string;
    username: string;
    password?: string | null | undefined;
    isNonCommodity?: boolean | undefined;
    is_non_comodity?: boolean | undefined;
}, {
    warehouseId: number;
    isActive: boolean;
    baseUrl: string;
    username: string;
    password?: string | null | undefined;
    isNonCommodity?: boolean | undefined;
    is_non_comodity?: boolean | undefined;
}>, {
    isNonCommodity: boolean | undefined;
    warehouseId: number;
    isActive: boolean;
    baseUrl: string;
    username: string;
    password?: string | null | undefined;
    is_non_comodity?: boolean | undefined;
}, {
    warehouseId: number;
    isActive: boolean;
    baseUrl: string;
    username: string;
    password?: string | null | undefined;
    isNonCommodity?: boolean | undefined;
    is_non_comodity?: boolean | undefined;
}>;
export type UpdateOdooAccountInput = z.infer<typeof UpdateOdooAccountSchema>;
export declare const PurchaseOrderQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    limit: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    state: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    search?: string | undefined;
    page?: string | number | undefined;
    limit?: string | number | undefined;
    state?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}, {
    search?: string | undefined;
    page?: string | number | undefined;
    limit?: string | number | undefined;
    state?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type PurchaseOrderQueryInput = z.infer<typeof PurchaseOrderQuerySchema>;
export declare const CardTypeEnum: z.ZodEnum<["IN", "OUT"]>;
export declare const VerificationStatusEnum: z.ZodEnum<["PENDING", "CANCELED", "VERIFIED", "REJECTED"]>;
export declare const GateOperationProductSchema: z.ZodObject<{
    productId: z.ZodNumber;
    quantity: z.ZodNumber;
    quantId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    locationId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    documentReferenceId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    productId: number;
    quantity: number;
    quantId?: number | null | undefined;
    locationId?: number | null | undefined;
    documentReferenceId?: number | null | undefined;
}, {
    productId: number;
    quantity: number;
    quantId?: number | null | undefined;
    locationId?: number | null | undefined;
    documentReferenceId?: number | null | undefined;
}>;
export declare const CreateGateOperationSchema: z.ZodObject<{
    cardType: z.ZodEnum<["IN", "OUT"]>;
    driverName: z.ZodString;
    licensePlate: z.ZodString;
    notes: z.ZodString;
    attachmentPaths: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    products: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        productId: z.ZodNumber;
        quantity: z.ZodNumber;
        quantId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        locationId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        documentReferenceId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
        documentReferenceId?: number | null | undefined;
    }, {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
        documentReferenceId?: number | null | undefined;
    }>, "many">>>;
    documentReferenceId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    documentReferenceIds: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>>;
    clientPartner: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    driverPhone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    notes: string;
    attachmentPaths: string[];
    cardType: "IN" | "OUT";
    driverName: string;
    licensePlate: string;
    products: {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
        documentReferenceId?: number | null | undefined;
    }[];
    documentReferenceIds: number[];
    documentReferenceId?: number | null | undefined;
    clientPartner?: string | null | undefined;
    driverPhone?: string | null | undefined;
}, {
    notes: string;
    cardType: "IN" | "OUT";
    driverName: string;
    licensePlate: string;
    attachmentPaths?: string[] | undefined;
    documentReferenceId?: number | null | undefined;
    products?: {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
        documentReferenceId?: number | null | undefined;
    }[] | undefined;
    documentReferenceIds?: number[] | undefined;
    clientPartner?: string | null | undefined;
    driverPhone?: string | null | undefined;
}>;
export type CreateGateOperationInput = z.infer<typeof CreateGateOperationSchema>;
export declare const CreateGateVerificationSchema: z.ZodObject<{
    status: z.ZodEnum<["PENDING", "CANCELED", "VERIFIED", "REJECTED"]>;
    notes: z.ZodUnion<[z.ZodNullable<z.ZodOptional<z.ZodString>>, z.ZodLiteral<"">]>;
    attachmentPaths: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    products: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        productId: z.ZodNumber;
        quantity: z.ZodNumber;
        quantId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        locationId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        documentReferenceId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
        documentReferenceId?: number | null | undefined;
    }, {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
        documentReferenceId?: number | null | undefined;
    }>, "many">>>;
    documentReferenceId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    documentReferenceIds: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>>;
}, "strip", z.ZodTypeAny, {
    status: "PENDING" | "CANCELED" | "VERIFIED" | "REJECTED";
    attachmentPaths: string[];
    products: {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
        documentReferenceId?: number | null | undefined;
    }[];
    documentReferenceIds: number[];
    notes?: string | null | undefined;
    documentReferenceId?: number | null | undefined;
}, {
    status: "PENDING" | "CANCELED" | "VERIFIED" | "REJECTED";
    notes?: string | null | undefined;
    attachmentPaths?: string[] | undefined;
    documentReferenceId?: number | null | undefined;
    products?: {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
        documentReferenceId?: number | null | undefined;
    }[] | undefined;
    documentReferenceIds?: number[] | undefined;
}>;
export type CreateGateVerificationInput = z.infer<typeof CreateGateVerificationSchema>;
export declare const AttachDocumentReferenceSchema: z.ZodObject<{
    documentReferenceId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    documentReferenceId: number;
}, {
    documentReferenceId: number;
}>;
export type AttachDocumentReferenceInput = z.infer<typeof AttachDocumentReferenceSchema>;
export declare const ErpDocumentReferenceQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
    type: z.ZodOptional<z.ZodEnum<["IN", "OUT"]>>;
    state: z.ZodOptional<z.ZodString>;
    refFax: z.ZodOptional<z.ZodString>;
    gateOperationUuid: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type?: "IN" | "OUT" | undefined;
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    state?: string | undefined;
    refFax?: string | undefined;
    gateOperationUuid?: string | undefined;
}, {
    type?: "IN" | "OUT" | undefined;
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    state?: string | undefined;
    refFax?: string | undefined;
    gateOperationUuid?: string | undefined;
}>;
export type ErpDocumentReferenceQueryInput = z.infer<typeof ErpDocumentReferenceQuerySchema>;
export declare const PendingPickupQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    partner: z.ZodOptional<z.ZodString>;
    scheduledDate: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    page: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    limit: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
}, "strip", z.ZodTypeAny, {
    status?: string | undefined;
    search?: string | undefined;
    page?: string | number | undefined;
    limit?: string | number | undefined;
    state?: string | undefined;
    partner?: string | undefined;
    scheduledDate?: string | undefined;
}, {
    status?: string | undefined;
    search?: string | undefined;
    page?: string | number | undefined;
    limit?: string | number | undefined;
    state?: string | undefined;
    partner?: string | undefined;
    scheduledDate?: string | undefined;
}>;
export type PendingPickupQueryInput = z.infer<typeof PendingPickupQuerySchema>;
export declare const CreateWarehouseSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    location: z.ZodString;
    address: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    capacity: z.ZodNumber;
    type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    odooReference: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    location: string;
    capacity: number;
    type?: string | null | undefined;
    address?: string | null | undefined;
    odooReference?: string | null | undefined;
}, {
    code: string;
    name: string;
    location: string;
    capacity: number;
    type?: string | null | undefined;
    address?: string | null | undefined;
    odooReference?: string | null | undefined;
}>;
export type CreateWarehouseInput = z.infer<typeof CreateWarehouseSchema>;
export declare const UpdateWarehouseSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    location: z.ZodString;
    address: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    capacity: z.ZodNumber;
    type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    odooReference: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isActive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    isActive: boolean;
    location: string;
    capacity: number;
    type?: string | null | undefined;
    address?: string | null | undefined;
    odooReference?: string | null | undefined;
}, {
    code: string;
    name: string;
    location: string;
    capacity: number;
    type?: string | null | undefined;
    isActive?: boolean | undefined;
    address?: string | null | undefined;
    odooReference?: string | null | undefined;
}>;
export type UpdateWarehouseInput = z.infer<typeof UpdateWarehouseSchema>;
export declare const CreateDocumentCategorySchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isActive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isActive: boolean;
    description?: string | null | undefined;
}, {
    name: string;
    isActive?: boolean | undefined;
    description?: string | null | undefined;
}>;
export type CreateDocumentCategoryInput = z.infer<typeof CreateDocumentCategorySchema>;
export declare const UpdateDocumentCategorySchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isActive: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string;
    isActive: boolean;
    description?: string | null | undefined;
}, {
    name: string;
    isActive: boolean;
    description?: string | null | undefined;
}>;
export type UpdateDocumentCategoryInput = z.infer<typeof UpdateDocumentCategorySchema>;
export declare const CreateSignatureTemplateSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    pageNumber: z.ZodNumber;
    posX: z.ZodNumber;
    posY: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    qrPosX: z.ZodNumber;
    qrPosY: z.ZodNumber;
    qrWidth: z.ZodNumber;
    qrHeight: z.ZodNumber;
    isDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    isActive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isActive: boolean;
    pageNumber: number;
    posX: number;
    posY: number;
    width: number;
    height: number;
    qrPosX: number;
    qrPosY: number;
    qrWidth: number;
    qrHeight: number;
    isDefault: boolean;
    description?: string | null | undefined;
}, {
    name: string;
    pageNumber: number;
    posX: number;
    posY: number;
    width: number;
    height: number;
    qrPosX: number;
    qrPosY: number;
    qrWidth: number;
    qrHeight: number;
    isActive?: boolean | undefined;
    description?: string | null | undefined;
    isDefault?: boolean | undefined;
}>;
export type CreateSignatureTemplateInput = z.infer<typeof CreateSignatureTemplateSchema>;
export declare const UpdateSignatureTemplateSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    pageNumber: z.ZodNumber;
    posX: z.ZodNumber;
    posY: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    qrPosX: z.ZodNumber;
    qrPosY: z.ZodNumber;
    qrWidth: z.ZodNumber;
    qrHeight: z.ZodNumber;
    isDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
} & {
    isActive: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string;
    isActive: boolean;
    pageNumber: number;
    posX: number;
    posY: number;
    width: number;
    height: number;
    qrPosX: number;
    qrPosY: number;
    qrWidth: number;
    qrHeight: number;
    isDefault: boolean;
    description?: string | null | undefined;
}, {
    name: string;
    isActive: boolean;
    pageNumber: number;
    posX: number;
    posY: number;
    width: number;
    height: number;
    qrPosX: number;
    qrPosY: number;
    qrWidth: number;
    qrHeight: number;
    description?: string | null | undefined;
    isDefault?: boolean | undefined;
}>;
export type UpdateSignatureTemplateInput = z.infer<typeof UpdateSignatureTemplateSchema>;
export declare const CreateManualDocumentSchema: z.ZodObject<{
    title: z.ZodString;
    categoryId: z.ZodUnion<[z.ZodNumber, z.ZodString]>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    fileUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    categoryId: string | number;
    fileUrl: string;
    description?: string | null | undefined;
}, {
    title: string;
    categoryId: string | number;
    fileUrl: string;
    description?: string | null | undefined;
}>;
export type CreateManualDocumentInput = z.infer<typeof CreateManualDocumentSchema>;
export declare const SignDocumentSchema: z.ZodObject<{
    templateId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    categoryId: z.ZodUnion<[z.ZodNumber, z.ZodString]>;
    pageNumber: z.ZodNumber;
    posX: z.ZodNumber;
    posY: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    qrPosX: z.ZodNumber;
    qrPosY: z.ZodNumber;
    qrWidth: z.ZodNumber;
    qrHeight: z.ZodNumber;
    clientTime: z.ZodOptional<z.ZodString>;
    clientTimeZone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pageNumber: number;
    posX: number;
    posY: number;
    width: number;
    height: number;
    qrPosX: number;
    qrPosY: number;
    qrWidth: number;
    qrHeight: number;
    categoryId: string | number;
    templateId?: number | null | undefined;
    clientTime?: string | undefined;
    clientTimeZone?: string | undefined;
}, {
    pageNumber: number;
    posX: number;
    posY: number;
    width: number;
    height: number;
    qrPosX: number;
    qrPosY: number;
    qrWidth: number;
    qrHeight: number;
    categoryId: string | number;
    templateId?: number | null | undefined;
    clientTime?: string | undefined;
    clientTimeZone?: string | undefined;
}>;
export type SignDocumentInput = z.infer<typeof SignDocumentSchema>;
export declare const StackCardRowSchema: z.ZodObject<{
    productName: z.ZodString;
    sku: z.ZodString;
    lot: z.ZodString;
    shelfLife: z.ZodNumber;
    expiredDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    placementDate: z.ZodString;
    locationName: z.ZodString;
    quantity: z.ZodNumber;
    quantum: z.ZodNumber;
    uom: z.ZodString;
    spraying: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fumigasi: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fogging: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    keterangan: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    productName: string;
    sku: string;
    lot: string;
    shelfLife: number;
    placementDate: string;
    locationName: string;
    quantum: number;
    uom: string;
    expiredDate?: string | null | undefined;
    spraying?: string | null | undefined;
    fumigasi?: string | null | undefined;
    fogging?: string | null | undefined;
    keterangan?: string | null | undefined;
}, {
    quantity: number;
    productName: string;
    sku: string;
    lot: string;
    shelfLife: number;
    placementDate: string;
    locationName: string;
    quantum: number;
    uom: string;
    expiredDate?: string | null | undefined;
    spraying?: string | null | undefined;
    fumigasi?: string | null | undefined;
    fogging?: string | null | undefined;
    keterangan?: string | null | undefined;
}>;
export type StackCardRow = z.infer<typeof StackCardRowSchema>;
export declare const ImportStackCardSchema: z.ZodObject<{
    snapshotDate: z.ZodString;
    locationName: z.ZodString;
    actionType: z.ZodEnum<["REPLACE", "APPEND"]>;
    filename: z.ZodString;
    rows: z.ZodArray<z.ZodObject<{
        productName: z.ZodString;
        sku: z.ZodString;
        lot: z.ZodString;
        shelfLife: z.ZodNumber;
        expiredDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        placementDate: z.ZodString;
        locationName: z.ZodString;
        quantity: z.ZodNumber;
        quantum: z.ZodNumber;
        uom: z.ZodString;
        spraying: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        fumigasi: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        fogging: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        keterangan: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        productName: string;
        sku: string;
        lot: string;
        shelfLife: number;
        placementDate: string;
        locationName: string;
        quantum: number;
        uom: string;
        expiredDate?: string | null | undefined;
        spraying?: string | null | undefined;
        fumigasi?: string | null | undefined;
        fogging?: string | null | undefined;
        keterangan?: string | null | undefined;
    }, {
        quantity: number;
        productName: string;
        sku: string;
        lot: string;
        shelfLife: number;
        placementDate: string;
        locationName: string;
        quantum: number;
        uom: string;
        expiredDate?: string | null | undefined;
        spraying?: string | null | undefined;
        fumigasi?: string | null | undefined;
        fogging?: string | null | undefined;
        keterangan?: string | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    locationName: string;
    snapshotDate: string;
    actionType: "REPLACE" | "APPEND";
    filename: string;
    rows: {
        quantity: number;
        productName: string;
        sku: string;
        lot: string;
        shelfLife: number;
        placementDate: string;
        locationName: string;
        quantum: number;
        uom: string;
        expiredDate?: string | null | undefined;
        spraying?: string | null | undefined;
        fumigasi?: string | null | undefined;
        fogging?: string | null | undefined;
        keterangan?: string | null | undefined;
    }[];
}, {
    locationName: string;
    snapshotDate: string;
    actionType: "REPLACE" | "APPEND";
    filename: string;
    rows: {
        quantity: number;
        productName: string;
        sku: string;
        lot: string;
        shelfLife: number;
        placementDate: string;
        locationName: string;
        quantum: number;
        uom: string;
        expiredDate?: string | null | undefined;
        spraying?: string | null | undefined;
        fumigasi?: string | null | undefined;
        fogging?: string | null | undefined;
        keterangan?: string | null | undefined;
    }[];
}>;
export type ImportStackCardInput = z.infer<typeof ImportStackCardSchema>;
export declare const UpdateStackCardSchema: z.ZodObject<{
    productName: z.ZodString;
    sku: z.ZodString;
    lot: z.ZodString;
    shelfLife: z.ZodNumber;
    expiredDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    placementDate: z.ZodString;
    locationName: z.ZodString;
    quantity: z.ZodNumber;
    quantum: z.ZodNumber;
    uom: z.ZodString;
    spraying: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fumigasi: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fogging: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    keterangan: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isPublished: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    productName: string;
    sku: string;
    lot: string;
    shelfLife: number;
    placementDate: string;
    locationName: string;
    quantum: number;
    uom: string;
    expiredDate?: string | null | undefined;
    spraying?: string | null | undefined;
    fumigasi?: string | null | undefined;
    fogging?: string | null | undefined;
    keterangan?: string | null | undefined;
    isPublished?: boolean | undefined;
}, {
    quantity: number;
    productName: string;
    sku: string;
    lot: string;
    shelfLife: number;
    placementDate: string;
    locationName: string;
    quantum: number;
    uom: string;
    expiredDate?: string | null | undefined;
    spraying?: string | null | undefined;
    fumigasi?: string | null | undefined;
    fogging?: string | null | undefined;
    keterangan?: string | null | undefined;
    isPublished?: boolean | undefined;
}>;
export type UpdateStackCardInput = z.infer<typeof UpdateStackCardSchema>;
export declare const StackCardQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    limit: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    locationName: z.ZodOptional<z.ZodString>;
    sku: z.ZodOptional<z.ZodString>;
    lot: z.ZodOptional<z.ZodString>;
    snapshotDate: z.ZodOptional<z.ZodString>;
    isPublished: z.ZodOptional<z.ZodString>;
    dataSource: z.ZodOptional<z.ZodEnum<["REAL_STOCK", "CSV"]>>;
}, "strip", z.ZodTypeAny, {
    search?: string | undefined;
    page?: string | number | undefined;
    limit?: string | number | undefined;
    sku?: string | undefined;
    lot?: string | undefined;
    locationName?: string | undefined;
    snapshotDate?: string | undefined;
    isPublished?: string | undefined;
    dataSource?: "REAL_STOCK" | "CSV" | undefined;
}, {
    search?: string | undefined;
    page?: string | number | undefined;
    limit?: string | number | undefined;
    sku?: string | undefined;
    lot?: string | undefined;
    locationName?: string | undefined;
    snapshotDate?: string | undefined;
    isPublished?: string | undefined;
    dataSource?: "REAL_STOCK" | "CSV" | undefined;
}>;
export type StackCardQueryInput = z.infer<typeof StackCardQuerySchema>;
export declare const UpdateKartuTumpukanSourceSchema: z.ZodObject<{
    source: z.ZodEnum<["REAL_STOCK", "CSV"]>;
}, "strip", z.ZodTypeAny, {
    source: "REAL_STOCK" | "CSV";
}, {
    source: "REAL_STOCK" | "CSV";
}>;
export type UpdateKartuTumpukanSourceInput = z.infer<typeof UpdateKartuTumpukanSourceSchema>;
export declare const CreateDocumentTemplateSchema: z.ZodObject<{
    categoryId: z.ZodUnion<[z.ZodNumber, z.ZodString]>;
    code: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isActive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
} & {
    tagihanPurpose: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodEnum<["SURAT_PERMOHONAN", "TANDA_TERIMA"]>>, "SURAT_PERMOHONAN" | "TANDA_TERIMA" | null, unknown>>;
    tagihanType: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodEnum<["LOADING", "UNLOADING", "REBAGGING", "REPROSES", "OVERSTAPEL"]>>, "LOADING" | "UNLOADING" | "REBAGGING" | "REPROSES" | "OVERSTAPEL" | null, unknown>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    isActive: boolean;
    categoryId: string | number;
    tagihanPurpose?: "SURAT_PERMOHONAN" | "TANDA_TERIMA" | null | undefined;
    tagihanType?: "LOADING" | "UNLOADING" | "REBAGGING" | "REPROSES" | "OVERSTAPEL" | null | undefined;
    description?: string | null | undefined;
}, {
    code: string;
    name: string;
    categoryId: string | number;
    tagihanPurpose?: unknown;
    tagihanType?: unknown;
    isActive?: boolean | undefined;
    description?: string | null | undefined;
}>;
export type CreateDocumentTemplateInput = z.infer<typeof CreateDocumentTemplateSchema>;
export declare const UpdateDocumentTemplateSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isActive: z.ZodBoolean;
} & {
    tagihanPurpose: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodEnum<["SURAT_PERMOHONAN", "TANDA_TERIMA"]>>, "SURAT_PERMOHONAN" | "TANDA_TERIMA" | null, unknown>>;
    tagihanType: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodEnum<["LOADING", "UNLOADING", "REBAGGING", "REPROSES", "OVERSTAPEL"]>>, "LOADING" | "UNLOADING" | "REBAGGING" | "REPROSES" | "OVERSTAPEL" | null, unknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isActive: boolean;
    tagihanPurpose?: "SURAT_PERMOHONAN" | "TANDA_TERIMA" | null | undefined;
    tagihanType?: "LOADING" | "UNLOADING" | "REBAGGING" | "REPROSES" | "OVERSTAPEL" | null | undefined;
    description?: string | null | undefined;
}, {
    name: string;
    isActive: boolean;
    tagihanPurpose?: unknown;
    tagihanType?: unknown;
    description?: string | null | undefined;
}>;
export type UpdateDocumentTemplateInput = z.infer<typeof UpdateDocumentTemplateSchema>;
export declare const AssemblyItemSchema: z.ZodObject<{
    type: z.ZodEnum<["TEMPLATE", "PDF"]>;
    templateCode: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    order: z.ZodNumber;
    condition: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    source: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    position: z.ZodNullable<z.ZodOptional<z.ZodEnum<["AFTER_DOCUMENT", "AFTER_SECTION", "BEFORE_SECTION", "LAST_PAGE"]>>>;
}, "strip", z.ZodTypeAny, {
    type: "TEMPLATE" | "PDF";
    order: number;
    source?: string | null | undefined;
    templateCode?: string | null | undefined;
    condition?: string | null | undefined;
    position?: "AFTER_DOCUMENT" | "AFTER_SECTION" | "BEFORE_SECTION" | "LAST_PAGE" | null | undefined;
}, {
    type: "TEMPLATE" | "PDF";
    order: number;
    source?: string | null | undefined;
    templateCode?: string | null | undefined;
    condition?: string | null | undefined;
    position?: "AFTER_DOCUMENT" | "AFTER_SECTION" | "BEFORE_SECTION" | "LAST_PAGE" | null | undefined;
}>;
export declare const UpdateAssemblySchema: z.ZodArray<z.ZodObject<{
    type: z.ZodEnum<["TEMPLATE", "PDF"]>;
    templateCode: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    order: z.ZodNumber;
    condition: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    source: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    position: z.ZodNullable<z.ZodOptional<z.ZodEnum<["AFTER_DOCUMENT", "AFTER_SECTION", "BEFORE_SECTION", "LAST_PAGE"]>>>;
}, "strip", z.ZodTypeAny, {
    type: "TEMPLATE" | "PDF";
    order: number;
    source?: string | null | undefined;
    templateCode?: string | null | undefined;
    condition?: string | null | undefined;
    position?: "AFTER_DOCUMENT" | "AFTER_SECTION" | "BEFORE_SECTION" | "LAST_PAGE" | null | undefined;
}, {
    type: "TEMPLATE" | "PDF";
    order: number;
    source?: string | null | undefined;
    templateCode?: string | null | undefined;
    condition?: string | null | undefined;
    position?: "AFTER_DOCUMENT" | "AFTER_SECTION" | "BEFORE_SECTION" | "LAST_PAGE" | null | undefined;
}>, "many">;
export type UpdateAssemblyInput = z.infer<typeof UpdateAssemblySchema>;
export declare const PlaceholderColumnSchema: z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
}, "strip", z.ZodTypeAny, {
    key: string;
    label: string;
}, {
    key: string;
    label: string;
}>;
export declare const PlaceholderItemSchema: z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
    type: z.ZodEnum<["TEXT", "TEXTAREA", "NUMBER", "CURRENCY", "DATE", "TIME", "DATETIME", "BOOLEAN", "SELECT", "MULTI_SELECT", "IMAGE", "TABLE"]>;
    required: z.ZodBoolean;
    options: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    columns: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        label: string;
    }, {
        key: string;
        label: string;
    }>, "many">>>;
}, "strip", z.ZodTypeAny, {
    type: "TEXT" | "TEXTAREA" | "NUMBER" | "CURRENCY" | "DATE" | "TIME" | "DATETIME" | "BOOLEAN" | "SELECT" | "MULTI_SELECT" | "IMAGE" | "TABLE";
    key: string;
    label: string;
    required: boolean;
    options?: string[] | null | undefined;
    columns?: {
        key: string;
        label: string;
    }[] | null | undefined;
}, {
    type: "TEXT" | "TEXTAREA" | "NUMBER" | "CURRENCY" | "DATE" | "TIME" | "DATETIME" | "BOOLEAN" | "SELECT" | "MULTI_SELECT" | "IMAGE" | "TABLE";
    key: string;
    label: string;
    required: boolean;
    options?: string[] | null | undefined;
    columns?: {
        key: string;
        label: string;
    }[] | null | undefined;
}>;
export declare const UpdatePlaceholdersSchema: z.ZodArray<z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
    type: z.ZodEnum<["TEXT", "TEXTAREA", "NUMBER", "CURRENCY", "DATE", "TIME", "DATETIME", "BOOLEAN", "SELECT", "MULTI_SELECT", "IMAGE", "TABLE"]>;
    required: z.ZodBoolean;
    options: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    columns: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        label: string;
    }, {
        key: string;
        label: string;
    }>, "many">>>;
}, "strip", z.ZodTypeAny, {
    type: "TEXT" | "TEXTAREA" | "NUMBER" | "CURRENCY" | "DATE" | "TIME" | "DATETIME" | "BOOLEAN" | "SELECT" | "MULTI_SELECT" | "IMAGE" | "TABLE";
    key: string;
    label: string;
    required: boolean;
    options?: string[] | null | undefined;
    columns?: {
        key: string;
        label: string;
    }[] | null | undefined;
}, {
    type: "TEXT" | "TEXTAREA" | "NUMBER" | "CURRENCY" | "DATE" | "TIME" | "DATETIME" | "BOOLEAN" | "SELECT" | "MULTI_SELECT" | "IMAGE" | "TABLE";
    key: string;
    label: string;
    required: boolean;
    options?: string[] | null | undefined;
    columns?: {
        key: string;
        label: string;
    }[] | null | undefined;
}>, "many">;
export type UpdatePlaceholdersInput = z.infer<typeof UpdatePlaceholdersSchema>;
export declare const GenerateDocumentSchema: z.ZodObject<{
    templateId: z.ZodUnion<[z.ZodNumber, z.ZodString]>;
    title: z.ZodString;
    documentNumber: z.ZodString;
    placeholder: z.ZodRecord<z.ZodString, z.ZodAny>;
    attachments: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["PDF"]>;
        objectKey: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "PDF";
        objectKey: string;
    }, {
        type: "PDF";
        objectKey: string;
    }>, "many">>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    templateId: string | number;
    documentNumber: string;
    placeholder: Record<string, any>;
    attachments: {
        type: "PDF";
        objectKey: string;
    }[];
}, {
    title: string;
    templateId: string | number;
    documentNumber: string;
    placeholder: Record<string, any>;
    attachments?: {
        type: "PDF";
        objectKey: string;
    }[] | undefined;
}>;
export type GenerateDocumentInput = z.infer<typeof GenerateDocumentSchema>;
export declare const BulkApproveSchema: z.ZodObject<{
    ids: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    ids: string[];
}, {
    ids: string[];
}>;
export type BulkApproveInput = z.infer<typeof BulkApproveSchema>;
export declare const BulkRejectSchema: z.ZodObject<{
    ids: z.ZodArray<z.ZodString, "many">;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ids: string[];
    reason: string;
}, {
    ids: string[];
    reason: string;
}>;
export type BulkRejectInput = z.infer<typeof BulkRejectSchema>;
export declare const TagihanTypeEnum: z.ZodEnum<["LOADING", "UNLOADING", "REBAGGING", "REPROSES", "OVERSTAPEL"]>;
export type TagihanType = z.infer<typeof TagihanTypeEnum>;
export declare const MasterTagihanStatusSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    color: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | null | undefined;
    isDefault?: boolean | undefined;
    color?: string | null | undefined;
}, {
    name: string;
    description?: string | null | undefined;
    isDefault?: boolean | undefined;
    color?: string | null | undefined;
}>;
export type MasterTagihanStatusInput = z.infer<typeof MasterTagihanStatusSchema>;
export declare const CreateMasterTagihanStatusSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    color: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | null | undefined;
    isDefault?: boolean | undefined;
    color?: string | null | undefined;
}, {
    name: string;
    description?: string | null | undefined;
    isDefault?: boolean | undefined;
    color?: string | null | undefined;
}>;
export type CreateMasterTagihanStatusInput = z.infer<typeof CreateMasterTagihanStatusSchema>;
export declare const UpdateMasterTagihanStatusSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    color: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    isDefault: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    isDefault?: boolean | undefined;
    color?: string | null | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    isDefault?: boolean | undefined;
    color?: string | null | undefined;
}>;
export type UpdateMasterTagihanStatusInput = z.infer<typeof UpdateMasterTagihanStatusSchema>;
export declare const TagihanManualDocumentInputSchema: z.ZodObject<{
    uuid: z.ZodOptional<z.ZodString>;
    documentNumber: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    documentNumber: string;
    uuid?: string | undefined;
    description?: string | null | undefined;
}, {
    documentNumber: string;
    uuid?: string | undefined;
    description?: string | null | undefined;
}>;
export type TagihanManualDocumentInput = z.infer<typeof TagihanManualDocumentInputSchema>;
export declare const TagihanSummaryItemInputSchema: z.ZodObject<{
    documentType: z.ZodString;
    uom: z.ZodString;
    quantity: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    costPerUnit: z.ZodDefault<z.ZodNumber>;
    subtotal: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    uom: string;
    documentType: string;
    costPerUnit: number;
    subtotal: number;
}, {
    uom: string;
    documentType: string;
    quantity?: number | undefined;
    costPerUnit?: number | undefined;
    subtotal?: number | undefined;
}>;
export type TagihanSummaryItemInput = z.infer<typeof TagihanSummaryItemInputSchema>;
export declare const CreateTagihanSchema: z.ZodObject<{
    documentNumber: z.ZodString;
    type: z.ZodEnum<["LOADING", "UNLOADING", "REBAGGING", "REPROSES", "OVERSTAPEL"]>;
    statusUuid: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    tagihanDate: z.ZodOptional<z.ZodString>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    erpDocumentUuids: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    nonCommodityDocumentUuids: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    manualDocuments: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        uuid: z.ZodOptional<z.ZodString>;
        documentNumber: z.ZodString;
        description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        documentNumber: string;
        uuid?: string | undefined;
        description?: string | null | undefined;
    }, {
        documentNumber: string;
        uuid?: string | undefined;
        description?: string | null | undefined;
    }>, "many">>>;
    summaries: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        documentType: z.ZodString;
        uom: z.ZodString;
        quantity: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        costPerUnit: z.ZodDefault<z.ZodNumber>;
        subtotal: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        uom: string;
        documentType: string;
        costPerUnit: number;
        subtotal: number;
    }, {
        uom: string;
        documentType: string;
        quantity?: number | undefined;
        costPerUnit?: number | undefined;
        subtotal?: number | undefined;
    }>, "many">>>;
}, "strip", z.ZodTypeAny, {
    type: "LOADING" | "UNLOADING" | "REBAGGING" | "REPROSES" | "OVERSTAPEL";
    documentNumber: string;
    erpDocumentUuids: string[];
    nonCommodityDocumentUuids: string[];
    manualDocuments: {
        documentNumber: string;
        uuid?: string | undefined;
        description?: string | null | undefined;
    }[];
    summaries: {
        quantity: number;
        uom: string;
        documentType: string;
        costPerUnit: number;
        subtotal: number;
    }[];
    notes?: string | null | undefined;
    statusUuid?: string | null | undefined;
    tagihanDate?: string | undefined;
}, {
    type: "LOADING" | "UNLOADING" | "REBAGGING" | "REPROSES" | "OVERSTAPEL";
    documentNumber: string;
    notes?: string | null | undefined;
    statusUuid?: string | null | undefined;
    tagihanDate?: string | undefined;
    erpDocumentUuids?: string[] | undefined;
    nonCommodityDocumentUuids?: string[] | undefined;
    manualDocuments?: {
        documentNumber: string;
        uuid?: string | undefined;
        description?: string | null | undefined;
    }[] | undefined;
    summaries?: {
        uom: string;
        documentType: string;
        quantity?: number | undefined;
        costPerUnit?: number | undefined;
        subtotal?: number | undefined;
    }[] | undefined;
}>;
export type CreateTagihanInput = z.infer<typeof CreateTagihanSchema>;
export declare const UpdateTagihanSchema: z.ZodObject<{
    documentNumber: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["LOADING", "UNLOADING", "REBAGGING", "REPROSES", "OVERSTAPEL"]>>;
    statusUuid: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    tagihanDate: z.ZodOptional<z.ZodString>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    erpDocumentUuids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    nonCommodityDocumentUuids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    manualDocuments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        uuid: z.ZodOptional<z.ZodString>;
        documentNumber: z.ZodString;
        description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        documentNumber: string;
        uuid?: string | undefined;
        description?: string | null | undefined;
    }, {
        documentNumber: string;
        uuid?: string | undefined;
        description?: string | null | undefined;
    }>, "many">>;
    summaries: z.ZodOptional<z.ZodArray<z.ZodObject<{
        documentType: z.ZodString;
        uom: z.ZodString;
        quantity: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        costPerUnit: z.ZodDefault<z.ZodNumber>;
        subtotal: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        uom: string;
        documentType: string;
        costPerUnit: number;
        subtotal: number;
    }, {
        uom: string;
        documentType: string;
        quantity?: number | undefined;
        costPerUnit?: number | undefined;
        subtotal?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type?: "LOADING" | "UNLOADING" | "REBAGGING" | "REPROSES" | "OVERSTAPEL" | undefined;
    notes?: string | null | undefined;
    documentNumber?: string | undefined;
    statusUuid?: string | null | undefined;
    tagihanDate?: string | undefined;
    erpDocumentUuids?: string[] | undefined;
    nonCommodityDocumentUuids?: string[] | undefined;
    manualDocuments?: {
        documentNumber: string;
        uuid?: string | undefined;
        description?: string | null | undefined;
    }[] | undefined;
    summaries?: {
        quantity: number;
        uom: string;
        documentType: string;
        costPerUnit: number;
        subtotal: number;
    }[] | undefined;
}, {
    type?: "LOADING" | "UNLOADING" | "REBAGGING" | "REPROSES" | "OVERSTAPEL" | undefined;
    notes?: string | null | undefined;
    documentNumber?: string | undefined;
    statusUuid?: string | null | undefined;
    tagihanDate?: string | undefined;
    erpDocumentUuids?: string[] | undefined;
    nonCommodityDocumentUuids?: string[] | undefined;
    manualDocuments?: {
        documentNumber: string;
        uuid?: string | undefined;
        description?: string | null | undefined;
    }[] | undefined;
    summaries?: {
        uom: string;
        documentType: string;
        quantity?: number | undefined;
        costPerUnit?: number | undefined;
        subtotal?: number | undefined;
    }[] | undefined;
}>;
export type UpdateTagihanInput = z.infer<typeof UpdateTagihanSchema>;
export declare const TagihanQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    limit: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    type: z.ZodOptional<z.ZodString>;
    statusUuid: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    documentNumber: z.ZodOptional<z.ZodString>;
    relatedDocumentNumber: z.ZodOptional<z.ZodString>;
    productName: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    type?: string | undefined;
    search?: string | undefined;
    page?: string | number | undefined;
    limit?: string | number | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    productName?: string | undefined;
    documentNumber?: string | undefined;
    statusUuid?: string | undefined;
    relatedDocumentNumber?: string | undefined;
}, {
    type?: string | undefined;
    search?: string | undefined;
    page?: string | number | undefined;
    limit?: string | number | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    productName?: string | undefined;
    documentNumber?: string | undefined;
    statusUuid?: string | undefined;
    relatedDocumentNumber?: string | undefined;
}>;
export type TagihanQueryInput = z.infer<typeof TagihanQuerySchema>;
export declare const TagihanReportTypeEnum: z.ZodEnum<["COMMODITY_RECAP_EXCEL", "COMMODITY_RECAP_PDF", "ODOO_REPORT_PDF"]>;
export type TagihanReportType = z.infer<typeof TagihanReportTypeEnum>;
export declare const GenerateTagihanReportInputSchema: z.ZodObject<{
    reportType: z.ZodEnum<["COMMODITY_RECAP_EXCEL", "COMMODITY_RECAP_PDF", "ODOO_REPORT_PDF"]>;
}, "strip", z.ZodTypeAny, {
    reportType: "COMMODITY_RECAP_EXCEL" | "COMMODITY_RECAP_PDF" | "ODOO_REPORT_PDF";
}, {
    reportType: "COMMODITY_RECAP_EXCEL" | "COMMODITY_RECAP_PDF" | "ODOO_REPORT_PDF";
}>;
export type GenerateTagihanReportInput = z.infer<typeof GenerateTagihanReportInputSchema>;
export declare const TagihanReportJobStatusEnum: z.ZodEnum<["IDLE", "PENDING", "PROCESSING", "COMPLETED", "FAILED"]>;
export type TagihanReportJobStatus = z.infer<typeof TagihanReportJobStatusEnum>;
export declare const TagihanReportStageEnum: z.ZodEnum<["PREPARING", "DOWNLOADING", "OPTIMIZING", "MERGING", "SAVING", "COMPLETED", "FAILED"]>;
export type TagihanReportStage = z.infer<typeof TagihanReportStageEnum>;
export interface ErpDocumentCandidate {
    uuid: string;
    documentNumber: string;
    pickingTypeCode: string;
    scheduledDate?: string | Date | null;
    dateDone?: string | Date | null;
    refFax?: string | null;
    items?: Array<{
        productName: string;
        uom: string;
        quantity: number;
    }>;
}
export declare function validateTagihanTypeRules(type: TagihanType, documents: ErpDocumentCandidate[]): {
    isValid: boolean;
    error?: string;
};
/**
 * Calculates the secondary quantity based on product quantity and UoM.
 * Extracted numeric multiplier from UoM (e.g. "Pack 5 Kg" -> multiplier is 5).
 * If no numeric value exists inside the UoM, the multiplier defaults to 1.
 */
export declare function getSecondaryQty(qty: number, uom?: string | null): number;
export declare function getSecondaryUnit(uom?: string | null): string;
export declare function formatSecondaryQty(qty: number, uom?: string | null): string;
export declare const CreateBuruhSchema: z.ZodObject<{
    name: z.ZodString;
    nik: z.ZodUnion<[z.ZodNullable<z.ZodOptional<z.ZodString>>, z.ZodLiteral<"">]>;
    isActive: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodBoolean, boolean, unknown>>>;
    isMandor: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodBoolean, boolean, unknown>>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isActive: boolean;
    isMandor: boolean;
    nik?: string | null | undefined;
}, {
    name: string;
    isActive?: unknown;
    nik?: string | null | undefined;
    isMandor?: unknown;
}>;
export type CreateBuruhInput = z.infer<typeof CreateBuruhSchema>;
export declare const UpdateBuruhSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    nik: z.ZodOptional<z.ZodUnion<[z.ZodNullable<z.ZodOptional<z.ZodString>>, z.ZodLiteral<"">]>>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodBoolean, boolean, unknown>>>>;
    isMandor: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodBoolean, boolean, unknown>>>>;
} & {
    removeKtpPhoto: z.ZodOptional<z.ZodEffects<z.ZodBoolean, boolean, unknown>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    isActive?: boolean | undefined;
    nik?: string | null | undefined;
    isMandor?: boolean | undefined;
    removeKtpPhoto?: boolean | undefined;
}, {
    name?: string | undefined;
    isActive?: unknown;
    nik?: string | null | undefined;
    isMandor?: unknown;
    removeKtpPhoto?: unknown;
}>;
export type UpdateBuruhInput = z.infer<typeof UpdateBuruhSchema>;
export declare const BuruhQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    limit: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    isActive: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
    isMandor: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
}, "strip", z.ZodTypeAny, {
    isActive?: "true" | "false" | undefined;
    search?: string | undefined;
    page?: string | number | undefined;
    limit?: string | number | undefined;
    isMandor?: "true" | "false" | undefined;
}, {
    isActive?: "true" | "false" | undefined;
    search?: string | undefined;
    page?: string | number | undefined;
    limit?: string | number | undefined;
    isMandor?: "true" | "false" | undefined;
}>;
export type BuruhQueryInput = z.infer<typeof BuruhQuerySchema>;
export declare const MoveBuruhSchema: z.ZodObject<{
    direction: z.ZodEnum<["up", "down"]>;
}, "strip", z.ZodTypeAny, {
    direction: "up" | "down";
}, {
    direction: "up" | "down";
}>;
export type MoveBuruhInput = z.infer<typeof MoveBuruhSchema>;
export interface BuruhResponse {
    uuid: string;
    name: string;
    nik: string | null;
    isActive: boolean;
    isMandor: boolean;
    sortOrder: number;
    ktpPhotoUrl: string | null;
    createdAt: string;
    updatedAt: string;
}
//# sourceMappingURL=index.d.ts.map
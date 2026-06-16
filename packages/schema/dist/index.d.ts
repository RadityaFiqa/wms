import { z } from "zod";
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
export declare const CardTypeEnum: z.ZodEnum<["IN", "OUT"]>;
export declare const VerificationStatusEnum: z.ZodEnum<["PENDING", "PARTIAL", "COMPLETED", "CANCELED"]>;
export declare const GateOperationProductSchema: z.ZodObject<{
    productId: z.ZodNumber;
    quantity: z.ZodNumber;
    quantId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    locationId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    productId: number;
    quantity: number;
    quantId?: number | null | undefined;
    locationId?: number | null | undefined;
}, {
    productId: number;
    quantity: number;
    quantId?: number | null | undefined;
    locationId?: number | null | undefined;
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
    }, "strip", z.ZodTypeAny, {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
    }, {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
    }>, "many">>>;
    documentReferenceId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    clientPartner: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    driverPhone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    cardType: "IN" | "OUT";
    driverName: string;
    licensePlate: string;
    notes: string;
    attachmentPaths: string[];
    products: {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
    }[];
    documentReferenceId?: number | null | undefined;
    clientPartner?: string | null | undefined;
    driverPhone?: string | null | undefined;
}, {
    cardType: "IN" | "OUT";
    driverName: string;
    licensePlate: string;
    notes: string;
    attachmentPaths?: string[] | undefined;
    products?: {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
    }[] | undefined;
    documentReferenceId?: number | null | undefined;
    clientPartner?: string | null | undefined;
    driverPhone?: string | null | undefined;
}>;
export type CreateGateOperationInput = z.infer<typeof CreateGateOperationSchema>;
export declare const CreateGateVerificationSchema: z.ZodObject<{
    status: z.ZodEnum<["PENDING", "PARTIAL", "COMPLETED", "CANCELED"]>;
    notes: z.ZodUnion<[z.ZodNullable<z.ZodOptional<z.ZodString>>, z.ZodLiteral<"">]>;
    attachmentPaths: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    products: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        productId: z.ZodNumber;
        quantity: z.ZodNumber;
        quantId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        locationId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
    }, {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
    }>, "many">>>;
    poReferences: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    soReferences: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    documentReferenceId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    status: "PENDING" | "PARTIAL" | "COMPLETED" | "CANCELED";
    attachmentPaths: string[];
    products: {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
    }[];
    poReferences: string[];
    soReferences: string[];
    notes?: string | null | undefined;
    documentReferenceId?: number | null | undefined;
}, {
    status: "PENDING" | "PARTIAL" | "COMPLETED" | "CANCELED";
    notes?: string | null | undefined;
    attachmentPaths?: string[] | undefined;
    products?: {
        productId: number;
        quantity: number;
        quantId?: number | null | undefined;
        locationId?: number | null | undefined;
    }[] | undefined;
    documentReferenceId?: number | null | undefined;
    poReferences?: string[] | undefined;
    soReferences?: string[] | undefined;
}>;
export type CreateGateVerificationInput = z.infer<typeof CreateGateVerificationSchema>;
export declare const AssignReferencesSchema: z.ZodObject<{
    gateItemId: z.ZodNumber;
    assignments: z.ZodArray<z.ZodObject<{
        erpDocumentItemId: z.ZodNumber;
        assignedQuantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        erpDocumentItemId: number;
        assignedQuantity: number;
    }, {
        erpDocumentItemId: number;
        assignedQuantity: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    gateItemId: number;
    assignments: {
        erpDocumentItemId: number;
        assignedQuantity: number;
    }[];
}, {
    gateItemId: number;
    assignments: {
        erpDocumentItemId: number;
        assignedQuantity: number;
    }[];
}>;
export type AssignReferencesInput = z.infer<typeof AssignReferencesSchema>;
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
}>;
export type SignDocumentInput = z.infer<typeof SignDocumentSchema>;
//# sourceMappingURL=index.d.ts.map
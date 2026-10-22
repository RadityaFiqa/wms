import { z } from "zod";
import { TagihanTemplateUsageSchema } from "./tagihan-document";

export * from "./tagihan-document";
export * from "./quantity-expression";

// Authentication Schemas
export const LoginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal harus 6 karakter"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid"),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token harus diisi"),
    password: z.string().min(6, "Password minimal harus 6 karakter"),
    confirmPassword: z
      .string()
      .min(6, "Konfirmasi password minimal harus 6 karakter"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const ChangePasswordSchema = z
  .object({
    oldPassword: z.string().min(6, "Password lama minimal harus 6 karakter"),
    newPassword: z.string().min(6, "Password baru minimal harus 6 karakter"),
    confirmNewPassword: z
      .string()
      .min(6, "Konfirmasi password baru minimal harus 6 karakter"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Konfirmasi password baru tidak cocok",
    path: ["confirmNewPassword"],
  });
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

// User Management Schemas
export const CreateUserSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  name: z.string().min(3, "Nama minimal harus 3 karakter"),
  roleId: z.number().int("Role ID harus berupa angka"),
  warehouseId: z
    .number()
    .int("Warehouse ID harus berupa angka")
    .optional()
    .nullable(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  name: z.string().min(3, "Nama minimal harus 3 karakter"),
  roleId: z.number().int("Role ID harus berupa angka"),
  warehouseId: z
    .number()
    .int("Warehouse ID harus berupa angka")
    .optional()
    .nullable(),
  isActive: z.boolean(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// Role & Permission Schemas
export const CreateRoleSchema = z.object({
  name: z.string().min(3, "Nama role minimal harus 3 karakter"),
  description: z.string().optional().nullable(),
  permissionIds: z.array(z.number().int()).optional().default([]),
});
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;

// Odoo Configuration Schemas
export const CreateOdooAccountSchema = z
  .object({
    warehouseId: z.number().int("ID Gudang harus berupa angka"),
    baseUrl: z.string().url("URL Odoo tidak valid"),
    username: z.string().min(1, "Username Odoo harus diisi"),
    password: z.string().min(4, "Password Odoo minimal 4 karakter"),
    isNonCommodity: z.boolean().optional().default(false),
    is_non_comodity: z.boolean().optional(),
  })
  .transform((data) => ({
    ...data,
    isNonCommodity:
      data.isNonCommodity ?? data.is_non_comodity ?? false,
  }));
export type CreateOdooAccountInput = z.infer<typeof CreateOdooAccountSchema>;

export const UpdateOdooAccountSchema = z
  .object({
    warehouseId: z.number().int("ID Gudang harus berupa angka"),
    baseUrl: z.string().url("URL Odoo tidak valid"),
    username: z.string().min(1, "Username Odoo harus diisi"),
    password: z
      .string()
      .min(4, "Password Odoo minimal 4 karakter")
      .optional()
      .nullable()
      .or(z.literal("")),
    isActive: z.boolean(),
    isNonCommodity: z.boolean().optional(),
    is_non_comodity: z.boolean().optional(),
  })
  .transform((data) => ({
    ...data,
    isNonCommodity:
      data.isNonCommodity !== undefined
        ? data.isNonCommodity
        : data.is_non_comodity !== undefined
          ? data.is_non_comodity
          : undefined,
  }));
export type UpdateOdooAccountInput = z.infer<typeof UpdateOdooAccountSchema>;

// Finance & Non Commodity Purchase Order Schemas
export const PurchaseOrderQuerySchema = z.object({
  search: z.string().optional(),
  page: z.string().or(z.number()).optional(),
  limit: z.string().or(z.number()).optional(),
  state: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});
export type PurchaseOrderQueryInput = z.infer<typeof PurchaseOrderQuerySchema>;

// Gate Operation Schemas
export const CardTypeEnum = z.enum(["IN", "OUT"]);
export const VerificationStatusEnum = z.enum([
  "PENDING",
  "CANCELED",
  "VERIFIED",
  "REJECTED",
]);

export const GateOperationProductSchema = z.object({
  productId: z.number().int("ID Produk harus berupa angka"),
  quantity: z.number().positive("Quantity harus lebih besar dari 0"),
  quantId: z.number().int().optional().nullable(),
  locationId: z.number().int().optional().nullable(),
  documentReferenceId: z.number().int().optional().nullable(),
});

export const CreateGateOperationSchema = z.object({
  cardType: CardTypeEnum,
  driverName: z.string().min(2, "Nama driver minimal harus 2 karakter"),
  licensePlate: z.string().min(3, "Plat nomor minimal harus 3 karakter"),
  notes: z.string().min(1, "Keterangan/catatan wajib diisi"),
  attachmentPaths: z.array(z.string()).optional().default([]),
  products: z.array(GateOperationProductSchema).optional().default([]),
  documentReferenceId: z.number().int().optional().nullable(),
  documentReferenceIds: z.array(z.number().int()).optional().default([]),
  clientPartner: z.string().optional().nullable(),
  driverPhone: z.string().optional().nullable(),
});
export type CreateGateOperationInput = z.infer<
  typeof CreateGateOperationSchema
>;

export const CreateGateVerificationSchema = z.object({
  status: VerificationStatusEnum,
  notes: z.string().optional().nullable().or(z.literal("")),
  attachmentPaths: z.array(z.string()).optional().default([]),
  products: z
    .array(
      z.object({
        productId: z.number().int(),
        quantity: z.number().nonnegative("Quantity tidak boleh negatif"),
        quantId: z.number().int().optional().nullable(),
        locationId: z.number().int().optional().nullable(),
        documentReferenceId: z.number().int().optional().nullable(),
      }),
    )
    .optional()
    .default([]),
  documentReferenceId: z.number().int().optional().nullable(),
  documentReferenceIds: z.array(z.number().int()).optional().default([]),
});
export type CreateGateVerificationInput = z.infer<
  typeof CreateGateVerificationSchema
>;

export const AttachDocumentReferenceSchema = z.object({
  documentReferenceId: z.number().int("ID Dokumen Referensi harus berupa angka"),
});
export type AttachDocumentReferenceInput = z.infer<
  typeof AttachDocumentReferenceSchema
>;


export const ErpDocumentReferenceQuerySchema = z.object({
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  type: z.enum(["IN", "OUT"]).optional(),
  state: z.string().optional(),
  refFax: z.string().optional(),
  gateOperationUuid: z.string().optional(),
});
export type ErpDocumentReferenceQueryInput = z.infer<
  typeof ErpDocumentReferenceQuerySchema
>;

export const PendingPickupQuerySchema = z.object({
  search: z.string().optional(),
  partner: z.string().optional(),
  scheduledDate: z.string().optional(),
  state: z.string().optional(),
  status: z.string().optional(),
  page: z.string().or(z.number()).optional(),
  limit: z.string().or(z.number()).optional(),
});
export type PendingPickupQueryInput = z.infer<
  typeof PendingPickupQuerySchema
>;

// Warehouse CRUD Schemas
export const CreateWarehouseSchema = z.object({
  code: z.string().min(2, "Kode warehouse minimal 2 karakter").max(50),
  name: z.string().min(3, "Nama warehouse minimal 3 karakter"),
  location: z.string().min(3, "Lokasi warehouse minimal 3 karakter"),
  address: z.string().min(5, "Alamat minimal 5 karakter").optional().nullable(),
  capacity: z.number().nonnegative("Kapasitas tidak boleh negatif"),
  type: z.string().optional().nullable(),
  odooReference: z.string().optional().nullable(),
});
export type CreateWarehouseInput = z.infer<typeof CreateWarehouseSchema>;

export const UpdateWarehouseSchema = z.object({
  code: z.string().min(2, "Kode warehouse minimal 2 karakter").max(50),
  name: z.string().min(3, "Nama warehouse minimal 3 karakter"),
  location: z.string().min(3, "Lokasi warehouse minimal 3 karakter"),
  address: z.string().min(5, "Alamat minimal 5 karakter").optional().nullable(),
  capacity: z.number().nonnegative("Kapasitas tidak boleh negatif"),
  type: z.string().optional().nullable(),
  odooReference: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});
export type UpdateWarehouseInput = z.infer<typeof UpdateWarehouseSchema>;

// Document Category Schemas
export const CreateDocumentCategorySchema = z.object({
  name: z.string().min(2, "Nama kategori minimal 2 karakter").max(100),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});
export type CreateDocumentCategoryInput = z.infer<
  typeof CreateDocumentCategorySchema
>;

export const UpdateDocumentCategorySchema = z.object({
  name: z.string().min(2, "Nama kategori minimal 2 karakter").max(100),
  description: z.string().optional().nullable(),
  isActive: z.boolean(),
});
export type UpdateDocumentCategoryInput = z.infer<
  typeof UpdateDocumentCategorySchema
>;

// Signature Template Schemas
export const CreateSignatureTemplateSchema = z.object({
  name: z.string().min(3, "Nama template minimal 3 karakter").max(100),
  description: z.string().optional().nullable(),
  pageNumber: z
    .number()
    .int("Halaman harus berupa angka bulat")
    .min(1, "Halaman minimal 1"),
  posX: z.number().nonnegative("Position X tidak boleh negatif"),
  posY: z.number().nonnegative("Position Y tidak boleh negatif"),
  width: z.number().positive("Lebar harus lebih besar dari 0"),
  height: z.number().positive("Tinggi harus lebih besar dari 0"),
  qrPosX: z.number().nonnegative("QR Position X tidak boleh negatif"),
  qrPosY: z.number().nonnegative("QR Position Y tidak boleh negatif"),
  qrWidth: z.number().positive("QR Lebar harus lebih besar dari 0"),
  qrHeight: z.number().positive("QR Tinggi harus lebih besar dari 0"),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});
export type CreateSignatureTemplateInput = z.infer<
  typeof CreateSignatureTemplateSchema
>;

export const UpdateSignatureTemplateSchema =
  CreateSignatureTemplateSchema.extend({
    isActive: z.boolean(),
  });
export type UpdateSignatureTemplateInput = z.infer<
  typeof UpdateSignatureTemplateSchema
>;

// Manual Document Schemas
export const CreateManualDocumentSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter").max(200),
  categoryId: z.union([z.number(), z.string()]),
  description: z.string().optional().nullable(),
  fileUrl: z.string().min(1, "File PDF wajib diunggah"),
});
export type CreateManualDocumentInput = z.infer<
  typeof CreateManualDocumentSchema
>;

// Sign Document Workflow Schema
export const SignDocumentSchema = z.object({
  templateId: z.number().int("Template harus dipilih").optional().nullable(),
  categoryId: z.union([z.number(), z.string()]),
  pageNumber: z.number().int().min(1),
  posX: z.number().nonnegative(),
  posY: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive(),
  qrPosX: z.number().nonnegative(),
  qrPosY: z.number().nonnegative(),
  qrWidth: z.number().positive(),
  qrHeight: z.number().positive(),
  clientTime: z.string().optional(),
  clientTimeZone: z.string().optional(),
});
export type SignDocumentInput = z.infer<typeof SignDocumentSchema>;

// Stack Card (Kartu Tumpukan) Schemas
export const StackCardRowSchema = z.object({
  productName: z.string().min(1, "Nama produk wajib diisi"),
  sku: z.string().min(1, "SKU wajib diisi"),
  lot: z.string().min(1, "Lot wajib diisi"),
  shelfLife: z.number().int().nonnegative("Umur simpan tidak boleh negatif"),
  expiredDate: z.string().nullable().optional(),
  placementDate: z.string().min(1, "Tanggal penempatan wajib diisi"),
  locationName: z.string().min(1, "Lokasi wajib diisi"),
  quantity: z.number().nonnegative("Kuantitas tidak boleh negatif"),
  quantum: z.number().nonnegative("Kuantum tidak boleh negatif"),
  uom: z.string().min(1, "UoM wajib diisi"),
  spraying: z.string().nullable().optional(),
  fumigasi: z.string().nullable().optional(),
  fogging: z.string().nullable().optional(),
  keterangan: z.string().nullable().optional(),
});
export type StackCardRow = z.infer<typeof StackCardRowSchema>;

export const ImportStackCardSchema = z.object({
  snapshotDate: z.string().min(1, "Tanggal snapshot wajib diisi"),
  locationName: z.string().min(1, "Lokasi wajib diisi"),
  actionType: z.enum(["REPLACE", "APPEND"]),
  filename: z.string().min(1, "Nama file wajib diisi"),
  rows: z.array(StackCardRowSchema).min(1, "Data baris CSV minimal harus ada 1"),
});
export type ImportStackCardInput = z.infer<typeof ImportStackCardSchema>;

export const UpdateStackCardSchema = z.object({
  productName: z.string().min(1, "Nama produk wajib diisi"),
  sku: z.string().min(1, "SKU wajib diisi"),
  lot: z.string().min(1, "Lot wajib diisi"),
  shelfLife: z.number().int().nonnegative("Umur simpan tidak boleh negatif"),
  expiredDate: z.string().nullable().optional(),
  placementDate: z.string().min(1, "Tanggal penempatan wajib diisi"),
  locationName: z.string().min(1, "Lokasi wajib diisi"),
  quantity: z.number().nonnegative("Kuantitas tidak boleh negatif"),
  quantum: z.number().nonnegative("Kuantum tidak boleh negatif"),
  uom: z.string().min(1, "UoM wajib diisi"),
  spraying: z.string().nullable().optional(),
  fumigasi: z.string().nullable().optional(),
  fogging: z.string().nullable().optional(),
  keterangan: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
});
export type UpdateStackCardInput = z.infer<typeof UpdateStackCardSchema>;

export const StackCardQuerySchema = z.object({
  search: z.string().optional(),
  page: z.string().or(z.number()).optional(),
  limit: z.string().or(z.number()).optional(),
  locationName: z.string().optional(),
  sku: z.string().optional(),
  lot: z.string().optional(),
  snapshotDate: z.string().optional(),
  isPublished: z.string().optional(),
  dataSource: z.enum(["REAL_STOCK", "CSV"]).optional(),
});
export type StackCardQueryInput = z.infer<typeof StackCardQuerySchema>;

export const UpdateKartuTumpukanSourceSchema = z.object({
  source: z.enum(["REAL_STOCK", "CSV"]),
});
export type UpdateKartuTumpukanSourceInput = z.infer<typeof UpdateKartuTumpukanSourceSchema>;

// Document Template Schemas
export const CreateDocumentTemplateSchema = z.object({
  categoryId: z.union([z.number(), z.string()]),
  code: z.string().min(2, "Kode template wajib diisi").max(100),
  name: z.string().min(2, "Nama template wajib diisi").max(255),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
}).merge(TagihanTemplateUsageSchema);
export type CreateDocumentTemplateInput = z.infer<typeof CreateDocumentTemplateSchema>;

export const UpdateDocumentTemplateSchema = z.object({
  name: z.string().min(2, "Nama template wajib diisi").max(255),
  description: z.string().optional().nullable(),
  isActive: z.boolean(),
}).merge(TagihanTemplateUsageSchema);
export type UpdateDocumentTemplateInput = z.infer<typeof UpdateDocumentTemplateSchema>;

// Document Assembly Schema
export const AssemblyItemSchema = z.object({
  type: z.enum(["TEMPLATE", "PDF"]),
  templateCode: z.string().optional().nullable(),
  order: z.number().int().nonnegative(),
  condition: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  position: z.enum(["AFTER_DOCUMENT", "AFTER_SECTION", "BEFORE_SECTION", "LAST_PAGE"]).optional().nullable(),
});
export const UpdateAssemblySchema = z.array(AssemblyItemSchema);
export type UpdateAssemblyInput = z.infer<typeof UpdateAssemblySchema>;

// Document Placeholder Schemas
export const PlaceholderColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
});

export const PlaceholderItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum([
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
  required: z.boolean(),
  options: z.array(z.string()).optional().nullable(),
  columns: z.array(PlaceholderColumnSchema).optional().nullable(),
});

export const UpdatePlaceholdersSchema = z.array(PlaceholderItemSchema);
export type UpdatePlaceholdersInput = z.infer<typeof UpdatePlaceholdersSchema>;

// Document Generation Schema
export const GenerateDocumentSchema = z.object({
  templateId: z.union([z.number(), z.string()]),
  title: z.string().min(3, "Judul dokumen wajib diisi").max(255),
  documentNumber: z.string().min(1, "Nomor dokumen wajib diisi").max(150),
  placeholder: z.record(z.any()),
  attachments: z
    .array(
      z.object({
        type: z.enum(["PDF"]),
        objectKey: z.string().min(1, "Object key attachment wajib diisi"),
      }),
    )
    .optional()
    .default([]),
});
export type GenerateDocumentInput = z.infer<typeof GenerateDocumentSchema>;

// Bulk Gate Verification Schemas
export const BulkApproveSchema = z.object({
  ids: z.array(z.string().uuid("Format UUID tidak valid")),
});
export type BulkApproveInput = z.infer<typeof BulkApproveSchema>;

export const BulkRejectSchema = z.object({
  ids: z.array(z.string().uuid("Format UUID tidak valid")),
  reason: z.string().min(1, "Alasan penolakan tidak boleh kosong"),
});
export type BulkRejectInput = z.infer<typeof BulkRejectSchema>;

// Tagihan Finance Schemas
export const TagihanTypeEnum = z.enum([
  "LOADING",
  "UNLOADING",
  "REBAGGING",
  "REPROSES",
  "OVERSTAPEL",
]);
export type TagihanType = z.infer<typeof TagihanTypeEnum>;

export const MasterTagihanStatusSchema = z.object({
  name: z.string().min(2, "Nama status minimal 2 karakter").max(100),
  description: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
});
export type MasterTagihanStatusInput = z.infer<typeof MasterTagihanStatusSchema>;

export const CreateMasterTagihanStatusSchema = MasterTagihanStatusSchema;
export type CreateMasterTagihanStatusInput = z.infer<
  typeof CreateMasterTagihanStatusSchema
>;

export const UpdateMasterTagihanStatusSchema = MasterTagihanStatusSchema.partial();
export type UpdateMasterTagihanStatusInput = z.infer<
  typeof UpdateMasterTagihanStatusSchema
>;

export const TagihanManualDocumentInputSchema = z.object({
  uuid: z.string().optional(),
  documentNumber: z.string().min(1, "Nomor dokumen manual wajib diisi"),
  description: z.string().optional().nullable(),
});
export type TagihanManualDocumentInput = z.infer<
  typeof TagihanManualDocumentInputSchema
>;

export const TagihanSummaryItemInputSchema = z.object({
  documentType: z.string().min(1, "Tipe dokumen wajib diisi"), // IN, OUT, INT
  uom: z.string().min(1, "Satuan / UOM wajib diisi"),
  quantity: z.number().nonnegative("Kuantitas tidak boleh negatif").optional().default(0),
  costPerUnit: z.number().nonnegative("Tarif per unit tidak boleh negatif").default(0),
  subtotal: z.number().nonnegative("Subtotal tidak boleh negatif").optional().default(0),
});
export type TagihanSummaryItemInput = z.infer<
  typeof TagihanSummaryItemInputSchema
>;

export const CreateTagihanSchema = z.object({
  documentNumber: z.string().min(1, "Nomor Dokumen / SDI wajib diisi"),
  type: TagihanTypeEnum,
  statusUuid: z.string().optional().nullable(),
  tagihanDate: z.string().optional(),
  notes: z.string().optional().nullable(),
  erpDocumentUuids: z.array(z.string()).optional().default([]),
  nonCommodityDocumentUuids: z.array(z.string()).optional().default([]),
  manualDocuments: z
    .array(TagihanManualDocumentInputSchema)
    .optional()
    .default([]),
  summaries: z.array(TagihanSummaryItemInputSchema).optional().default([]),
});
export type CreateTagihanInput = z.infer<typeof CreateTagihanSchema>;

export const UpdateTagihanSchema = z.object({
  documentNumber: z.string().min(1, "Nomor Dokumen / SDI wajib diisi").optional(),
  type: TagihanTypeEnum.optional(),
  statusUuid: z.string().optional().nullable(),
  tagihanDate: z.string().optional(),
  notes: z.string().optional().nullable(),
  erpDocumentUuids: z.array(z.string()).optional(),
  nonCommodityDocumentUuids: z.array(z.string()).optional(),
  manualDocuments: z.array(TagihanManualDocumentInputSchema).optional(),
  summaries: z.array(TagihanSummaryItemInputSchema).optional(),
});
export type UpdateTagihanInput = z.infer<typeof UpdateTagihanSchema>;

export const TagihanQuerySchema = z.object({
  search: z.string().optional(),
  page: z.string().or(z.number()).optional(),
  limit: z.string().or(z.number()).optional(),
  type: z.string().optional(),
  statusUuid: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  documentNumber: z.string().optional(),
  relatedDocumentNumber: z.string().optional(),
  productName: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});
export type TagihanQueryInput = z.infer<typeof TagihanQuerySchema>;

export const TagihanReportTypeEnum = z.enum([
  "COMMODITY_RECAP_EXCEL",
  "COMMODITY_RECAP_PDF",
  "ODOO_REPORT_PDF",
]);
export type TagihanReportType = z.infer<typeof TagihanReportTypeEnum>;

export const GenerateTagihanReportInputSchema = z.object({
  reportType: TagihanReportTypeEnum,
});
export type GenerateTagihanReportInput = z.infer<
  typeof GenerateTagihanReportInputSchema
>;

export const TagihanReportJobStatusEnum = z.enum([
  "IDLE",
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);
export type TagihanReportJobStatus = z.infer<typeof TagihanReportJobStatusEnum>;

export const TagihanReportStageEnum = z.enum([
  "PREPARING",
  "DOWNLOADING",
  "OPTIMIZING",
  "MERGING",
  "SAVING",
  "COMPLETED",
  "FAILED",
]);
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

export function validateTagihanTypeRules(
  type: TagihanType,
  documents: ErpDocumentCandidate[],
): { isValid: boolean; error?: string } {
  if (!documents || documents.length === 0) {
    return { isValid: true };
  }

  // 1. Loading: OUT only, same month (Multiple SKUs permitted)
  if (type === "LOADING") {
    for (const doc of documents) {
      if (doc.pickingTypeCode !== "outgoing") {
        return {
          isValid: false,
          error: `Dokumen ${doc.documentNumber} bertipe ${doc.pickingTypeCode.toUpperCase()}, bukan OUT (outgoing). Tipe Loading hanya mengizinkan dokumen OUT.`,
        };
      }
    }

    // Check same month
    const getMonthYear = (d?: string | Date | null) => {
      if (!d) return null;
      const date = d instanceof Date ? d : new Date(String(d));
      if (isNaN(date.getTime())) return null;
      const m = date.getMonth() + 1;
      return `${date.getFullYear()}-${m < 10 ? "0" + m : m}`;
    };

    const firstMonth = getMonthYear(
      documents[0]?.scheduledDate || documents[0]?.dateDone,
    );
    if (firstMonth) {
      for (const doc of documents) {
        const docMonth = getMonthYear(doc.scheduledDate || doc.dateDone);
        if (docMonth && docMonth !== firstMonth) {
          return {
            isValid: false,
            error: `Dokumen ${doc.documentNumber} berada di bulan ${docMonth}, berbeda dari bulan dokumen pertama (${firstMonth}). Tipe Loading harus dalam bulan yang sama.`,
          };
        }
      }
    }
  }

  // 2. Unloading: IN only, same month (Multiple SKUs permitted)
  if (type === "UNLOADING") {
    for (const doc of documents) {
      if (doc.pickingTypeCode !== "incoming") {
        return {
          isValid: false,
          error: `Dokumen ${doc.documentNumber} bertipe ${doc.pickingTypeCode.toUpperCase()}, bukan IN (incoming). Tipe Unloading hanya mengizinkan dokumen IN.`,
        };
      }
    }

    // Check same month
    const getMonthYear = (d?: string | Date | null) => {
      if (!d) return null;
      const date = d instanceof Date ? d : new Date(String(d));
      if (isNaN(date.getTime())) return null;
      const m = date.getMonth() + 1;
      return `${date.getFullYear()}-${m < 10 ? "0" + m : m}`;
    };

    const firstMonth = getMonthYear(
      documents[0]?.scheduledDate || documents[0]?.dateDone,
    );
    if (firstMonth) {
      for (const doc of documents) {
        const docMonth = getMonthYear(doc.scheduledDate || doc.dateDone);
        if (docMonth && docMonth !== firstMonth) {
          return {
            isValid: false,
            error: `Dokumen ${doc.documentNumber} berada di bulan ${docMonth}, berbeda dari bulan dokumen pertama (${firstMonth}). Tipe Unloading harus dalam bulan yang sama.`,
          };
        }
      }
    }
  }

  // 3. Rebagging: IN & OUT, same refFax
  if (type === "REBAGGING") {
    for (const doc of documents) {
      if (
        doc.pickingTypeCode !== "incoming" &&
        doc.pickingTypeCode !== "outgoing"
      ) {
        return {
          isValid: false,
          error: `Dokumen ${doc.documentNumber} bertipe ${doc.pickingTypeCode.toUpperCase()}. Tipe Rebagging hanya mengizinkan dokumen IN & OUT.`,
        };
      }
    }

    const firstRefFax = documents[0]?.refFax?.trim() || null;
    if (!firstRefFax) {
      return {
        isValid: false,
        error: `Dokumen ${documents[0]?.documentNumber} tidak memiliki Ref Fax. Tipe Rebagging mewajibkan dokumen dengan refFax yang sama.`,
      };
    }

    for (const doc of documents) {
      const docRefFax = doc.refFax?.trim() || null;
      if (!docRefFax || docRefFax.toLowerCase() !== firstRefFax.toLowerCase()) {
        return {
          isValid: false,
          error: `Dokumen ${doc.documentNumber} memiliki Ref Fax "${docRefFax || "KOSONG"}", berbeda dari "${firstRefFax}". Tipe Rebagging mewajibkan refFax yang sama.`,
        };
      }
    }
  }

  // 4. Reproses: IN & OUT, same refFax
  if (type === "REPROSES") {
    for (const doc of documents) {
      if (
        doc.pickingTypeCode !== "incoming" &&
        doc.pickingTypeCode !== "outgoing"
      ) {
        return {
          isValid: false,
          error: `Dokumen ${doc.documentNumber} bertipe ${doc.pickingTypeCode.toUpperCase()}. Tipe Reproses hanya mengizinkan dokumen IN & OUT.`,
        };
      }
    }

    const firstRefFax = documents[0]?.refFax?.trim() || null;
    if (!firstRefFax) {
      return {
        isValid: false,
        error: `Dokumen ${documents[0]?.documentNumber} tidak memiliki Ref Fax. Tipe Reproses mewajibkan dokumen dengan refFax yang sama.`,
      };
    }

    for (const doc of documents) {
      const docRefFax = doc.refFax?.trim() || null;
      if (!docRefFax || docRefFax.toLowerCase() !== firstRefFax.toLowerCase()) {
        return {
          isValid: false,
          error: `Dokumen ${doc.documentNumber} memiliki Ref Fax "${docRefFax || "KOSONG"}", berbeda dari "${firstRefFax}". Tipe Reproses mewajibkan refFax yang sama.`,
        };
      }
    }
  }

  // 5. Overstapel: INT / internal only
  if (type === "OVERSTAPEL") {
    for (const doc of documents) {
      if (doc.pickingTypeCode !== "internal") {
        return {
          isValid: false,
          error: `Dokumen ${doc.documentNumber} bertipe ${doc.pickingTypeCode.toUpperCase()}, bukan INT (internal). Tipe Overstapel hanya mengizinkan dokumen INT.`,
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
export function getSecondaryQty(qty: number, uom?: string | null): number {
  if (!uom) return qty;
  const match = uom.match(/(\d+(?:\.\d+)?)/);
  const multiplier = match ? parseFloat(match[0]) : 1;
  return qty * multiplier;
}

export function getSecondaryUnit(uom?: string | null): string {
  if (!uom) return "Kg";
  const uomLower = uom.toLowerCase();
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

export function formatSecondaryQty(qty: number, uom?: string | null): string {
  const secondaryQty = getSecondaryQty(qty, uom);
  const unit = getSecondaryUnit(uom);
  return `${secondaryQty.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} ${unit}`;
}

// Buruh (Labor) Master Schemas
// Multipart form fields arrive as strings, so "false" must not coerce to true.
const FormBooleanSchema = z.preprocess(
  (v) => (typeof v === "string" ? v === "true" : v),
  z.boolean(),
);

export const CreateBuruhSchema = z.object({
  name: z.string().trim().min(2, "Nama buruh minimal 2 karakter").max(150),
  nik: z
    .string()
    .trim()
    .regex(/^\d{16}$/, "NIK harus 16 digit angka")
    .optional()
    .nullable()
    .or(z.literal("")),
  isActive: FormBooleanSchema.optional().default(true),
  // Only one mandor per warehouse; setting this replaces the current mandor
  isMandor: FormBooleanSchema.optional().default(false),
});
export type CreateBuruhInput = z.infer<typeof CreateBuruhSchema>;

export const UpdateBuruhSchema = CreateBuruhSchema.partial().extend({
  removeKtpPhoto: FormBooleanSchema.optional(),
});
export type UpdateBuruhInput = z.infer<typeof UpdateBuruhSchema>;

export const BuruhQuerySchema = z.object({
  search: z.string().optional(),
  page: z.string().or(z.number()).optional(),
  limit: z.string().or(z.number()).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  isMandor: z.enum(["true", "false"]).optional(),
});
export type BuruhQueryInput = z.infer<typeof BuruhQuerySchema>;

// Moves a buruh one position in the warehouse order used by tanda terima
export const MoveBuruhSchema = z.object({
  direction: z.enum(["up", "down"]),
});
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

import { z } from "zod";

const DateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

/** Pest-control treatment of an SPK Perawatan, from Odoo type_spraying / type_fumigasi / type_fogging */
export const SpkTreatmentTypeEnum = z.enum(["SPRAYING", "FUMIGASI", "FOGGING"]);
export type SpkTreatmentType = z.infer<typeof SpkTreatmentTypeEnum>;

export const SpkPerawatanQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  treatmentType: SpkTreatmentTypeEnum.optional(),
  dateFrom: DateString.optional(),
  dateTo: DateString.optional(),
});
export type SpkPerawatanQueryInput = z.infer<typeof SpkPerawatanQuerySchema>;

/** Export takes the same filters as the list, without paging */
export const SpkPerawatanExportQuerySchema = SpkPerawatanQuerySchema.omit({
  page: true,
  limit: true,
});
export type SpkPerawatanExportQueryInput = z.infer<
  typeof SpkPerawatanExportQuerySchema
>;

/** A kartu tumpukan (stack) holding the same product + lot as an SPK line */
export interface SpkRelatedStack {
  locationName: string;
  quantity: number;
  uom: string;
}

export interface SpkPerawatanLineItem {
  productName: string;
  lotName: string | null;
  jumlahStock: number | null;
  relatedStacks: SpkRelatedStack[];
}

export interface SpkPerawatanItem {
  uuid: string;
  name: string;
  state: string | null;
  date: string | null;
  weeklyName: string | null;
  locationName: string | null;
  namaSuratPemohon: string | null;
  jabatanPihakPertama: string | null;
  treatmentTypes: SpkTreatmentType[];
  typeSpraying: string | null;
  typeFumigasi: string | null;
  typeFogging: string | null;
  syncedAt: string;
  lines: SpkPerawatanLineItem[];
}

export interface SpkPerawatanListResponse {
  data: SpkPerawatanItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  lastSyncedAt: string | null;
}

export interface SpkPerawatanSyncResult {
  message: string;
  total: number;
  lines: number;
  removed: number;
}

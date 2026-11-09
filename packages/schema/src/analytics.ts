import { z } from "zod";

const DateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

/** Unit group of a product, from its UoM (Pack 5 KG → Kg, Pack 1 L → L) */
export const AnalyticsUnitEnum = z.enum(["Kg", "L", "OTHER"]);
export type AnalyticsUnit = z.infer<typeof AnalyticsUnitEnum>;

export const AnalyticsAccountEnum = z.enum(["PSO", "Komersil"]);
export type AnalyticsAccount = z.infer<typeof AnalyticsAccountEnum>;

export const FlowGranularityEnum = z.enum(["day", "week", "month"]);
export type FlowGranularity = z.infer<typeof FlowGranularityEnum>;

export const StockOriginCategoryEnum = z.enum([
  "Pengadaan",
  "Pengolahan",
  "Antar gudang",
  "Lainnya",
  "Tidak tercatat",
]);
export type StockOriginCategory = z.infer<typeof StockOriginCategoryEnum>;

/**
 * A unit group found in the data. Kg products are shown in Ton, L products in KL;
 * anything else (Lembar, Unit) keeps its own UoM.
 */
export interface AnalyticsUnitGroup {
  /** Stable key: "Kg", "L" or the UoM itself (e.g. "Lembar") */
  key: string;
  /** "Berat", "Volume" or the UoM */
  label: string;
  /** Base unit of the data: Kg, L or the UoM */
  baseUnit: string;
  /** Unit the values are expressed in: Ton, KL or the UoM */
  displayUnit: string;
}

// ----- Flow trend (incoming vs outgoing, grouped per unit) -----

export const FlowTrendQuerySchema = z
  .object({
    startDate: DateString,
    endDate: DateString,
    granularity: FlowGranularityEnum.default("month"),
    category: z.string().trim().min(1).optional(),
    account: AnalyticsAccountEnum.optional(),
    /** Inventory uuid to show a single SKU */
    productUuid: z.string().uuid().optional(),
  })
  .refine((q) => q.startDate <= q.endDate, {
    message: "Tanggal mulai tidak boleh setelah tanggal akhir",
    path: ["startDate"],
  });
export type FlowTrendQueryInput = z.infer<typeof FlowTrendQuerySchema>;

export interface FlowInOut {
  in: number;
  out: number;
}

export interface FlowTrendPoint extends FlowInOut {
  /** Start of the period, YYYY-MM-DD in the warehouse timezone */
  period: string;
}

export interface FlowSkuPoint extends FlowInOut {
  period: string;
  productUuid: string;
}

export interface FlowTrendSku {
  productUuid: string;
  sku: string;
  name: string;
}

export interface FlowTrendGroup extends AnalyticsUnitGroup {
  points: FlowTrendPoint[];
  totals: FlowInOut;
  /** Calendar month to date vs the full previous month, same filters */
  thisMonth: FlowInOut;
  lastMonth: FlowInOut;
  skus: FlowTrendSku[];
  /** Per SKU per period, only non-zero rows */
  skuPoints: FlowSkuPoint[];
}

export interface FlowTrendResponse {
  granularity: FlowGranularity;
  groups: FlowTrendGroup[];
  /** Commodity categories available for the category filter */
  categories: string[];
  /** Programs (SPHP, BANTUAN PANGAN) found in product names, also usable as category filter */
  programs: string[];
  /** SKUs with movement in the range (ignores the SKU filter) */
  skuOptions: (FlowTrendSku & { category: string; programs: string[] })[];
}

// ----- Stock inbound grouping: product → sender → stack → lot -----

export interface InboundDocument {
  documentUuid: string;
  documentNumber: string;
  dateDone: string | null;
}

export interface InboundLot {
  lotName: string | null;
  /** Share of the stack quantity attributed to this sender, in the product UoM */
  qty: number;
  /** Same share in the product's display unit */
  displayQty: number;
  documents: InboundDocument[];
}

export interface InboundStack {
  locationUuid: string;
  locationName: string;
  displayQty: number;
  lots: InboundLot[];
}

export interface InboundSender {
  /** Partner name without its numeric code; "Tidak tercatat" when no document matched */
  name: string;
  originCategory: StockOriginCategory;
  displayQty: number;
  stacks: InboundStack[];
}

export interface InboundProduct {
  productUuid: string;
  sku: string;
  name: string;
  /** Commodity category, e.g. BERAS */
  category: string;
  uom: string;
  unit: AnalyticsUnitGroup;
  /** Stock in the product UoM */
  qty: number;
  /** Stock in the unit group's display unit (Ton, KL or the UoM) */
  displayQty: number;
  stackCount: number;
  senders: InboundSender[];
}

export interface StockInboundResponse {
  /** Current stock per unit group */
  totals: (AnalyticsUnitGroup & { displayQty: number })[];
  stackCount: number;
  productCount: number;
  products: InboundProduct[];
}

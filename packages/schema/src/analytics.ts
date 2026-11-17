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
 * A unit group found in the data. Kg products are shown in Ton (Kg in the stock inbound tree), L products in KL;
 * anything else (Lembar, Unit) keeps its own UoM.
 */
export interface AnalyticsUnitGroup {
  /** Stable key: "Kg", "L" or the UoM itself (e.g. "Lembar") */
  key: string;
  /** "Berat", "Volume" or the UoM */
  label: string;
  /** Base unit of the data: Kg, L or the UoM */
  baseUnit: string;
  /** Unit the values are expressed in: Ton, Kg, KL or the UoM */
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

// ----- Stock inbound grouping: product → folder → sender → stack → lot -----

export interface InboundDocument {
  documentUuid: string;
  documentNumber: string;
  dateDone: string | null;
}

/**
 * Gate line not yet administered: its ERP document is missing or not done, so the goods
 * moved physically but are not in the ERP stock yet
 */
export interface InboundPendingGate {
  gateOperationUuid: string;
  opNumber: string;
  cardType: "IN" | "OUT";
  /** When the gate operation was recorded */
  date: string;
}

export interface InboundLot {
  lotName: string | null;
  /**
   * Share of the stack quantity attributed to this sender, in the product UoM; negative
   * for a pending outgoing gate line
   */
  qty: number;
  /** Same share in the product's display unit */
  displayQty: number;
  documents: InboundDocument[];
  /** Set when the row is a gate line not yet administered instead of ERP stock */
  pendingGate: InboundPendingGate | null;
}

export interface InboundStack {
  locationUuid: string;
  locationName: string;
  displayQty: number;
  lots: InboundLot[];
}

/** Manual folder inside a product, made by dragging senders or lots into it */
export interface InboundFolder {
  uuid: string;
  name: string;
}

export interface InboundGroupSummary {
  /** Stock in the product's display unit */
  displayQty: number;
  /** Share of the product stock, 0–100 */
  sharePct: number;
  senderCount: number;
  stackCount: number;
  lotCount: number;
  /** Latest done date of the incoming documents of its lots */
  lastReceivedAt: string | null;
  /** Part of displayQty from gate lines not yet administered, and how many gates */
  pendingDisplayQty: number;
  pendingGateCount: number;
}

export interface InboundGroup {
  /** null for the senders and lots not in any folder */
  folder: InboundFolder | null;
  summary: InboundGroupSummary;
  senders: InboundSender[];
}

const FolderName = z
  .string()
  .trim()
  .min(1, "Nama folder wajib diisi")
  .max(60, "Nama folder maksimal 60 karakter");

export const CreateStockFolderSchema = z.object({
  productUuid: z.string().uuid("Produk tidak valid"),
  name: FolderName,
});
export type CreateStockFolderInput = z.infer<typeof CreateStockFolderSchema>;

export const RenameStockFolderSchema = z.object({ name: FolderName });
export type RenameStockFolderInput = z.infer<typeof RenameStockFolderSchema>;

/** Moves a whole sender (lotName null) or one of its lots into a folder, or out (folderUuid null) */
export const MoveStockFolderItemSchema = z.object({
  productUuid: z.string().uuid("Produk tidak valid"),
  senderName: z.string().trim().min(1, "Pengirim wajib diisi").max(200),
  lotName: z.string().trim().min(1).max(200).nullable().default(null),
  folderUuid: z.string().uuid("Folder tidak valid").nullable(),
});
export type MoveStockFolderItemInput = z.infer<typeof MoveStockFolderItemSchema>;

export interface InboundSender {
  /** Partner name without its numeric code; "Tidak tercatat" when no document matched */
  name: string;
  originCategory: StockOriginCategory;
  displayQty: number;
  /** Part of displayQty from gate lines not yet administered, and how many gates */
  pendingDisplayQty: number;
  pendingGateCount: number;
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
  /** Physical stock in the product UoM */
  qty: number;
  /** Physical stock (ERP + not yet administered) in the unit group's display unit */
  displayQty: number;
  /** Part of qty / displayQty from gate lines not yet administered (IN − OUT) */
  pendingQty: number;
  pendingDisplayQty: number;
  stackCount: number;
  senderCount: number;
  /** Manual folders in their order, then the senders not in any folder (folder null) */
  groups: InboundGroup[];
}

export interface StockInboundResponse {
  /** Current physical stock per unit group, with the part not yet administered */
  totals: (AnalyticsUnitGroup & { displayQty: number; pendingDisplayQty: number })[];
  stackCount: number;
  productCount: number;
  products: InboundProduct[];
}

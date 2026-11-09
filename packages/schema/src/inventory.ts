/** Secondary unit of a product: weight in Kg or volume in L */
export type SecondaryUnit = "Kg" | "L";

export interface InventoryListItem {
  uuid: string;
  sku: string;
  name: string;
  uom: string;
  totalQuantity: number;
  totalAvailable: number;
  locationCount: number;
  /** Commodity category (first word of the name), e.g. BERAS */
  category: string;
  /** Total in Kg or L; null when the UoM is neither weight nor volume (Lembar, Unit) */
  secondaryQuantity: number | null;
  secondaryUnit: SecondaryUnit | null;
}

export interface InventorySecondaryTotal {
  unit: SecondaryUnit;
  /** Total in Kg or L */
  quantity: number;
}

/** Stock of one commodity in the whole warehouse, for the group header rows */
export interface InventoryCommoditySummary {
  category: string;
  productCount: number;
  locationCount: number;
  /** Kg or L when every product of the commodity has one; otherwise the shared UoM, or null when mixed */
  unit: string | null;
  /** Total in `unit` (Kg, L or the UoM); null when the units are mixed */
  quantity: number | null;
  /** Available stock in the same unit; null when the units are mixed */
  available: number | null;
}

export interface InventoryListSummary {
  totalProducts: number;
  totalLocations: number;
  totalQuantity: number;
  totalReserved: number;
  totalAvailable: number;
  /** Stock per secondary unit (Kg first, then L) for the whole warehouse */
  secondaryTotals: InventorySecondaryTotal[];
  /** Per commodity for the whole warehouse, ignoring search and category filters */
  commodities: InventoryCommoditySummary[];
  /** Programs (SPHP, BANTUAN PANGAN) found in the stocked products, for the category filter */
  programs: string[];
}

export interface InventoryListResponse {
  data: InventoryListItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  summary: InventoryListSummary;
}

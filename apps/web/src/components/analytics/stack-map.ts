import type {
  AnalyticsUnitGroup,
  InboundDocument,
  InboundPendingGate,
  InboundProduct,
  StackMapLabel,
} from "@bulog-wms/schema";
import { formatGroupValue, formatQty } from "@/components/analytics/format";

/** One lot of a product in a stack, with the sender it came from */
export interface StackMapLot {
  lotName: string | null;
  senderName: string;
  qty: number;
  displayQty: number;
  documents: InboundDocument[];
  pendingGate: InboundPendingGate | null;
}

export interface StackMapProduct {
  productUuid: string;
  sku: string;
  name: string;
  uom: string;
  unit: AnalyticsUnitGroup;
  qty: number;
  displayQty: number;
  /** Sacks (qty of a "Pack 50 KG" / "Sak" UoM), 0 for other UoMs */
  sacks: number;
  lots: StackMapLot[];
}

export interface StackMapStack {
  locationUuid: string;
  /** Full ERP name, "GBB 01/C03.1.1" */
  locationName: string;
  area: string;
  /** Part after the area, "C03.1.1" */
  code: string;
  /** Row letter(s), "C"; empty when the code does not follow the pattern */
  row: string;
  /** Number after the row, 3 for "C03.1.1"; null when the code does not follow the pattern */
  number: number | null;
  products: StackMapProduct[];
  /** Total per unit group, main unit first */
  totals: (AnalyticsUnitGroup & { displayQty: number })[];
  /** Total sacks of the products packed in sacks */
  sacks: number;
  label: StackMapLabel | null;
}

export interface StackMapCell {
  row: string;
  number: number;
  stacks: StackMapStack[];
}

export interface StackMapAreaLayout {
  area: string;
  descending: boolean;
  /** Row letters in display order, left to right */
  rows: string[];
  /** Per row letter, the most stacks sharing one number (B03.1.1 + B03.1.2 → 2), laid side by side */
  rowWidths: number[];
  /** Numbers top to bottom (1 → max), each with one cell per row */
  lines: { number: number; cells: StackMapCell[] }[];
  /** Stacks whose code does not follow the row + number pattern */
  others: StackMapStack[];
  stackCount: number;
  sacks: number;
  totals: (AnalyticsUnitGroup & { displayQty: number })[];
}

/**
 * Row order the warehouse uses when nothing was saved yet: GBB 01 and GKP are laid
 * out C-B-A, the other areas A-B-C
 */
const DEFAULT_DESCENDING = new Set(["GBB 01", "GKP"]);

export const isAreaDescending = (area: string, saved: Map<string, boolean>) =>
  saved.get(area) ?? DEFAULT_DESCENDING.has(area);

/** "GBB 01/C03.1.1" → area "GBB 01", code "C03.1.1", row "C", number 3 */
export function parseStackLocation(locationName: string) {
  const slash = locationName.indexOf("/");
  const area = (slash >= 0 ? locationName.slice(0, slash) : "Lainnya").trim();
  const code = (slash >= 0 ? locationName.slice(slash + 1) : locationName).trim();
  const match = /^([A-Za-z]+)\s*(\d+)/.exec(code);
  return {
    area,
    code,
    row: match ? match[1].toUpperCase() : "",
    number: match ? Number(match[2]) : null,
  };
}

/** UoMs counted in sacks: the ERP keeps "Pack 50 KG" stock as the number of sacks */
export const isSackUom = (uom: string) => /^(pack|sak|karung|zak)\b/i.test(uom.trim());

/** "840 sak | 42.000 Kg", the sacks left out when there are none */
export function formatStackTotals(totals: (AnalyticsUnitGroup & { displayQty: number })[], sacks: number) {
  const qty = totals.length === 0 ? "0" : totals.map((t) => formatGroupValue(t.displayQty, t)).join(" + ");
  return sacks > 0 ? `${formatQty(sacks)} sak | ${qty}` : qty;
}

/** Numbers shown per row even when the last ones are empty (01-04) */
const MIN_NUMBERS = 4;

/** "3" → "03" */
export const formatStackNumber = (n: number) => String(n).padStart(2, "0");

const addTotal = (
  totals: (AnalyticsUnitGroup & { displayQty: number })[],
  unit: AnalyticsUnitGroup,
  displayQty: number,
) => {
  const total = totals.find((t) => t.key === unit.key);
  if (total) total.displayQty += displayQty;
  else totals.push({ ...unit, displayQty });
};

/** Weight first, then volume, then the rest */
const UNIT_ORDER = ["Kg", "L"];
const sortTotals = <T extends AnalyticsUnitGroup>(totals: T[]) =>
  totals.sort((a, b) => {
    const ia = UNIT_ORDER.indexOf(a.key);
    const ib = UNIT_ORDER.indexOf(b.key);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

/**
 * Regroups the stock inbound tree (product → folder → sender → stack → lot) by stack,
 * so the map shows the same quantities as the grouping tab
 */
export function buildStackMapStacks(products: InboundProduct[], labels: StackMapLabel[]): StackMapStack[] {
  const labelByLocation = new Map(labels.map((l) => [l.locationUuid, l]));
  const stacks = new Map<string, StackMapStack>();

  for (const p of products) {
    for (const group of p.groups) {
      for (const sender of group.senders) {
        for (const st of sender.stacks) {
          let stack = stacks.get(st.locationUuid);
          if (!stack) {
            stack = {
              locationUuid: st.locationUuid,
              locationName: st.locationName,
              ...parseStackLocation(st.locationName),
              products: [],
              totals: [],
              sacks: 0,
              label: labelByLocation.get(st.locationUuid) ?? null,
            };
            stacks.set(st.locationUuid, stack);
          }
          let product = stack.products.find((x) => x.productUuid === p.productUuid);
          if (!product) {
            product = {
              productUuid: p.productUuid,
              sku: p.sku,
              name: p.name,
              uom: p.uom,
              unit: p.unit,
              qty: 0,
              displayQty: 0,
              sacks: 0,
              lots: [],
            };
            stack.products.push(product);
          }
          for (const lot of st.lots) {
            product.qty += lot.qty;
            product.displayQty += lot.displayQty;
            if (isSackUom(p.uom)) product.sacks += lot.qty;
            // A sender can be split over folders; merge its lots back per stack
            const same = product.lots.find(
              (l) =>
                l.lotName === lot.lotName &&
                l.senderName === sender.name &&
                l.pendingGate?.gateOperationUuid === lot.pendingGate?.gateOperationUuid,
            );
            if (same) {
              same.qty += lot.qty;
              same.displayQty += lot.displayQty;
            } else {
              product.lots.push({
                lotName: lot.lotName,
                senderName: sender.name,
                qty: lot.qty,
                displayQty: lot.displayQty,
                documents: lot.documents,
                pendingGate: lot.pendingGate,
              });
            }
          }
        }
      }
    }
  }

  for (const stack of stacks.values()) {
    stack.products.sort((a, b) => b.displayQty - a.displayQty);
    for (const p of stack.products) {
      p.lots.sort((a, b) => b.displayQty - a.displayQty);
      addTotal(stack.totals, p.unit, p.displayQty);
      stack.sacks += p.sacks;
    }
    sortTotals(stack.totals);
  }
  return Array.from(stacks.values());
}

/** Lays the stacks of each area out as rows (left to right) × numbers (top to bottom) */
export function buildStackMapAreas(stacks: StackMapStack[], savedOrder: Map<string, boolean>): StackMapAreaLayout[] {
  const byArea = new Map<string, StackMapStack[]>();
  for (const s of stacks) {
    const list = byArea.get(s.area) ?? [];
    list.push(s);
    byArea.set(s.area, list);
  }

  return Array.from(byArea.entries())
    .sort(([a], [b]) => Number(a === "Lainnya") - Number(b === "Lainnya") || a.localeCompare(b, "id", { numeric: true }))
    .map(([area, areaStacks]) => {
      const descending = isAreaDescending(area, savedOrder);
      const placed = areaStacks.filter((s) => s.row && s.number !== null);
      // Keep empty rows in between (A to the last letter) and at least numbers 01-04,
      // so the map keeps the shape of the warehouse floor
      const rows = Array.from(new Set(placed.map((s) => s.row)));
      const singleLetters = rows.filter((r) => r.length === 1).map((r) => r.charCodeAt(0));
      if (singleLetters.length > 0) {
        for (let c = "A".charCodeAt(0); c <= Math.max(...singleLetters); c++) {
          const letter = String.fromCharCode(c);
          if (!rows.includes(letter)) rows.push(letter);
        }
      }
      rows.sort((a, b) => (descending ? b.localeCompare(a) : a.localeCompare(b)));
      const maxNumber = placed.length > 0 ? Math.max(MIN_NUMBERS, ...placed.map((s) => s.number!)) : 0;
      const lines = Array.from({ length: maxNumber }, (_, i) => {
        const number = i + 1;
        return {
          number,
          cells: rows.map((row) => ({
            row,
            number,
            stacks: placed
              .filter((s) => s.row === row && s.number === number)
              .sort((a, b) => a.code.localeCompare(b.code, "id", { numeric: true })),
          })),
        };
      });
      const rowWidths = rows.map((_, i) => Math.max(1, ...lines.map((l) => l.cells[i].stacks.length)));
      const totals: StackMapAreaLayout["totals"] = [];
      for (const s of areaStacks) for (const t of s.totals) addTotal(totals, t, t.displayQty);
      return {
        area,
        descending,
        rows,
        rowWidths,
        lines,
        others: areaStacks
          .filter((s) => !s.row || s.number === null)
          .sort((a, b) => a.code.localeCompare(b.code, "id", { numeric: true })),
        stackCount: areaStacks.length,
        sacks: areaStacks.reduce((sum, s) => sum + s.sacks, 0),
        totals: sortTotals(totals),
      };
    });
}

/** Whether a stack matches the search: title, note, code, SKU, product, lot or sender */
export function stackMatches(stack: StackMapStack, q: string) {
  if (!q) return true;
  const has = (v: string | null | undefined) => !!v && v.toLowerCase().includes(q);
  return (
    has(stack.locationName) ||
    has(stack.label?.title) ||
    has(stack.label?.note) ||
    stack.products.some(
      (p) => has(p.sku) || has(p.name) || p.lots.some((l) => has(l.lotName) || has(l.senderName)),
    )
  );
}

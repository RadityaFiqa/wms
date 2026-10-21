import {
  roundQuantity,
  type StockOpnameCalculationRow,
  type StockOpnameStackMovement,
} from '@bulog-wms/schema';

/**
 * Detects whether a tumpukan (location) moved since the previous COMPLETED stock
 * opname, and builds the count to prefill when it did not.
 *
 * A tumpukan is counted once for all its SKUs, so the comparison is per location:
 * any recorded mutation, a SKU appearing/disappearing, or a changed ERP / reconciled
 * quantity of any SKU makes the whole tumpukan CHANGED.
 */

export interface MovementCurrentStack {
  inventoryId: number;
  productSku: string;
  productName: string;
  erpQty: number;
  calculatedPhysical: number | null;
}

export interface MovementPreviousStack extends MovementCurrentStack {
  actualQty: number | null;
  calculationRows: StockOpnameCalculationRow[] | null;
  note: string | null;
}

export interface StackPrefill {
  actualQty: number | null;
  calculationRows: StockOpnameCalculationRow[] | null;
  note: string | null;
}

export interface LocationMovementResult {
  status: StockOpnameStackMovement | null;
  reasons: string[];
  /** Prefill per inventoryId; null when nothing is prefilled */
  prefill: Map<number, StackPrefill> | null;
}

const MAX_LISTED_REFERENCES = 5;

const formatQty = (n: number) =>
  roundQuantity(n).toLocaleString('id-ID', { maximumFractionDigits: 3 });

const sameQty = (a: number | null, b: number | null) =>
  roundQuantity(a ?? 0) === roundQuantity(b ?? 0);

// Stacks with no ERP or reconciled stock are not part of the tumpukan
const hasStock = (s: MovementCurrentStack) =>
  roundQuantity(s.erpQty) !== 0 ||
  roundQuantity(s.calculatedPhysical ?? 0) !== 0;

const collator = new Intl.Collator('id-ID', { numeric: true });

export function classifyLocationMovement(params: {
  /** False when the warehouse has no COMPLETED opname to compare with */
  hasPreviousOpname: boolean;
  current: MovementCurrentStack[];
  /** All stacks of the same location in the previous opname */
  previous: MovementPreviousStack[];
  /** Documents / gate operations that moved stock in or out of the location since then */
  movementReferences: Iterable<string>;
}): LocationMovementResult {
  if (!params.hasPreviousOpname) {
    return { status: null, reasons: [], prefill: null };
  }

  const reasons: string[] = [];

  const references = Array.from(new Set(params.movementReferences));
  if (references.length > 0) {
    const listed = references.slice(0, MAX_LISTED_REFERENCES).join(', ');
    const more = references.length - MAX_LISTED_REFERENCES;
    reasons.push(
      `Ada mutasi sejak opname terakhir: ${listed}${more > 0 ? ` dan ${more} lainnya` : ''}`,
    );
  }

  const current = new Map(
    params.current.filter(hasStock).map((s) => [s.inventoryId, s]),
  );
  const previous = new Map(
    params.previous.filter(hasStock).map((s) => [s.inventoryId, s]),
  );

  if (current.size > 0 && previous.size === 0 && references.length === 0) {
    reasons.push('Tumpukan baru sejak opname terakhir');
  } else {
    for (const [inventoryId, cur] of current) {
      const prev = previous.get(inventoryId);
      if (!prev) {
        reasons.push(`${cur.productSku}: SKU baru di tumpukan`);
        continue;
      }
      if (!sameQty(prev.erpQty, cur.erpQty)) {
        reasons.push(
          `${cur.productSku}: stok ERP ${formatQty(prev.erpQty)} → ${formatQty(cur.erpQty)}`,
        );
      } else if (!sameQty(prev.calculatedPhysical, cur.calculatedPhysical)) {
        reasons.push(
          `${cur.productSku}: stok rekonsiliasi ${formatQty(prev.calculatedPhysical ?? 0)} → ${formatQty(cur.calculatedPhysical ?? 0)}`,
        );
      }
    }
    for (const [inventoryId, prev] of previous) {
      if (!current.has(inventoryId)) {
        reasons.push(`${prev.productSku}: tidak ada lagi di tumpukan`);
      }
    }
  }

  if (reasons.length > 0) {
    return { status: 'CHANGED', reasons, prefill: null };
  }

  return {
    status: 'UNCHANGED',
    reasons: [],
    prefill: buildPrefill(Array.from(current.values()), params.previous),
  };
}

/**
 * The previous count of the tumpukan (rows of every SKU, as the detail page merges
 * them) goes on its first SKU by name, the others get 0: the same layout the detail
 * page saves, so the summed variance stays count - total ERP of the tumpukan.
 */
function buildPrefill(
  current: MovementCurrentStack[],
  previous: MovementPreviousStack[],
): Map<number, StackPrefill> | null {
  const counted = previous.filter((s) => s.actualQty !== null);
  const notes = Array.from(
    new Set(
      previous.map((s) => s.note?.trim()).filter((n): n is string => !!n),
    ),
  );
  if ((counted.length === 0 && notes.length === 0) || current.length === 0) {
    return null;
  }

  const rows: StockOpnameCalculationRow[] = [];
  for (const s of counted) {
    if (s.calculationRows && s.calculationRows.length > 0) {
      rows.push(...s.calculationRows);
    } else if (s.actualQty !== 0) {
      // Legacy count without calculator rows
      rows.push({
        expression: String(s.actualQty),
        result: s.actualQty as number,
      });
    }
  }
  const actualQty = counted.length
    ? roundQuantity(counted.reduce((sum, s) => sum + (s.actualQty ?? 0), 0))
    : null;

  const ordered = [...current].sort((a, b) =>
    collator.compare(a.productName, b.productName),
  );
  const prefill = new Map<number, StackPrefill>();
  ordered.forEach((s, i) => {
    prefill.set(
      s.inventoryId,
      i === 0
        ? {
            actualQty,
            calculationRows: rows.length > 0 ? rows : null,
            note: notes.length > 0 ? notes.join('; ') : null,
          }
        : {
            actualQty: actualQty === null ? null : 0,
            calculationRows: null,
            note: null,
          },
    );
  });
  return prefill;
}

/** Order-insensitive to JSON key order (jsonb reorders keys). */
export function sameCalculationRows(
  a: StockOpnameCalculationRow[] | null,
  b: StockOpnameCalculationRow[] | null,
): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return (
    left.length === right.length &&
    left.every(
      (r, i) =>
        r.expression === right[i].expression &&
        roundQuantity(r.result) === roundQuantity(right[i].result),
    )
  );
}

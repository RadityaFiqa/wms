import type { AnalyticsUnit, AnalyticsUnitGroup } from '@bulog-wms/schema';

export type UomConversion = {
  unit: AnalyticsUnit;
  /** Base units (Kg or L) per 1 UoM; 0 for OTHER */
  factor: number;
};

const WEIGHT_FACTORS: Record<string, number> = {
  KG: 1,
  KGS: 1,
  KILO: 1,
  GR: 0.001,
  GRAM: 0.001,
  G: 0.001,
  TON: 1000,
};
const VOLUME_FACTORS: Record<string, number> = {
  L: 1,
  LT: 1,
  LTR: 1,
  LITER: 1,
  ML: 0.001,
};

/**
 * Converts a product UoM to its base unit: "Pack 5 KG" → 5 Kg, "Pack 350 GR" → 0.35 Kg,
 * "Pack 1 L" → 1 L, "Kg." → 1 Kg. Units that are neither weight nor volume (Lembar,
 * Unit) are OTHER and stay out of Ton/KL totals.
 */
export function parseUom(uom: string | null | undefined): UomConversion {
  const normalized = (uom || '').toUpperCase().replace(/\./g, ' ').trim();
  const match = normalized.match(/(\d+(?:[.,]\d+)?)?\s*([A-Z]+)\s*$/);
  if (!match) return { unit: 'OTHER', factor: 0 };

  const amount = match[1] ? parseFloat(match[1].replace(',', '.')) : 1;
  const symbol = match[2];
  if (symbol in WEIGHT_FACTORS) {
    return { unit: 'Kg', factor: amount * WEIGHT_FACTORS[symbol] };
  }
  if (symbol in VOLUME_FACTORS) {
    return { unit: 'L', factor: amount * VOLUME_FACTORS[symbol] };
  }
  return { unit: 'OTHER', factor: 0 };
}

/** Quantity in Ton (Kg products) or KL (L products); null for other units */
export function toDisplayQty(qty: number, uom: string | null | undefined) {
  const { unit, factor } = parseUom(uom);
  if (unit === 'OTHER') return null;
  return (qty * factor) / 1000;
}

const KG_GROUP: AnalyticsUnitGroup = {
  key: 'Kg',
  label: 'Berat',
  baseUnit: 'Kg',
  displayUnit: 'Ton',
};
const L_GROUP: AnalyticsUnitGroup = {
  key: 'L',
  label: 'Volume',
  baseUnit: 'L',
  displayUnit: 'KL',
};

/**
 * Unit group of a UoM and the factor to its display unit: Kg products in Ton, L products
 * in KL, anything else (Lembar, Unit) counted in its own UoM.
 */
export function getUnitGroup(uom: string | null | undefined): {
  group: AnalyticsUnitGroup;
  toDisplay: number;
} {
  const { unit, factor } = parseUom(uom);
  if (unit === 'Kg') return { group: KG_GROUP, toDisplay: factor / 1000 };
  if (unit === 'L') return { group: L_GROUP, toDisplay: factor / 1000 };
  const name = (uom || 'Unit').replace(/\.$/, '').trim() || 'Unit';
  return {
    group: { key: name, label: name, baseUnit: name, displayUnit: name },
    toDisplay: 1,
  };
}

/**
 * Secondary quantity of a stock line in Kg or L. Uses the ERP's secondary unit qty when
 * it is set, else converts from the UoM; null for units that are neither weight nor volume.
 */
export function getSecondaryQty(
  quantity: number,
  erpSecondaryQty: number | null | undefined,
  uom: string | null | undefined,
): { unit: 'Kg' | 'L'; qty: number } | null {
  const { unit, factor } = parseUom(uom);
  if (unit === 'OTHER') return null;
  const qty =
    erpSecondaryQty && erpSecondaryQty > 0
      ? erpSecondaryQty
      : quantity * factor;
  return { unit, qty };
}

/** Kg first, then L, then other units alphabetically */
export function compareUnitGroups(a: { key: string }, b: { key: string }) {
  const rank = (key: string) => (key === 'Kg' ? 0 : key === 'L' ? 1 : 2);
  return rank(a.key) - rank(b.key) || a.key.localeCompare(b.key);
}

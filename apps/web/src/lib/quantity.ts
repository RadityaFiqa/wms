/**
 * Calculates the secondary quantity (weight in Kg) based on product quantity and UoM.
 * Extracted numeric multiplier from UoM (e.g. "Pack 5 Kg" -> multiplier is 5).
 * If no numeric value exists inside the UoM, the multiplier defaults to 1.
 */
export function getSecondaryQty(qty: number, uom?: string): number {
  if (!uom) return qty;
  // Match the first sequence of digits potentially including a decimal point
  const match = uom.match(/(\d+(?:\.\d+)?)/);
  const multiplier = match ? parseFloat(match[0]) : 1;
  return qty * multiplier;
}

export function getSecondaryUnit(uom?: string): string {
  if (!uom) return "Kg";
  const uomLower = uom.toLowerCase();
  if (uomLower.includes("liter") || uomLower.includes("litre")) {
    return "Liter";
  }
  if (/\d+(?:\.\d+)?\s*(l|L)(?![a-zA-Z])/.test(uom)) {
    return "L";
  }
  return "Kg";
}

/**
 * Calculates and formats the secondary quantity to Indonesian locale string with appropriate unit.
 */
export function formatSecondaryQty(qty: number, uom?: string): string {
  const secondaryQty = getSecondaryQty(qty, uom);
  const unit = getSecondaryUnit(uom);
  return `${secondaryQty.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} ${unit}`;
}


/** Commodity category: first word of the product name without its [SKU] prefix */
export function getCommodityCategory(productName: string): string {
  const word = productName
    .replace(/^\s*\[[^\]]*\]\s*/, '')
    .trim()
    .split(/\s+/)[0];
  return (word || 'LAINNYA').toUpperCase();
}

/**
 * Distribution programs recognised in product names. They cut across commodities
 * (beras SPHP, kemasan logo Bantuan Pangan), so they filter on the name, not the first word.
 */
export const PRODUCT_PROGRAMS = ['SPHP', 'BANTUAN PANGAN'] as const;

/** Programs whose name appears as whole words in the product name */
export function getProductPrograms(productName: string): string[] {
  const name = ` ${productName.toUpperCase().replace(/\s+/g, ' ')} `;
  return PRODUCT_PROGRAMS.filter((program) => name.includes(` ${program} `));
}

export function isProductProgram(value: string) {
  return (PRODUCT_PROGRAMS as readonly string[]).includes(value.toUpperCase());
}

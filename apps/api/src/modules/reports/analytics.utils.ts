import type { StockOriginCategory } from '@bulog-wms/schema';

// UoM conversion lives in core so inventory and reports share one rule
export {
  compareUnitGroups,
  getUnitGroup,
  parseUom,
  toDisplayQty,
  type UomConversion,
} from '@/core/utils/uom';

/** "4755 - Manager Pengolahan Kalsel" → "Manager Pengolahan Kalsel" */
export function cleanPartnerName(name: string | null | undefined) {
  const cleaned = (name || '').replace(/^\s*\d+\s*-\s*/, '').trim();
  return cleaned || null;
}

// Commodity and program rules live in core so inventory and reports share them
export {
  getCommodityCategory,
  getProductPrograms,
  isProductProgram,
  PRODUCT_PROGRAMS,
} from '@/core/utils/product-category';

/** Where an incoming ERP document brought the goods from */
export function classifyOrigin(doc: {
  partnerName: string | null;
  purchaseName: string | null;
  origin: string | null;
  sourceLocationName: string | null;
}): StockOriginCategory {
  const partner = (doc.partnerName || '').toLowerCase();
  const source = (doc.sourceLocationName || '').toLowerCase();

  if (partner.includes('pengolahan')) return 'Pengolahan';
  if (
    source.includes('vendor') ||
    doc.purchaseName ||
    (doc.origin || '').toUpperCase().startsWith('PO/')
  ) {
    return 'Pengadaan';
  }
  if (source.includes('transit')) return 'Antar gudang';
  return 'Lainnya';
}

/** Rounds to 3 decimals so Ton/KL values stay readable in JSON */
export function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

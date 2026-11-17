import type {
  BanpangDocument,
  BanpangFolder,
  BanpangGroup,
  BanpangProductQty,
  BanpangRealizationResponse,
  BanpangRow,
  BanpangSummary,
} from '@bulog-wms/schema';
import { parseUom } from '@/core/utils/uom';
import { round3 } from '@/modules/reports/analytics.utils';

/** ERP partner name of Badan Pangan Nasional; the ERP has it under more than one partner id */
export const BANPANG_PARTNER_NAME = 'Badan Pangan Nasional';
export const NO_SALES_ORDER = 'Tanpa SO';
export const NO_DESTINATION = 'Tanpa kecamatan';
/** ERP states left out of the realization */
export const EXCLUDED_STATES = ['cancel', 'draft'];
export const DONE_STATE = 'done';

export interface BanpangDocumentRow {
  uuid: string;
  documentNumber: string;
  state: string;
  /** Origin of the picking, the sales order number */
  origin: string | null;
  /** ERP picking_ref from the raw payload, a kecamatan */
  pickingRef: string | null;
  /** Done date, or the scheduled date when not done yet */
  date: Date | null;
  /** Done quantity, or the demand when not done yet */
  items: {
    productUuid: string;
    sku: string;
    name: string;
    uom: string;
    qty: number;
  }[];
}

/** picking_ref is false in Odoo when empty; keeps trimmed text only */
export function normalizePickingRef(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

const kgOf = (qty: number, uom: string) => {
  const { unit, factor } = parseUom(uom);
  return unit === 'Kg' ? qty * factor : null;
};

/** Sums quantities per product, largest Kg first */
function mergeProducts(lists: BanpangProductQty[][]): BanpangProductQty[] {
  const byProduct = new Map<string, BanpangProductQty>();
  for (const list of lists) {
    for (const p of list) {
      const entry = byProduct.get(p.productUuid) || { ...p, qty: 0, kg: null };
      entry.qty += p.qty;
      if (p.kg !== null) entry.kg = (entry.kg ?? 0) + p.kg;
      byProduct.set(p.productUuid, entry);
    }
  }
  return Array.from(byProduct.values())
    .map((p) => ({
      ...p,
      qty: round3(p.qty),
      kg: p.kg === null ? null : round3(p.kg),
    }))
    .sort((a, b) => (b.kg ?? 0) - (a.kg ?? 0) || b.qty - a.qty);
}

function summarize(documents: BanpangDocument[]): BanpangSummary {
  const dates = documents
    .map((d) => d.date)
    .filter((d): d is string => Boolean(d))
    .sort();
  const pending = documents.filter((d) => d.state !== DONE_STATE);
  return {
    documentCount: documents.length,
    kg: round3(documents.reduce((sum, d) => sum + d.kg, 0)),
    pendingDocumentCount: pending.length,
    pendingKg: round3(pending.reduce((sum, d) => sum + d.kg, 0)),
    products: mergeProducts(documents.map((d) => d.products)),
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}

const byLatest = (a: BanpangSummary, b: BanpangSummary) =>
  (b.lastDate || '').localeCompare(a.lastDate || '');

export interface BanpangFolders {
  /** Folders in their order */
  folders: BanpangFolder[];
  /** placementKey(soNumber, destination) → folder uuid */
  placements: Map<string, string>;
}

/** Key of a kecamatan + sales order row in the folder placements */
export const placementKey = (soNumber: string, destination: string) =>
  `${soNumber}\u0000${destination}`;

const NO_FOLDERS: BanpangFolders = { folders: [], placements: new Map() };

const destinationsOf = (rows: BanpangRow[]) =>
  new Set(rows.map((r) => r.destination));
const salesOrdersOf = (rows: BanpangRow[]) =>
  new Set(rows.map((r) => r.soNumber));

/**
 * Splits rows over the manual folders, folders first in their order (kept when
 * empty so they stay drop targets), then the ungrouped rows.
 */
function groupByFolder(
  rows: BanpangRow[],
  { folders, placements }: BanpangFolders,
  totalKg: number,
): BanpangGroup[] {
  const known = new Set(folders.map((f) => f.uuid));
  const folderOf = (row: BanpangRow) => {
    const uuid = placements.get(placementKey(row.soNumber, row.destination));
    return uuid && known.has(uuid) ? uuid : null;
  };
  return [...folders, null].map((folder) => {
    const members = rows.filter((r) => folderOf(r) === (folder?.uuid ?? null));
    const summary = summarize(members.flatMap((r) => r.documents));
    return {
      folder,
      summary: {
        ...summary,
        rowCount: members.length,
        salesOrderCount: salesOrdersOf(members).size,
        destinationCount: destinationsOf(members).size,
        sharePct: totalKg > 0 ? round3((summary.kg / totalKg) * 100) : 0,
      },
      rows: members,
    };
  });
}

/**
 * Groups outgoing documents by kecamatan (picking_ref) + sales order (origin), each
 * row with its summary, and splits the rows over the manual folders. Rows are ordered
 * by their latest document, documents newest first.
 */
export function groupBanpangRealization(
  documentRows: BanpangDocumentRow[],
  folders: BanpangFolders = NO_FOLDERS,
): BanpangRealizationResponse {
  const byRow = new Map<
    string,
    { soNumber: string; destination: string; documents: BanpangDocument[] }
  >();

  for (const row of documentRows) {
    const products = mergeProducts([
      row.items.map((item) => ({
        productUuid: item.productUuid,
        sku: item.sku,
        name: item.name,
        uom: item.uom,
        qty: item.qty,
        kg: kgOf(item.qty, item.uom),
      })),
    ]);
    const document: BanpangDocument = {
      documentUuid: row.uuid,
      documentNumber: row.documentNumber,
      state: row.state,
      date: row.date ? row.date.toISOString() : null,
      kg: round3(products.reduce((sum, p) => sum + (p.kg ?? 0), 0)),
      products,
    };

    const soNumber = row.origin?.trim() || NO_SALES_ORDER;
    const destination = row.pickingRef || NO_DESTINATION;
    const key = placementKey(soNumber, destination);
    const entry = byRow.get(key) || { soNumber, destination, documents: [] };
    entry.documents.push(document);
    byRow.set(key, entry);
  }

  const rows: BanpangRow[] = Array.from(byRow.values())
    .map(({ soNumber, destination, documents }) => {
      const sorted = [...documents].sort((a, b) =>
        (b.date || '').localeCompare(a.date || ''),
      );
      return {
        destination,
        soNumber,
        summary: summarize(sorted),
        documents: sorted,
      };
    })
    .sort(
      (a, b) =>
        byLatest(a.summary, b.summary) ||
        a.destination.localeCompare(b.destination),
    );

  const totals = summarize(rows.flatMap((r) => r.documents));
  return {
    totals: {
      ...totals,
      salesOrderCount: salesOrdersOf(rows).size,
      destinationCount: destinationsOf(rows).size,
    },
    groups: groupByFolder(rows, folders, totals.kg),
  };
}

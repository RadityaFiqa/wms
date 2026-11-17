import type {
  BanpangDestination,
  BanpangDocument,
  BanpangFolder,
  BanpangGroup,
  BanpangProductQty,
  BanpangRealizationResponse,
  BanpangSalesOrder,
  BanpangSummary,
} from '@bulog-wms/schema';
import { parseUom } from '@/core/utils/uom';
import { round3 } from '@/modules/reports/analytics.utils';

/** ERP partner name of Badan Pangan Nasional; the ERP has it under more than one partner id */
export const BANPANG_PARTNER_NAME = 'Badan Pangan Nasional';
export const NO_SALES_ORDER = 'Tanpa SO';
export const NO_DESTINATION = 'Tanpa kecamatan';

export interface BanpangDocumentRow {
  uuid: string;
  documentNumber: string;
  /** Origin of the picking, the sales order number */
  origin: string | null;
  /** ERP picking_ref from the raw payload, a kecamatan */
  pickingRef: string | null;
  dateDone: Date | null;
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
    .map((d) => d.dateDone)
    .filter((d): d is string => Boolean(d))
    .sort();
  return {
    documentCount: documents.length,
    kg: round3(documents.reduce((sum, d) => sum + d.kg, 0)),
    products: mergeProducts(documents.map((d) => d.products)),
    firstDoneAt: dates[0] ?? null,
    lastDoneAt: dates[dates.length - 1] ?? null,
  };
}

const byLatest = (a: BanpangSummary, b: BanpangSummary) =>
  (b.lastDoneAt || '').localeCompare(a.lastDoneAt || '');

export interface BanpangFolders {
  /** Folders in their order */
  folders: BanpangFolder[];
  /** Sales order number → folder uuid */
  placements: Map<string, string>;
}

const NO_FOLDERS: BanpangFolders = { folders: [], placements: new Map() };

/**
 * Splits sales orders over the manual folders, folders first in their order (kept
 * when empty so they stay drop targets), then the ungrouped sales orders.
 */
function groupByFolder(
  salesOrders: BanpangSalesOrder[],
  { folders, placements }: BanpangFolders,
  totalKg: number,
): BanpangGroup[] {
  const known = new Set(folders.map((f) => f.uuid));
  const folderOf = (so: BanpangSalesOrder) => {
    const uuid = placements.get(so.soNumber);
    return uuid && known.has(uuid) ? uuid : null;
  };
  return [...folders, null].map((folder) => {
    const members = salesOrders.filter(
      (so) => folderOf(so) === (folder?.uuid ?? null),
    );
    const destinations = new Set(
      members.flatMap((so) => so.destinations.map((d) => d.name)),
    );
    const summary = summarize(
      members.flatMap((so) => so.destinations.flatMap((d) => d.documents)),
    );
    return {
      folder,
      summary: {
        ...summary,
        salesOrderCount: members.length,
        destinationCount: destinations.size,
        sharePct: totalKg > 0 ? round3((summary.kg / totalKg) * 100) : 0,
      },
      salesOrders: members,
    };
  });
}

/**
 * Groups done outgoing documents by sales order (origin), then by destination
 * (picking_ref), each level with its own summary, and splits the sales orders over
 * the manual folders. Sales orders are ordered by their latest realization,
 * destinations by Kg.
 */
export function groupBanpangRealization(
  rows: BanpangDocumentRow[],
  folders: BanpangFolders = NO_FOLDERS,
): BanpangRealizationResponse {
  const bySalesOrder = new Map<string, Map<string, BanpangDocument[]>>();

  for (const row of rows) {
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
      dateDone: row.dateDone ? row.dateDone.toISOString() : null,
      kg: round3(products.reduce((sum, p) => sum + (p.kg ?? 0), 0)),
      products,
    };

    const soNumber = row.origin?.trim() || NO_SALES_ORDER;
    const destinationName = row.pickingRef || NO_DESTINATION;
    const destinations = bySalesOrder.get(soNumber) || new Map();
    const documents = destinations.get(destinationName) || [];
    documents.push(document);
    destinations.set(destinationName, documents);
    bySalesOrder.set(soNumber, destinations);
  }

  const allDestinations = new Set<string>();
  const salesOrders: BanpangSalesOrder[] = Array.from(bySalesOrder.entries())
    .map(([soNumber, destinationMap]) => {
      const destinations: BanpangDestination[] = Array.from(
        destinationMap.entries(),
      )
        .map(([name, documents]) => {
          allDestinations.add(name);
          const sorted = [...documents].sort((a, b) =>
            (b.dateDone || '').localeCompare(a.dateDone || ''),
          );
          return { name, summary: summarize(sorted), documents: sorted };
        })
        .sort((a, b) => b.summary.kg - a.summary.kg);
      return {
        soNumber,
        summary: {
          ...summarize(destinations.flatMap((d) => d.documents)),
          destinationCount: destinations.length,
        },
        destinations,
      };
    })
    .sort((a, b) => byLatest(a.summary, b.summary));

  const totals = summarize(
    salesOrders.flatMap((so) => so.destinations.flatMap((d) => d.documents)),
  );
  return {
    totals: {
      ...totals,
      salesOrderCount: salesOrders.length,
      destinationCount: allDestinations.size,
    },
    groups: groupByFolder(salesOrders, folders, totals.kg),
  };
}

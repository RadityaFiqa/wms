"use client";

import Link from "next/link";
import { ChevronRight, ClipboardClock } from "lucide-react";
import type { AnalyticsUnitGroup, InboundPendingGate, InboundProduct } from "@bulog-wms/schema";
import { formatDateId, formatGroupValue, formatProductName, formatQty } from "@/components/analytics/format";

interface PendingRow {
  gate: InboundPendingGate;
  senders: Set<string>;
  stackName: string;
  qty: number;
  displayQty: number;
}

interface PendingProduct {
  product: InboundProduct;
  rows: PendingRow[];
  qty: number;
  displayQty: number;
}

/**
 * Gate lines not yet administered, per product. A pending OUT line split over several
 * senders in the tree is merged back into one row per gate and stack.
 */
function collectPending(products: InboundProduct[]): PendingProduct[] {
  const result: PendingProduct[] = [];
  for (const product of products) {
    const rows = new Map<string, PendingRow>();
    for (const group of product.groups) {
      for (const sender of group.senders) {
        for (const stack of sender.stacks) {
          for (const lot of stack.lots) {
            if (!lot.pendingGate) continue;
            const key = `${lot.pendingGate.gateOperationUuid}|${stack.locationUuid}|${lot.lotName ?? ""}`;
            const row = rows.get(key) || {
              gate: lot.pendingGate,
              senders: new Set<string>(),
              stackName: stack.locationName,
              qty: 0,
              displayQty: 0,
            };
            row.senders.add(sender.name);
            row.qty += lot.qty;
            row.displayQty += lot.displayQty;
            rows.set(key, row);
          }
        }
      }
    }
    if (rows.size === 0) continue;
    const list = Array.from(rows.values()).sort((a, b) => b.gate.date.localeCompare(a.gate.date));
    result.push({
      product,
      rows: list,
      qty: list.reduce((sum, r) => sum + r.qty, 0),
      displayQty: list.reduce((sum, r) => sum + r.displayQty, 0),
    });
  }
  return result;
}

/** Amber panel above the tree: what moved physically but is not in the ERP stock yet */
export default function PendingGateSummary({ products }: { products: InboundProduct[] }) {
  const pending = collectPending(products);
  if (pending.length === 0) return null;

  const gateCount = new Set(pending.flatMap((p) => p.rows.map((r) => r.gate.gateOperationUuid))).size;
  const totals = new Map<string, { unit: AnalyticsUnitGroup; displayQty: number }>();
  for (const p of pending) {
    const total = totals.get(p.product.unit.key) || { unit: p.product.unit, displayQty: 0 };
    total.displayQty += p.displayQty;
    totals.set(p.product.unit.key, total);
  }

  return (
    <details className="group/pending rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 shrink-0 text-amber-500 transition-transform group-open/pending:rotate-90" />
        <ClipboardClock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className="min-w-0">
          <div className="text-sm font-bold text-amber-800 dark:text-amber-200">Belum diadministrasikan</div>
          <div className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
            {gateCount} gate · {pending.length} produk · sudah ada di gudang, belum tercatat di stok ERP
          </div>
        </div>
        <span className="ml-auto shrink-0 pl-3 text-right text-sm font-bold tabular-nums text-amber-800 dark:text-amber-200">
          {Array.from(totals.values())
            .map((t) => formatGroupValue(t.displayQty, t.unit))
            .join(" + ")}
        </span>
      </summary>

      <div className="space-y-3 px-3 pb-3">
        {pending.map((p) => (
          <div key={p.product.productUuid}>
            <div className="flex items-baseline gap-2 border-b border-amber-200/70 pb-1 dark:border-amber-900/40">
              <span className="min-w-0 truncate text-xs font-bold text-slate-800 dark:text-slate-100" title={p.product.name}>
                {formatProductName(p.product.name)}
              </span>
              <span className="shrink-0 text-[11px] text-slate-400">{p.product.sku}</span>
              <span className="ml-auto shrink-0 text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {formatGroupValue(p.displayQty, p.product.unit)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-[11px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="py-1 pr-2">Gate</th>
                    <th className="py-1 px-2">Tanggal</th>
                    <th className="py-1 px-2">Pengirim</th>
                    <th className="py-1 px-2">Tumpukan</th>
                    <th className="py-1 pl-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 tabular-nums dark:divide-amber-900/30">
                  {p.rows.map((r, i) => (
                    <tr key={`${r.gate.gateOperationUuid}-${i}`}>
                      <td className="py-1 pr-2">
                        <Link
                          href={`/gate-operations/${r.gate.gateOperationUuid}`}
                          className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {r.gate.opNumber}
                        </Link>
                        {r.gate.cardType === "OUT" && (
                          <span className="ml-1.5 rounded border border-orange-200 px-1 text-[9px] font-bold text-orange-600 dark:border-orange-900/40 dark:text-orange-400">
                            KELUAR
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-slate-500">{formatDateId(r.gate.date)}</td>
                      <td className="py-1 px-2 text-slate-700 dark:text-slate-300">{Array.from(r.senders).join(", ")}</td>
                      <td className="py-1 px-2 text-slate-700 dark:text-slate-300">{r.stackName}</td>
                      <td className="py-1 pl-2 text-right">
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {formatQty(r.qty)} {p.product.uom}
                        </span>
                        <span className="ml-1.5 text-slate-400">{formatGroupValue(r.displayQty, p.product.unit)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

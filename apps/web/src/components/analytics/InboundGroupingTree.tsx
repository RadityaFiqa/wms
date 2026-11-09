"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AnalyticsUnitGroup, InboundLot, InboundProduct } from "@bulog-wms/schema";
import {
  formatDateId,
  formatGroupValue,
  formatProductName,
  formatQty,
  ORIGIN_BADGES,
} from "@/components/analytics/format";

const lotMatches = (lot: InboundLot, q: string) =>
  [lot.lotName || "", ...lot.documents.map((d) => d.documentNumber)].some((v) => v.toLowerCase().includes(q));

/** Keeps only the branches that match the search; a matching parent keeps all its children */
function filterTree(products: InboundProduct[], search: string): InboundProduct[] {
  const q = search.trim().toLowerCase();
  if (!q) return products;
  return products
    .map((p) => {
      if ([p.name, p.sku, p.category].some((v) => v.toLowerCase().includes(q))) return p;
      const senders = p.senders
        .map((s) => {
          if (s.name.toLowerCase().includes(q)) return s;
          const stacks = s.stacks
            .map((st) =>
              st.locationName.toLowerCase().includes(q) ? st : { ...st, lots: st.lots.filter((l) => lotMatches(l, q)) },
            )
            .filter((st) => st.lots.length > 0);
          return { ...s, stacks };
        })
        .filter((s) => s.stacks.length > 0);
      return { ...p, senders };
    })
    .filter((p) => p.senders.length > 0);
}

// Named groups so a chevron only turns when its own level is open
const CHEVRON_ROTATE = {
  product: "group-open/product:rotate-90",
  sender: "group-open/sender:rotate-90",
  stack: "group-open/stack:rotate-90",
} as const;

const Chevron = ({ level }: { level: keyof typeof CHEVRON_ROTATE }) => (
  <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${CHEVRON_ROTATE[level]}`} />
);

function Qty({ value, unit, strong = true }: { value: number; unit: AnalyticsUnitGroup; strong?: boolean }) {
  return (
    <span
      className={`ml-auto shrink-0 pl-3 text-right tabular-nums ${
        strong ? "font-bold text-slate-800 dark:text-slate-100" : "font-semibold text-slate-600 dark:text-slate-300"
      }`}
    >
      {formatGroupValue(value, unit)}
    </span>
  );
}

const summaryClass = "flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden";

export default function InboundGroupingTree({ products, search }: { products: InboundProduct[]; search: string }) {
  const visible = filterTree(products, search);
  const forceOpen = search.trim().length > 0;
  const isScaled = (unit: AnalyticsUnitGroup) => unit.key === "Kg" || unit.key === "L";

  if (visible.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-400">Tidak ada stok yang cocok.</p>;
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {visible.map((p) => (
        <details key={p.productUuid} className="group/product" open={forceOpen || undefined}>
          <summary className={`${summaryClass} py-3`}>
            <Chevron level="product" />
            <div className="min-w-0" title={p.name}>
              <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{formatProductName(p.name)}</div>
              <div className="text-[11px] text-slate-400">
                <span className="font-medium tracking-wide">{p.sku}</span> · {p.senders.length} pengirim · {p.stackCount} tumpukan
              </div>
            </div>
            <span className="ml-auto shrink-0 pl-3 text-right">
              <span className="block text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {formatGroupValue(p.displayQty, p.unit)}
              </span>
              {isScaled(p.unit) && (
                <span className="block text-[11px] tabular-nums text-slate-400">
                  {formatQty(p.qty)} {p.uom}
                </span>
              )}
            </span>
          </summary>

          <div className="mb-2 ml-5 divide-y divide-slate-100 border-l border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {p.senders.map((s) => (
              <details key={s.name} className="group/sender" open={forceOpen || undefined}>
                <summary className={`${summaryClass} py-2.5 pl-3 text-sm`}>
                  <Chevron level="sender" />
                  <span className="min-w-0 truncate font-semibold text-slate-700 dark:text-slate-200">{s.name}</span>
                  <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${ORIGIN_BADGES[s.originCategory]}`}>
                    {s.originCategory}
                  </span>
                  <span className="hidden shrink-0 text-[11px] text-slate-400 sm:inline">{s.stacks.length} tumpukan</span>
                  <Qty value={s.displayQty} unit={p.unit} />
                </summary>

                <div className="mb-2 ml-8 divide-y divide-slate-100 border-l border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                  {s.stacks.map((st) => (
                    <details key={st.locationUuid} className="group/stack" open={forceOpen || undefined}>
                      <summary className={`${summaryClass} py-2 pl-3 text-xs`}>
                        <Chevron level="stack" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{st.locationName}</span>
                        <span className="text-[11px] text-slate-400">{st.lots.length} lot</span>
                        <Qty value={st.displayQty} unit={p.unit} strong={false} />
                      </summary>

                      <div className="mb-2 ml-8 overflow-x-auto">
                        <table className="w-full min-w-[480px] border-collapse text-[11px]">
                          <thead>
                            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                              <th className="py-1 pr-2">Lot</th>
                              <th className="py-1 px-2">Dokumen masuk</th>
                              <th className="py-1 pl-2 text-right">Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {st.lots.map((lot, i) => (
                              <tr key={`${lot.lotName}-${i}`} className="align-top">
                                <td className="py-1.5 pr-2 font-mono text-slate-700 dark:text-slate-300">{lot.lotName || "Tanpa lot"}</td>
                                <td className="py-1.5 px-2">
                                  {lot.documents.length === 0 ? (
                                    <span className="text-slate-400">Lot tidak ditemukan di dokumen masuk</span>
                                  ) : (
                                    lot.documents.map((d) => (
                                      <div key={d.documentUuid}>
                                        <Link
                                          href={`/erp-documents/${d.documentUuid}`}
                                          className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                                        >
                                          {d.documentNumber}
                                        </Link>
                                        <span className="ml-1.5 text-slate-400">{formatDateId(d.dateDone)}</span>
                                      </div>
                                    ))
                                  )}
                                </td>
                                <td className="py-1.5 pl-2 text-right tabular-nums">
                                  <div className="font-bold text-slate-700 dark:text-slate-200">
                                    {formatQty(lot.qty)} {p.uom}
                                  </div>
                                  {isScaled(p.unit) && <div className="text-slate-400">{formatGroupValue(lot.displayQty, p.unit)}</div>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

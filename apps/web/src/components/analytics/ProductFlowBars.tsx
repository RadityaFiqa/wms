"use client";

import { useState } from "react";
import type { FlowGranularity, FlowTrendGroup } from "@bulog-wms/schema";
import { formatGroupValue, formatPeriodLong, formatProductName } from "@/components/analytics/format";
import { IN_COLOR, OUT_COLOR } from "@/components/analytics/FlowTrendChart";

const INITIAL_ROWS = 8;

interface ProductFlowBarsProps {
  group: FlowTrendGroup;
  granularity: FlowGranularity;
  period: string;
}

/** Per product for one period: outgoing bar to the left, incoming bar to the right */
export default function ProductFlowBars({ group, granularity, period }: ProductFlowBarsProps) {
  const [showAll, setShowAll] = useState(false);
  const skus = new Map(group.skus.map((s) => [s.productUuid, s]));
  const rows = group.skuPoints
    .filter((p) => p.period === period && (p.in > 0 || p.out > 0))
    .map((p) => ({ ...p, product: skus.get(p.productUuid) }))
    .sort((a, b) => b.in + b.out - (a.in + a.out));
  const max = Math.max(1e-9, ...rows.flatMap((r) => [r.in, r.out]));
  const visible = showAll ? rows : rows.slice(0, INITIAL_ROWS);
  const value = (v: number) => formatGroupValue(v, group).replace(` ${group.displayUnit}`, "");

  return (
    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/40">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {formatPeriodLong(period, granularity)} · per produk
        </span>
        <span className="text-xs text-slate-400">dalam {group.displayUnit}</span>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">Tidak ada barang masuk atau keluar di periode ini.</p>
      ) : (
        <>
          <div className="mb-1 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Produk</span>
            <span className="text-right" style={{ color: OUT_COLOR }}>◀ Keluar</span>
            <span style={{ color: IN_COLOR }}>Masuk ▶</span>
          </div>
          <ul className="space-y-1.5">
            {visible.map((r) => {
              const name = r.product ? formatProductName(r.product.name) : "-";
              return (
                <li key={r.productUuid} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
                  <div className="min-w-0" title={r.product?.name}>
                    <div className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{name}</div>
                    <div className="text-[10px] font-medium tracking-wide text-slate-400">{r.product?.sku}</div>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    {r.out > 0 && <span className="shrink-0 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">{value(r.out)}</span>}
                    <div
                      className="h-3.5 rounded-l-[3px]"
                      style={{ width: `${(r.out / max) * 100}%`, minWidth: r.out > 0 ? 2 : 0, background: OUT_COLOR }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 border-l border-slate-300 dark:border-slate-600">
                    <div
                      className="h-3.5 rounded-r-[3px]"
                      style={{ width: `${(r.in / max) * 100}%`, minWidth: r.in > 0 ? 2 : 0, background: IN_COLOR }}
                    />
                    {r.in > 0 && <span className="shrink-0 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">{value(r.in)}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          {rows.length > INITIAL_ROWS && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
            >
              {showAll ? "Tampilkan lebih sedikit" : `Tampilkan semua ${rows.length} produk`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

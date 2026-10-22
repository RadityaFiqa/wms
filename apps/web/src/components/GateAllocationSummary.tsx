import React from "react";
import type { GateAllocationSummary as GateAllocationSummaryData } from "@bulog-wms/schema";

interface GateAllocationSummaryProps {
  summary?: GateAllocationSummaryData | null;
}

const formatQty = (value: number) => value.toLocaleString("id-ID");

/**
 * Cargo quantity per product split into quantity allocated to document references
 * and the unallocated remainder (total = allocated + remaining).
 */
export function GateAllocationSummary({ summary }: GateAllocationSummaryProps) {
  if (!summary || summary.items.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="text-[11px] font-bold text-slate-600 uppercase">
        Alokasi Quantity Gate
      </div>
      <div className="space-y-2">
        {summary.items.map((item) => {
          const uom = item.uom || "Unit";
          return (
            <div
              key={item.productId}
              className="border border-slate-100 rounded-lg p-2 space-y-1.5"
            >
              <div className="text-xs font-bold text-slate-800 truncate">
                {item.productName}
                {item.sku && (
                  <span className="ml-1 font-normal text-slate-400">
                    ({item.sku})
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">
                    Quantity Awal
                  </div>
                  <div className="text-xs font-black text-slate-800">
                    {formatQty(item.totalQty)} {uom}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">
                    Teralokasi
                  </div>
                  <div className="text-xs font-black text-blue-700">
                    {formatQty(item.allocatedQty)} {uom}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">
                    Sisa
                  </div>
                  <div
                    className={`text-xs font-black ${
                      item.remainingQty > 0 ? "text-amber-600" : "text-emerald-700"
                    }`}
                  >
                    {formatQty(item.remainingQty)} {uom}
                  </div>
                </div>
              </div>
              {item.allocations.length > 0 && (
                <ul className="text-[11px] text-slate-600 divide-y divide-slate-100">
                  {item.allocations.map((alloc) => (
                    <li
                      key={alloc.documentReferenceId}
                      className="flex justify-between gap-2 py-0.5"
                    >
                      <span className="truncate">{alloc.documentNumber || "-"}</span>
                      <span className="font-semibold whitespace-nowrap">
                        {formatQty(alloc.quantity)} {uom}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

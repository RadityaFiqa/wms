"use client";

import React, { useMemo } from "react";
import { Calculator, DollarSign } from "lucide-react";

export interface SummaryRow {
  documentType: string;
  uom: string;
  quantity: number;
  costPerUnit: number;
  subtotal: number;
}

interface TagihanSummaryTableProps {
  selectedErpDocs?: any[];
  costs: Record<string, number>;
  onCostChange?: (key: string, cost: number) => void;
  readOnly?: boolean;
  initialSummaries?: any[];
}

export function TagihanSummaryTable({
  selectedErpDocs = [],
  costs,
  onCostChange,
  readOnly = false,
  initialSummaries,
}: TagihanSummaryTableProps) {
  // Compute grouped summary rows
  const summaryRows: SummaryRow[] = useMemo(() => {
    // If readOnly and initialSummaries provided (e.g., viewing an existing Tagihan detail)
    if (initialSummaries && initialSummaries.length > 0 && selectedErpDocs.length === 0) {
      return initialSummaries.map((s) => ({
        documentType: s.documentType,
        uom: s.uom,
        quantity: Number(s.quantity) || 0,
        costPerUnit: Number(s.costPerUnit) || 0,
        subtotal: Number(s.subtotal) || 0,
      }));
    }

    const groupMap = new Map<string, { documentType: string; uom: string; quantity: number }>();

    for (const doc of selectedErpDocs) {
      const code = (doc.pickingTypeCode || "").toLowerCase();
      let docType = "INT";
      if (code === "incoming") docType = "IN";
      else if (code === "outgoing") docType = "OUT";

      for (const item of doc.items || []) {
        const uom = (item.uom || "UNIT").trim().toUpperCase();
        const key = `${docType}__${uom}`;

        if (!groupMap.has(key)) {
          groupMap.set(key, { documentType: docType, uom, quantity: 0 });
        }
        const current = groupMap.get(key)!;
        current.quantity += Number(item.quantity || item.productQty || 0);
      }
    }

    const rows: SummaryRow[] = [];
    groupMap.forEach((val, key) => {
      const costPerUnit = costs[key] ?? 0;
      const subtotal = val.quantity * costPerUnit;
      rows.push({
        documentType: val.documentType,
        uom: val.uom,
        quantity: Math.round(val.quantity * 1000) / 1000,
        costPerUnit,
        subtotal: Math.round(subtotal * 100) / 100,
      });
    });

    return rows.sort((a, b) => a.documentType.localeCompare(b.documentType) || a.uom.localeCompare(b.uom));
  }, [selectedErpDocs, costs, initialSummaries]);

  const totalTagihan = useMemo(() => {
    return summaryRows.reduce((acc, row) => acc + row.subtotal, 0);
  }, [summaryRows]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getDocTypeBadge = (type: string) => {
    switch (type) {
      case "IN":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-400">
            IN (Penerimaan)
          </span>
        );
      case "OUT":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-blue-400">
            OUT (Pengeluaran)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/30 dark:border-purple-900/40 dark:text-purple-400">
            INT (Internal)
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/50">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-emerald-600" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Tagihan Summary (Kalkulasi Otomatis)
          </h4>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Dihitung berdasarkan Dokumen ERP Commodity yang dipilih
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
            <tr>
              <th className="px-6 py-3 w-[6%]">No.</th>
              <th className="px-6 py-3 w-[24%]">Tipe Dokumen (IN/OUT/INT)</th>
              <th className="px-6 py-3 w-[15%]">Satuan (UOM)</th>
              <th className="px-6 py-3 text-right w-[18%]">Total Kuantitas</th>
              <th className="px-6 py-3 text-right w-[19%]">Tarif / Unit (Rp)</th>
              <th className="px-6 py-3 text-right w-[18%]">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {summaryRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-xs">
                  Belum ada dokumen ERP Commodity yang dipilih untuk dikalkulasi.
                </td>
              </tr>
            ) : (
              summaryRows.map((row, idx) => {
                const key = `${row.documentType}__${row.uom}`;
                return (
                  <tr
                    key={key}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition"
                  >
                    <td className="px-6 py-3.5 text-slate-400 font-mono font-medium">
                      {idx + 1}
                    </td>
                    <td className="px-6 py-3.5">{getDocTypeBadge(row.documentType)}</td>
                    <td className="px-6 py-3.5 font-bold font-mono text-slate-700 dark:text-slate-300">
                      {row.uom}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                      {row.quantity.toLocaleString("id-ID", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 3,
                      })}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {readOnly ? (
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatCurrency(row.costPerUnit)}
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <span className="text-[11px] text-slate-400 font-bold">Rp</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={costs[key] ?? ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              if (onCostChange) onCostChange(key, val);
                            }}
                            placeholder="0"
                            className="w-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-right text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(row.subtotal)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot className="bg-slate-50/90 dark:bg-slate-850/90 border-t border-slate-200 dark:border-slate-800">
            <tr>
              <td
                colSpan={5}
                className="px-6 py-4 text-right font-black uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300"
              >
                Total Tagihan:
              </td>
              <td className="px-6 py-4 text-right font-mono font-black text-base text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalTagihan)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

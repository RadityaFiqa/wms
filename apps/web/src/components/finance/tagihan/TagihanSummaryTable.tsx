"use client";

import React, { useMemo } from "react";
import { Calculator, DollarSign, Scale } from "lucide-react";
import { getSecondaryQty, getSecondaryUnit } from "@/lib/quantity";

export interface SummaryRow {
  documentType: string;
  uom: string;
  quantity: number; // Secondary quantity used for billing
  primaryQuantity: number; // Primary quantity for comparison
  primaryUoms: string[];
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
  // Compute grouped summary rows based on secondary quantity
  const summaryRows: SummaryRow[] = useMemo(() => {
    // If readOnly and initialSummaries provided without ERP docs
    if (initialSummaries && initialSummaries.length > 0 && selectedErpDocs.length === 0) {
      return initialSummaries.map((s) => ({
        documentType: s.documentType,
        uom: s.uom,
        quantity: Number(s.quantity) || 0,
        primaryQuantity: Number(s.quantity) || 0,
        primaryUoms: [s.uom],
        costPerUnit: Number(s.costPerUnit) || 0,
        subtotal: Number(s.subtotal) || 0,
      }));
    }

    const groupMap = new Map<
      string,
      {
        documentType: string;
        uom: string;
        quantity: number;
        primaryQuantity: number;
        primaryUomMap: Map<string, number>;
      }
    >();

    for (const doc of selectedErpDocs) {
      const code = (doc.pickingTypeCode || "").toLowerCase();
      let docType = "INT";
      if (code === "incoming") docType = "IN";
      else if (code === "outgoing") docType = "OUT";

      for (const item of doc.items || []) {
        const primQty = Number(item.quantity || item.productQty || 0);
        const secQty = getSecondaryQty(primQty, item.uom);
        const secUnit = getSecondaryUnit(item.uom).toUpperCase();
        const primUom = (item.uom || "UNIT").trim().toUpperCase();
        const key = `${docType}__${secUnit}`;

        if (!groupMap.has(key)) {
          groupMap.set(key, {
            documentType: docType,
            uom: secUnit,
            quantity: 0,
            primaryQuantity: 0,
            primaryUomMap: new Map<string, number>(),
          });
        }
        const current = groupMap.get(key)!;
        current.quantity += secQty;
        current.primaryQuantity += primQty;
        current.primaryUomMap.set(
          primUom,
          (current.primaryUomMap.get(primUom) || 0) + primQty,
        );
      }
    }

    const rows: SummaryRow[] = [];
    groupMap.forEach((val, key) => {
      const costPerUnit = costs[key] ?? costs[val.uom] ?? 0;
      const subtotal = val.quantity * costPerUnit;

      const primaryUoms: string[] = [];
      val.primaryUomMap.forEach((qty, uomName) => {
        primaryUoms.push(
          `${qty.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${uomName}`,
        );
      });

      rows.push({
        documentType: val.documentType,
        uom: val.uom,
        quantity: Math.round(val.quantity * 1000) / 1000,
        primaryQuantity: Math.round(val.primaryQuantity * 1000) / 1000,
        primaryUoms,
        costPerUnit,
        subtotal: Math.round(subtotal * 100) / 100,
      });
    });

    return rows.sort(
      (a, b) =>
        a.documentType.localeCompare(b.documentType) ||
        a.uom.localeCompare(b.uom),
    );
  }, [selectedErpDocs, costs, initialSummaries]);

  const totalTagihan = useMemo(() => {
    return summaryRows.reduce((acc, row) => acc + row.subtotal, 0);
  }, [summaryRows]);

  const totalSecondaryQtySummary = useMemo(() => {
    const unitMap = new Map<string, number>();
    summaryRows.forEach((r) => {
      unitMap.set(r.uom, (unitMap.get(r.uom) || 0) + r.quantity);
    });
    return Array.from(unitMap.entries())
      .map(
        ([unit, qty]) =>
          `${qty.toLocaleString("id-ID", { maximumFractionDigits: 3 })} ${unit}`,
      )
      .join(" • ");
  }, [summaryRows]);

  const totalPrimaryQtySummary = useMemo(() => {
    const list: string[] = [];
    summaryRows.forEach((r) => {
      if (r.primaryUoms && r.primaryUoms.length > 0) {
        list.push(...r.primaryUoms);
      }
    });
    return list.length > 0 ? list.join(" • ") : "-";
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
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-850/50">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-emerald-600" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Tagihan Summary
          </h4>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-emerald-600" />
          Kuantum dihitung menggunakan secondary quantity (Kg/L)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs min-w-[750px]">
          <thead className="bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
            <tr>
              <th className="px-6 py-3 w-[5%]">No.</th>
              <th className="px-6 py-3 w-[18%]">Tipe Dokumen</th>
              <th className="px-6 py-3 w-[12%]">Satuan Penagihan</th>
              <th className="px-6 py-3 text-right w-[20%]">
                Kuantitas Primer (Pembanding)
              </th>
              <th className="px-6 py-3 text-right w-[18%]">
                Kuantum Penagihan (Secondary Qty)
              </th>
              <th className="px-6 py-3 text-right w-[15%]">Tarif / Unit (Rp)</th>
              <th className="px-6 py-3 text-right w-[17%]">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {summaryRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-400 text-xs">
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
                    <td className="px-6 py-3.5 font-bold font-mono text-emerald-700 dark:text-emerald-400">
                      {row.uom}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      <div className="flex flex-row items-center justify-end gap-1.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {row.primaryQuantity.toLocaleString("id-ID", {
                            maximumFractionDigits: 3,
                          })}
                        </span>
                        {row.primaryUoms.length > 0 && (
                          <span className="text-[11px] text-slate-400 font-medium">
                            ({row.primaryUoms.join(", ")})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-black text-slate-800 dark:text-slate-100">
                      {row.quantity.toLocaleString("id-ID", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 3,
                      })}{" "}
                      <span className="text-[11px] font-bold text-emerald-600">
                        {row.uom}
                      </span>
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
                            className="w-28 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-right text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
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
                colSpan={3}
                className="px-6 py-4 font-black uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300 whitespace-nowrap"
              >
                Total:
              </td>
              <td className="px-6 py-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                <div className="flex flex-row items-center justify-end gap-1.5 whitespace-nowrap">
                  <span>{totalPrimaryQtySummary}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-right font-mono font-black text-slate-800 dark:text-slate-100 whitespace-nowrap">
                <div className="flex flex-row items-center justify-end gap-1.5 whitespace-nowrap">
                  <span>{totalSecondaryQtySummary || "-"}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-right font-black uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300 whitespace-nowrap">
                Total Tagihan:
              </td>
              <td className="px-6 py-4 text-right font-mono font-black text-base text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                {formatCurrency(totalTagihan)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}


"use client";

import React, { useState } from "react";
import {
  useReconciliation,
  useReconciliationDetail,
} from "@/hooks/useReconciliation";
import { useAuthStore } from "@/store/auth";
import {
  Scale,
  MapPin,
  Info,
  Calendar,
  User,
  ArrowRightLeft,
  ChevronRight,
} from "lucide-react";

export default function ReconciliationPage() {
  const { activeWarehouse } = useAuthStore();
  const { reconciliationData, isLoading } = useReconciliation();
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (uuid: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [uuid]: !prev[uuid],
    }));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Scale className="h-8 w-8 text-blue-600 shrink-0" />
            Rekonsiliasi Stok ERP
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Pantau perbedaan kuantitas stok antara sistem ERP Odoo dengan muatan
            fisik gerbang untuk gudang:{" "}
            <span className="font-semibold text-blue-600">
              {activeWarehouse?.name || "Belum Dipilih"}
            </span>
          </p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-5 flex items-start gap-4 shadow-xs">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div className="text-xs sm:text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          <p className="font-bold mb-1">
            Cara Perhitungan (Formula) Rekonsiliasi:
          </p>
          <p className="font-mono bg-blue-100/50 dark:bg-blue-900/20 px-2 py-1 rounded inline-block text-[11px] sm:text-xs">
            Expected Stock = ERP Stock - Pending Gate Operation Quantity
          </p>
          <p className="mt-2 text-slate-500 dark:text-slate-450 text-xs">
            * Pending Gate Operation Quantity adalah total kargo masuk (IN) atau
            keluar (OUT) di pintu gerbang yang <strong>belum</strong> ditautkan
            ke referensi Purchase Order (PO), Sales Order (SO), atau dokumen
            picking ERP Odoo.
          </p>
        </div>
      </div>

      {/* Main Grid: Expandable Table Layout */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-layout-fixed">
            <thead className="bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4 w-[40%]">Produk</th>
                <th className="px-6 py-4 text-right w-[20%]">ERP Stock</th>
                <th className="px-6 py-4 text-right w-[20%]">
                  Pending Gate Operation
                </th>
                <th className="px-6 py-4 text-right w-[20%]">
                  Expected Stock
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-48"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-16 ml-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-16 ml-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-16 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : reconciliationData.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-16 text-center text-slate-400 font-medium"
                  >
                    Tidak ada data rekonsiliasi yang tersedia.
                  </td>
                </tr>
              ) : (
                reconciliationData.map((row: any) => {
                  const isExpanded = !!expandedRows[row.product.uuid];
                  return (
                    <React.Fragment key={row.product.uuid}>
                      <tr
                        onClick={() => toggleRow(row.product.uuid)}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 transition cursor-pointer select-none ${
                          isExpanded ? "bg-blue-50/20 dark:bg-blue-950/10" : ""
                        }`}
                      >
                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                          <div className="flex items-center space-x-2">
                            <ChevronRight
                              className={`h-4 w-4 transition-transform duration-200 shrink-0 text-slate-400 ${
                                isExpanded ? "rotate-90 text-blue-500" : ""
                              }`}
                            />
                            <div>
                              <div>{row.product.name}</div>
                              <div className="text-slate-400 font-mono text-[10px] mt-0.5 font-normal">
                                {row.product.sku}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-700 dark:text-slate-330">
                          {row.erpStock.toLocaleString("id-ID")}{" "}
                          <span className="text-slate-400 text-xs font-normal ml-0.5">
                            {row.product.uom}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {row.pendingGateQty !== 0 ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                row.pendingGateQty > 0
                                  ? "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30"
                                  : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"
                              }`}
                            >
                              {row.pendingGateQty > 0
                                ? `+${row.pendingGateQty.toLocaleString("id-ID")}`
                                : row.pendingGateQty.toLocaleString(
                                    "id-ID",
                                  )}{" "}
                              {row.product.uom}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600">
                              -
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-blue-600 dark:text-blue-400">
                          {row.expectedStock.toLocaleString("id-ID")}{" "}
                          <span className="text-slate-400 text-xs font-normal ml-0.5">
                            {row.product.uom}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={4}
                            className="bg-slate-50/30 dark:bg-slate-900/30 px-8 py-4 border-b border-slate-100 dark:border-slate-800/80"
                          >
                            <ReconciliationRowDetail
                              productUuid={row.product.uuid}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReconciliationRowDetail({ productUuid }: { productUuid: string }) {
  const { detailData, isLoading, error } = useReconciliationDetail(productUuid);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 py-4 justify-center text-slate-500">
        <svg
          className="animate-spin h-5 w-5 text-blue-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span className="text-xs font-semibold">Memuat rincian tumpukan...</span>
      </div>
    );
  }

  if (error || !detailData) {
    return (
      <div className="text-red-500 text-xs font-bold py-2 text-center">
        Gagal memuat rincian tumpukan.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
      <div className="bg-slate-100/70 dark:bg-slate-800/50 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold text-slate-700 dark:text-slate-350 text-xs uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="h-4.5 w-4.5 text-blue-500 shrink-0" />
          Rincian Tumpukan per Lokasi (ERP Source Breakdown)
        </span>
        <span className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100/40 dark:border-blue-900/30">
          {detailData.erpStockSource.length} Stacks
        </span>
      </div>
      {detailData.erpStockSource.length === 0 ? (
        <p className="text-xs text-slate-400 italic p-4 text-center">
          Tidak ada lokasi atau tumpukan aktif di ERP.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/30 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3">Lokasi</th>
                <th className="px-5 py-3">Lot / Batch</th>
                <th className="px-5 py-3 text-right">Quantity</th>
                <th className="px-5 py-3 text-right text-amber-600 dark:text-amber-500">Reserved</th>
                <th className="px-5 py-3 text-right font-bold text-emerald-600 dark:text-emerald-500 bg-emerald-50/5">
                  Available
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {detailData.erpStockSource.map((loc: any, idx: number) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10 transition bg-white dark:bg-slate-900/40"
                >
                  <td className="px-5 py-3 font-bold text-slate-700 dark:text-slate-300">
                    {loc.locationName}
                  </td>
                  <td className="px-5 py-3">
                    {loc.lotName && loc.lotName !== "-" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-700 font-medium">
                        {loc.lotName}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Tanpa Lot</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-700 dark:text-slate-300">
                    {loc.quantity.toLocaleString("id-ID")}{" "}
                    <span className="text-slate-400 font-normal text-[10px] ml-0.5">
                      {detailData.product.uom}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-amber-600">
                    {loc.reservedQuantity.toLocaleString("id-ID")}{" "}
                    <span className="text-slate-400 font-normal text-[10px] ml-0.5">
                      {detailData.product.uom}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-emerald-600 bg-emerald-50/5">
                    {loc.availableQuantity.toLocaleString("id-ID")}{" "}
                    <span className="text-slate-400 font-normal text-[10px] ml-0.5">
                      {detailData.product.uom}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

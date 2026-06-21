"use client";

import React, { useState } from "react";
import {
  useReconciliation,
  useReconciliationDetail,
} from "@/hooks/useReconciliation";
import { useProducts, useWarehouseLocations } from "@/hooks/useInventory";
import { useAuthStore } from "@/store/auth";
import {
  Scale,
  MapPin,
  Info,
  ChevronRight,
  Filter,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Search,
} from "lucide-react";
import Link from "next/link";

export default function ReconciliationPage() {
  const { activeWarehouse } = useAuthStore();
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  
  const { reconciliationData, isLoading } = useReconciliation({
    productId,
    locationId,
  });

  const { products } = useProducts();
  const { locations } = useWarehouseLocations();

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
          <div className="space-y-1 font-mono text-[11px] sm:text-xs">
            <p className="bg-blue-100/50 dark:bg-blue-900/20 px-2 py-1 rounded inline-block">
              Calculated Physical = ERP Stock + Pending Adj (Pending IN - Pending OUT) + Adjustment Qty
            </p>
            <br />
            <p className="bg-blue-100/50 dark:bg-blue-900/20 px-2 py-1 rounded inline-block mt-1">
              Stock Difference = ERP Stock - Calculated Physical
            </p>
          </div>
          <p className="mt-2 text-slate-500 dark:text-slate-450 text-xs">
            * <strong>Pending Adj</strong> adalah pergerakan kargo masuk (IN) atau
            keluar (OUT) pintu gerbang yang <strong>belum</strong> ditautkan ke referensi ERP,
            atau ditautkan ke dokumen ERP yang statusnya <strong>bukan</strong> `"done"`.
          </p>
          <p className="mt-1 text-slate-500 dark:text-slate-450 text-xs">
            * <strong>Adjustment Qty</strong> adalah total selisih kuantitas pada dokumen ERP yang sudah `"done"` tetapi realisasi fisiknya parsial (berbeda dari kuantitas dokumen).
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-700 dark:text-slate-300">
          <Filter className="h-4.5 w-4.5 text-slate-500" />
          <span>Saring Rekonsiliasi</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Product Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Filter Produk
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Semua Produk</option>
              {products.map((p: any) => (
                <option key={p.uuid} value={p.uuid}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Filter Lokasi
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Semua Lokasi</option>
              {locations.map((l: any) => (
                <option key={l.uuid} value={l.uuid}>
                  {l.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Expandable Table Layout */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-layout-fixed">
            <thead className="bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4 w-[25%]">Produk</th>
                <th className="px-6 py-4 text-right w-[14%]">ERP Stock</th>
                <th className="px-6 py-4 text-right w-[14%]">Pending Adj</th>
                <th className="px-6 py-4 text-right w-[15%]">Adjustment Qty</th>
                <th className="px-6 py-4 text-right w-[16%]">Calculated Physical</th>
                <th className="px-6 py-4 text-right w-[16%]">Stock Difference</th>
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
                    colSpan={6}
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
                        <td className="px-6 py-4 text-right font-semibold text-slate-700 dark:text-slate-300">
                          {row.erpStock.toLocaleString("id-ID")}{" "}
                          <span className="text-slate-450 text-[10px] font-normal ml-0.5">
                            {row.product.uom}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">
                          {row.physicalAdjustment !== 0 ? (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold ${
                                row.physicalAdjustment > 0
                                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"
                                  : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30"
                              }`}
                            >
                              {row.physicalAdjustment > 0
                                ? `+${row.physicalAdjustment.toLocaleString("id-ID")}`
                                : row.physicalAdjustment.toLocaleString("id-ID")}{" "}
                              {row.product.uom}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">
                          {row.adjustmentQty !== 0 ? (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold ${
                                row.adjustmentQty > 0
                                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"
                                  : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30"
                              }`}
                            >
                              {row.adjustmentQty > 0
                                ? `+${row.adjustmentQty.toLocaleString("id-ID")}`
                                : row.adjustmentQty.toLocaleString("id-ID")}{" "}
                              {row.product.uom}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-slate-100">
                          {row.calculatedPhysical.toLocaleString("id-ID")}{" "}
                          <span className="text-slate-450 text-[10px] font-normal ml-0.5">
                            {row.product.uom}
                          </span>
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-black ${
                            row.stockDifference !== 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {row.stockDifference.toLocaleString("id-ID")}{" "}
                          <span className="text-slate-450 text-[10px] font-normal ml-0.5">
                            {row.product.uom}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={6}
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
  const [expandedLocations, setExpandedLocations] = useState<Record<number, boolean>>({});

  const toggleLocation = (locId: number) => {
    setExpandedLocations((prev) => ({
      ...prev,
      [locId]: !prev[locId],
    }));
  };

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
        <span className="text-xs font-semibold">Memuat rincian lokasi...</span>
      </div>
    );
  }

  if (error || !detailData) {
    return (
      <div className="text-red-500 text-xs font-bold py-2 text-center">
        Gagal memuat rincian lokasi.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
      <div className="bg-slate-100/70 dark:bg-slate-800/50 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold text-slate-700 dark:text-slate-350 text-xs uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="h-4.5 w-4.5 text-blue-500 shrink-0" />
          Rincian Rekonsiliasi per Lokasi
        </span>
        <span className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100/40 dark:border-blue-900/30">
          {detailData.locations.length} Lokasi
        </span>
      </div>
      {detailData.locations.length === 0 ? (
        <p className="text-xs text-slate-400 italic p-4 text-center">
          Tidak ada lokasi atau tumpukan aktif untuk produk ini.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/30 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3 w-[25%]">Lokasi</th>
                <th className="px-5 py-3 text-right w-[13%]">ERP Qty</th>
                <th className="px-5 py-3 text-right w-[13%]">Pending Adj</th>
                <th className="px-5 py-3 text-right w-[15%]">Adjustment Qty</th>
                <th className="px-5 py-3 text-right w-[17%]">Calculated Physical</th>
                <th className="px-5 py-3 text-right w-[17%]">Stock Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {detailData.locations.map((loc: any, idx: number) => {
                const isLocExpanded = !!expandedLocations[loc.locationId];
                const hasOps = loc.gateOperations && loc.gateOperations.length > 0;

                return (
                  <React.Fragment key={idx}>
                    <tr
                      onClick={() => hasOps && toggleLocation(loc.locationId)}
                      className={`hover:bg-slate-50/20 dark:hover:bg-slate-800/10 transition bg-white dark:bg-slate-900/40 ${
                        hasOps ? "cursor-pointer" : ""
                      }`}
                    >
                      <td className="px-5 py-3 font-bold text-slate-700 dark:text-slate-350">
                        <div className="flex items-center space-x-1">
                          {hasOps && (
                            <ChevronRight
                              className={`h-3.5 w-3.5 transition-transform duration-200 text-slate-400 shrink-0 ${
                                isLocExpanded ? "rotate-90 text-blue-500" : ""
                              }`}
                            />
                          )}
                          <span>{loc.locationName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                        {loc.erpQty.toLocaleString("id-ID")}{" "}
                        <span className="text-slate-400 text-[9px] font-normal">
                          {detailData.product.uom}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium">
                        {loc.physicalAdjustment !== 0 ? (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              loc.physicalAdjustment > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {loc.physicalAdjustment > 0
                              ? `+${loc.physicalAdjustment.toLocaleString("id-ID")}`
                              : loc.physicalAdjustment.toLocaleString("id-ID")}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-medium">
                        {loc.adjustmentQty !== 0 ? (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              loc.adjustmentQty > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-650 dark:text-red-400"
                            }`}
                          >
                            {loc.adjustmentQty > 0
                              ? `+${loc.adjustmentQty.toLocaleString("id-ID")}`
                              : loc.adjustmentQty.toLocaleString("id-ID")}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                        {loc.calculatedPhysical.toLocaleString("id-ID")}{" "}
                        <span className="text-slate-400 text-[9px] font-normal">
                          {detailData.product.uom}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-bold ${
                          loc.stockDifference !== 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {loc.stockDifference.toLocaleString("id-ID")}{" "}
                        <span className="text-slate-405 text-[9px] font-normal">
                          {detailData.product.uom}
                        </span>
                      </td>
                    </tr>
                    {isLocExpanded && hasOps && (
                      <tr>
                        <td
                          colSpan={6}
                          className="bg-slate-50/20 dark:bg-slate-900/10 px-8 py-3"
                        >
                          <div className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden">
                            <div className="bg-slate-100/50 dark:bg-slate-800/40 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700/80">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Pending Gate Operations yang Mempengaruhi Lokasi Ini
                              </span>
                            </div>
                            <table className="w-full text-left border-collapse text-[11px]">
                              <thead>
                                <tr className="bg-slate-50/10 border-b border-slate-100 dark:border-slate-700/80 text-[9px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">
                                  <th className="px-4 py-2">Nomor Tiket</th>
                                  <th className="px-4 py-2 text-center">Tipe</th>
                                  <th className="px-4 py-2">Client / Partner</th>
                                  <th className="px-4 py-2">Ref Dokumen (State)</th>
                                  <th className="px-4 py-2 text-right">Kuantitas</th>
                                  <th className="px-4 py-2 text-center">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loc.gateOperations.map((op: any, opIdx: number) => (
                                  <tr
                                    key={opIdx}
                                    className="hover:bg-slate-55/10 dark:hover:bg-slate-800/20 bg-white dark:bg-slate-900/10"
                                  >
                                    <td className="px-4 py-2 font-mono font-bold text-slate-800 dark:text-slate-300">
                                      {op.opNumber}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                          op.cardType === "IN"
                                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                                            : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
                                        }`}
                                      >
                                        {op.cardType === "IN" ? "Masuk" : "Keluar"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-slate-700 dark:text-slate-350">
                                      {op.clientPartner || "-"}
                                    </td>
                                    <td className="px-4 py-2">
                                      <span className="font-mono text-[9px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700/50">
                                        {op.documentNumber}
                                      </span>
                                      {op.documentState && (
                                        <span className="ml-1 text-[9px] font-semibold text-amber-600 dark:text-amber-500 uppercase">
                                          ({op.documentState})
                                        </span>
                                      )}
                                    </td>
                                    <td
                                      className={`px-4 py-2 text-right font-bold ${
                                        op.cardType === "IN"
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : "text-red-600 dark:text-red-400"
                                      }`}
                                    >
                                      {op.cardType === "IN" ? "+" : "-"}
                                      {op.quantity.toLocaleString("id-ID")}{" "}
                                      <span className="text-slate-400 font-normal text-[9px]">
                                        {detailData.product.uom}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <Link
                                        href={`/gate-operations/${op.uuid}`}
                                        className="inline-flex items-center justify-center p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition"
                                        title="Lihat Detail Operasi"
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </Link>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rincian Penyesuaian Dokumen ERP Selesai (Adjustment Details) */}
      <div className="bg-slate-100/70 dark:bg-slate-800/50 px-4 py-2.5 flex items-center justify-between border-t border-b border-slate-200 dark:border-slate-800 mt-6">
        <span className="font-bold text-slate-700 dark:text-slate-350 text-xs uppercase tracking-wider flex items-center gap-1.5">
          <Info className="h-4.5 w-4.5 text-blue-500 shrink-0" />
          Rincian Penyesuaian Dokumen ERP Selesai (Partial Realization)
        </span>
        <span className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100/40 dark:border-blue-900/30">
          {detailData.adjustmentDetails?.length || 0} Dokumen
        </span>
      </div>
      {!detailData.adjustmentDetails || detailData.adjustmentDetails.length === 0 ? (
        <p className="text-xs text-slate-400 italic p-4 text-center">
          Tidak ada penyesuaian dokumen selesai untuk produk ini.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/30 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3">Nomor Dokumen</th>
                <th className="px-5 py-3">Produk</th>
                <th className="px-5 py-3 text-center">Tipe</th>
                <th className="px-5 py-3 text-right">ERP Qty</th>
                <th className="px-5 py-3 text-right">Total Gate Qty</th>
                <th className="px-5 py-3 text-right">Selisih</th>
                <th className="px-5 py-3 text-right">Penyesuaian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {detailData.adjustmentDetails.map((adj: any, adjIdx: number) => (
                <tr
                  key={adjIdx}
                  className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10 transition bg-white dark:bg-slate-900/40"
                >
                  <td className="px-5 py-3 font-mono font-bold text-slate-800 dark:text-slate-300">
                    {adj.documentNumber}
                  </td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-350">
                    {adj.productName}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        adj.type === "IN"
                          ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                          : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
                      }`}
                    >
                      {adj.type === "IN" ? "Masuk" : "Keluar"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                    {adj.erpQty.toLocaleString("id-ID")}{" "}
                    <span className="text-slate-400 text-[9px]">
                      {detailData.product.uom}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                    {adj.totalGateOperationQty.toLocaleString("id-ID")}{" "}
                    <span className="text-slate-400 text-[9px]">
                      {detailData.product.uom}
                    </span>
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-bold ${
                      adj.difference !== 0 ? "text-amber-600" : "text-slate-400"
                    }`}
                  >
                    {adj.difference > 0 ? "+" : ""}
                    {adj.difference.toLocaleString("id-ID")}{" "}
                    <span className="text-slate-400 text-[9px]">
                      {detailData.product.uom}
                    </span>
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-extrabold ${
                      adj.adjustmentQty > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-650 dark:text-red-400"
                    }`}
                  >
                    {adj.adjustmentQty > 0 ? "+" : ""}
                    {adj.adjustmentQty.toLocaleString("id-ID")}{" "}
                    <span className="text-slate-400 text-[9px]">
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


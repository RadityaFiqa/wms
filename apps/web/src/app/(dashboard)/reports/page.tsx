"use client";

import React, { useState } from "react";
import { useReports } from "@/hooks/useReports";
import { useProducts } from "@/hooks/useInventory";
import { useAuthStore } from "@/store/auth";
import { formatSecondaryQty } from "@/lib/quantity";
import { toast } from "sonner";
import {
  BarChart3,
  Download,
  FileText,
  Filter,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  MapPin,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export default function ReportsPage() {
  const { activeWarehouse } = useAuthStore();

  // Default date range: last 7 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const YYYY = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const DD = String(d.getDate()).padStart(2, "0");
    return `${YYYY}-${MM}-${DD}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const YYYY = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const DD = String(d.getDate()).padStart(2, "0");
    return `${YYYY}-${MM}-${DD}`;
  });

  const [productId, setProductId] = useState("");
  const [category, setCategory] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  
  const toggleRow = (idx: number) => {
    setExpandedRows((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // Fetch list of products for the dropdown filter
  const { products } = useProducts();

  const { reportData, isLoading, exportPdf, exportCsv } = useReports({
    startDate,
    endDate,
    productId,
    category,
  });

  const handleExportPdf = async () => {
    const toastId = toast.loading("Membuat laporan PDF...");
    try {
      await exportPdf();
      toast.success("Laporan PDF berhasil diunduh.", { id: toastId });
    } catch (e) {
      toast.error("Gagal mengekspor laporan PDF.", { id: toastId });
    }
  };

  const handleExportCsv = async () => {
    const toastId = toast.loading("Mengekspor berkas Excel...");
    try {
      await exportCsv();
      toast.success("Berkas Excel (.csv) berhasil diunduh.", { id: toastId });
    } catch (e) {
      toast.error("Gagal mengekspor berkas Excel.", { id: toastId });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-blue-600 shrink-0" />
            Laporan Mutasi Persediaan
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Pantau pergerakan stok awal, stok masuk, keluar, dan stok akhir
            harian produk untuk gudang:{" "}
            <span className="font-semibold text-blue-600">
              {activeWarehouse?.name || "Belum Dipilih"}
            </span>
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportCsv}
            disabled={isLoading || reportData.length === 0}
            className="flex items-center justify-center bg-white border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm disabled:opacity-50"
          >
            <Download className="h-4.5 w-4.5 mr-2 text-slate-500" />
            Ekspor Excel
          </button>

          <button
            onClick={handleExportPdf}
            disabled={isLoading || reportData.length === 0}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 transition cursor-pointer text-sm disabled:opacity-50"
          >
            <FileText className="h-4.5 w-4.5 mr-2" />
            Unduh PDF
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-700 dark:text-slate-300">
          <Filter className="h-4.5 w-4.5 text-slate-500" />
          <span>Atur Kriteria Laporan</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Start Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Hingga Tanggal
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* Product selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Filter Produk
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
            >
              <option value="">Semua Produk</option>
              {products.map((p: any) => (
                <option key={p.uuid} value={p.uuid}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Kategori
            </label>
            <input
              type="text"
              placeholder="Ketik Kategori (misal: Beras)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-layout-fixed">
            <thead className="bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4 w-[15%]">Tanggal</th>
                <th className="px-6 py-4 w-[29%]">Produk</th>
                <th className="px-6 py-4 text-right w-[14%]">Stock Awal</th>
                <th className="px-6 py-4 text-right w-[14%]">Masuk</th>
                <th className="px-6 py-4 text-right w-[14%]">Keluar</th>
                <th className="px-6 py-4 text-right w-[14%]">Stock Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-16"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-48"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-12 ml-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-12 ml-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-12 ml-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-12 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : reportData.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-16 text-center text-slate-400 font-medium"
                  >
                    Tidak ada data mutasi persediaan untuk periode dan kriteria
                    ini.
                  </td>
                </tr>
              ) : (
                reportData.map((row: any, idx: number) => {
                  const hasIncoming = row.incoming > 0;
                  const hasOutgoing = row.outgoing > 0;
                  const isExpanded = !!expandedRows[idx];

                  return (
                    <React.Fragment key={idx}>
                      <tr
                        onClick={() => toggleRow(idx)}
                        className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800/80 transition text-slate-700 dark:text-slate-300 cursor-pointer ${
                          isExpanded ? "bg-slate-50/20 dark:bg-slate-800/10" : ""
                        }`}
                      >
                        <td className="px-6 py-4 text-slate-500 font-medium text-xs">
                          <div className="flex items-center space-x-2">
                            <ChevronRight
                              className={`h-4 w-4 transition-transform duration-200 shrink-0 text-slate-400 ${
                                isExpanded ? "rotate-90 text-blue-500" : ""
                              }`}
                            />
                            <span>
                              {new Date(row.date).toLocaleString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-200">
                          <div>{row.product.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {row.product.sku}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-600 dark:text-slate-400">
                          <div>
                            {row.openingStock.toLocaleString("id-ID")}{" "}
                            <span className="text-[10px] text-slate-400 font-normal">
                              {row.product.uom}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 font-normal mt-0.5">
                            {formatSecondaryQty(row.openingStock, row.product.uom)}
                          </div>
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-extrabold ${
                            hasIncoming
                              ? "text-emerald-655 dark:text-emerald-400"
                              : "text-slate-400"
                          }`}
                        >
                          <div className="flex flex-col items-end">
                            {hasIncoming ? (
                              <>
                                <span className="flex items-center justify-end gap-1">
                                  +{row.incoming.toLocaleString("id-ID")}
                                  <TrendingUp className="h-3.5 w-3.5" />
                                </span>
                                <span className="text-xs text-slate-405 dark:text-slate-500 font-normal mt-0.5">
                                  +{formatSecondaryQty(row.incoming, row.product.uom)}
                                </span>
                              </>
                            ) : (
                              <>
                                <span>0</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-normal mt-0.5">
                                  0 Kg
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-extrabold ${
                            hasOutgoing
                              ? "text-red-655 dark:text-red-400"
                              : "text-slate-400"
                          }`}
                        >
                          <div className="flex flex-col items-end">
                            {hasOutgoing ? (
                              <>
                                <span className="flex items-center justify-end gap-1">
                                  -{row.outgoing.toLocaleString("id-ID")}
                                  <TrendingDown className="h-3.5 w-3.5" />
                                </span>
                                <span className="text-xs text-slate-405 dark:text-slate-500 font-normal mt-0.5">
                                  -{formatSecondaryQty(row.outgoing, row.product.uom)}
                                </span>
                              </>
                            ) : (
                              <>
                                <span>0</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-normal mt-0.5">
                                  0 Kg
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-805 dark:text-slate-105">
                          <div>
                            {row.closingStock.toLocaleString("id-ID")}{" "}
                            <span className="text-[10px] text-slate-400 font-normal">
                              {row.product.uom}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 font-normal mt-0.5">
                            {formatSecondaryQty(row.closingStock, row.product.uom)}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={6}
                            className="bg-slate-50/30 dark:bg-slate-900/30 px-8 py-4 border-b border-slate-100 dark:border-slate-800/80"
                          >
                            <div className="space-y-6">
                              {row.locations.map((loc: any, locIdx: number) => {
                                const hasLocIn = loc.inOperations && loc.inOperations.length > 0;
                                const hasLocOut = loc.outOperations && loc.outOperations.length > 0;

                                return (
                                  <div
                                    key={locIdx}
                                    className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs"
                                  >
                                    {/* Location Header and Summary */}
                                    <div className="bg-slate-100/70 dark:bg-slate-800/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800">
                                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                        <MapPin className="h-4.5 w-4.5 text-blue-500 shrink-0" />
                                        {loc.locationName}
                                      </span>
                                      
                                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-350 px-2 py-0.5 rounded border border-slate-200/50 dark:border-slate-700/50">
                                          Stok Awal: {loc.openingStock.toLocaleString("id-ID")} {row.product.uom}
                                        </span>
                                        <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-100/30 dark:border-emerald-900/20">
                                          Total Masuk: +{loc.totalIn.toLocaleString("id-ID")} {row.product.uom}
                                        </span>
                                        <span className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 px-2 py-0.5 rounded border border-red-100/30 dark:border-red-900/20">
                                          Total Keluar: -{loc.totalOut.toLocaleString("id-ID")} {row.product.uom}
                                        </span>
                                        <span className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-100/30 dark:border-blue-900/20">
                                          Stok Akhir: {loc.closingStock.toLocaleString("id-ID")} {row.product.uom}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Combined Gate Operations List */}
                                    <div className="p-4 space-y-2">
                                      <h4 className="text-xs font-bold text-slate-550 dark:text-slate-400 flex items-center gap-1.5">
                                        <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                                        Daftar Transaksi Gate Operations (Masuk / Keluar)
                                      </h4>
                                      {(() => {
                                        const allOps = [
                                          ...(loc.inOperations || []),
                                          ...(loc.outOperations || []),
                                        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                                        if (allOps.length === 0) {
                                          return (
                                            <p className="text-xs text-slate-400 italic py-4 text-center">
                                              Tidak ada transaksi di lokasi ini.
                                            </p>
                                          );
                                        }

                                        return (
                                          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
                                            <table className="w-full text-left border-collapse text-xs">
                                              <thead>
                                                <tr className="bg-slate-50/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                  <th className="px-3 py-2 w-[15%]">Waktu</th>
                                                  <th className="px-3 py-2 w-[15%]">No. Tiket</th>
                                                  <th className="px-3 py-2 text-center w-[12%]">Tipe</th>
                                                  <th className="px-3 py-2 w-[22%]">Client / Partner</th>
                                                  <th className="px-3 py-2 w-[10%]">Stack</th>
                                                  <th className="px-3 py-2 w-[10%]">Status</th>
                                                  <th className="px-3 py-2 w-[10%]">Ref Dokumen</th>
                                                  <th className="px-3 py-2 text-right w-[8%]">Qty</th>
                                                  <th className="px-3 py-2 text-center w-[8%]">Detail</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {allOps.map((tx: any, txIdx: number) => {
                                                  const isIncoming = tx.cardType === "IN";
                                                  return (
                                                    <tr key={txIdx} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition">
                                                      <td className="px-3 py-2 text-slate-500 font-mono text-[10px]">
                                                        {new Date(tx.createdAt).toLocaleString("id-ID", {
                                                          day: "numeric",
                                                          month: "short",
                                                          hour: "2-digit",
                                                          minute: "2-digit",
                                                        })}
                                                      </td>
                                                      <td className="px-3 py-2 font-mono font-bold text-slate-800 dark:text-slate-300 text-[11px]">
                                                        {tx.opNumber}
                                                      </td>
                                                      <td className="px-3 py-2 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                                          isIncoming
                                                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100/40 dark:border-emerald-900/30"
                                                            : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100/40 dark:border-red-900/30"
                                                        }`}>
                                                          {isIncoming ? (
                                                            <>
                                                              <TrendingUp className="h-3 w-3" />
                                                              Masuk
                                                            </>
                                                          ) : (
                                                            <>
                                                              <TrendingDown className="h-3 w-3" />
                                                              Keluar
                                                            </>
                                                          )}
                                                        </span>
                                                      </td>
                                                      <td className="px-3 py-2 text-slate-650 dark:text-slate-350 text-[11px]">
                                                        {tx.type === "ADJUSTMENT_IN" || tx.type === "ADJUSTMENT_OUT" ? (
                                                          <div className="space-y-0.5">
                                                            <div className="font-semibold text-blue-600 dark:text-blue-455">
                                                              {tx.clientPartner || tx.driverName}
                                                            </div>
                                                            <div className="text-[9px] text-slate-400">
                                                              ERP: {tx.erpQty} | Gate: {tx.totalGateQty} (Selisih: {tx.adjustmentQty})
                                                            </div>
                                                          </div>
                                                        ) : (
                                                          <span>{tx.clientPartner || `${tx.driverName} (${tx.licensePlate})`}</span>
                                                        )}
                                                      </td>
                                                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 text-[11px]">
                                                        {tx.stack || "-"}
                                                      </td>
                                                      <td className="px-3 py-2">
                                                        {tx.type === "ADJUSTMENT_IN" || tx.type === "ADJUSTMENT_OUT" ? (
                                                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                                            tx.type === "ADJUSTMENT_IN"
                                                              ? "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border border-purple-100/40 dark:border-purple-900/30"
                                                              : "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100/40 dark:border-indigo-900/30"
                                                          }`}>
                                                            {tx.type}
                                                          </span>
                                                        ) : (
                                                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                                            tx.status === "VERIFIED"
                                                              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-455"
                                                              : "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-455"
                                                          }`}>
                                                            {tx.status}
                                                          </span>
                                                        )}
                                                      </td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                                                        {tx.referenceDocument || "-"}
                                                      </td>
                                                      <td className={`px-3 py-2 text-right font-bold text-[11px] ${
                                                        isIncoming
                                                          ? "text-emerald-650 dark:text-emerald-455"
                                                          : "text-red-655 dark:text-red-455"
                                                      }`}>
                                                        <div>
                                                          {isIncoming ? "+" : "-"}
                                                          {tx.quantity.toLocaleString("id-ID")}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5">
                                                          {isIncoming ? "+" : "-"}
                                                          {formatSecondaryQty(tx.quantity, row.product.uom)}
                                                        </div>
                                                      </td>
                                                      <td className="px-3 py-2 text-center">
                                                        {tx.type === "ADJUSTMENT_IN" || tx.type === "ADJUSTMENT_OUT" ? (
                                                          <span className="text-slate-400">-</span>
                                                        ) : (
                                                          <Link
                                                            href={`/gate-operations/${tx.uuid}`}
                                                            className="inline-flex items-center justify-center p-1 text-blue-600 dark:text-blue-455 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg transition"
                                                          >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                          </Link>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
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

"use client";

import React, { useState, useEffect } from "react";
import { useReports, useReportDetail } from "@/hooks/useReports";
import { useProducts } from "@/hooks/useInventory";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import {
  BarChart3,
  Calendar,
  FileText,
  Download,
  Search,
  Filter,
  ArrowRightLeft,
  X,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  TrendingUp,
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
            Pantau pergerakan saldo awal, stok masuk, keluar, dan saldo akhir
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
            className="flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm disabled:opacity-50"
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
        <div className="flex items-center gap-2 font-bold text-sm text-slate-700 dark:text-slate-350">
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
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
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
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
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
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
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
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
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
                <th className="px-6 py-4 w-[20%]">Tanggal</th>
                <th className="px-6 py-4 w-[40%]">Produk</th>
                <th className="px-6 py-4 text-right w-[20%]">
                  Incoming (Masuk)
                </th>
                <th className="px-6 py-4 text-right w-[20%]">
                  Outgoing (Keluar)
                </th>
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
                  </tr>
                ))
              ) : reportData.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
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
                        className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800/80 transition text-slate-700 dark:text-slate-350 cursor-pointer ${
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
                        <td
                          className={`px-6 py-4 text-right font-extrabold ${
                            hasIncoming
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-slate-400 dark:text-slate-600"
                          }`}
                        >
                          {hasIncoming ? (
                            <span className="flex items-center justify-end gap-1.5">
                              +{row.incoming.toLocaleString("id-ID")}
                              <TrendingUp className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-extrabold ${
                            hasOutgoing
                              ? "text-red-655 dark:text-red-400"
                              : "text-slate-400 dark:text-slate-600"
                          }`}
                        >
                          {hasOutgoing ? (
                            <span className="flex items-center justify-end gap-1.5">
                              -{row.outgoing.toLocaleString("id-ID")}
                              <TrendingDown className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            "0"
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={4}
                            className="bg-slate-50/30 dark:bg-slate-900/30 px-8 py-4 border-b border-slate-100 dark:border-slate-800/80"
                          >
                            <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                              <div className="bg-slate-100/70 dark:bg-slate-800/50 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                                <span className="font-bold text-slate-700 dark:text-slate-350 text-xs uppercase tracking-wider">
                                  Rincian Transaksi Truk Gerbang (Gate Operations)
                                </span>
                              </div>
                              {row.transactions && row.transactions.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50/30 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        <th className="px-5 py-3">Nomor Operasi</th>
                                        <th className="px-5 py-3 text-center">Tipe</th>
                                        <th className="px-5 py-3">Driver & Plat</th>
                                        <th className="px-5 py-3">Dokumen Referensi</th>
                                        <th className="px-5 py-3 text-right">Kuantitas</th>
                                        <th className="px-5 py-3 text-center">Aksi</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                      {row.transactions.map((tx: any, txIdx: number) => (
                                        <tr
                                          key={txIdx}
                                          className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10 transition bg-white dark:bg-slate-900/40"
                                        >
                                          <td className="px-5 py-3 font-mono font-bold text-slate-800 dark:text-slate-250">
                                            {tx.opNumber}
                                          </td>
                                          <td className="px-5 py-3 text-center">
                                            <span
                                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                tx.cardType === "IN"
                                                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"
                                                  : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30"
                                              }`}
                                            >
                                              {tx.cardType === "IN" ? "Masuk" : "Keluar"}
                                            </span>
                                          </td>
                                          <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                                            <strong className="font-bold">{tx.driverName}</strong> ({tx.licensePlate})
                                          </td>
                                          <td className="px-5 py-3">
                                            <span className="font-mono text-[10px] text-slate-650 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/40 dark:border-slate-700/40">
                                              {tx.referenceDocument}
                                            </span>
                                          </td>
                                          <td
                                            className={`px-5 py-3 text-right font-bold text-sm ${
                                              tx.cardType === "IN"
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-red-655 dark:text-red-400"
                                            }`}
                                          >
                                            {tx.cardType === "IN" ? "+" : "-"}
                                            {tx.quantity.toLocaleString("id-ID")}{" "}
                                            <span className="text-slate-400 font-normal text-[10px] ml-0.5">
                                              {row.product.uom}
                                            </span>
                                          </td>
                                          <td className="px-5 py-3 text-center">
                                            {tx.uuid ? (
                                              <Link
                                                href={`/gate-operations/${tx.uuid}`}
                                                className="inline-flex items-center justify-center p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition cursor-pointer"
                                                title="Lihat Detail Operasi Gerbang"
                                              >
                                                <ExternalLink className="h-4.5 w-4.5" />
                                              </Link>
                                            ) : (
                                              <span className="text-slate-350">-</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-450 italic p-4 text-center">
                                  Tidak ada data transaksi terperinci.
                                </p>
                              )}
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

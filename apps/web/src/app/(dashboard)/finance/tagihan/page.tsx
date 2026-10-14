"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Plus,
  Calendar,
  Filter,
  Layers,
  DollarSign,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Eye,
  FileText,
  Receipt,
  FileCheck2,
  FolderOpen,
  ReceiptText,
  Tag,
  ArrowUpDown,
} from "lucide-react";
import { useTagihans, useMasterTagihanStatuses } from "@/hooks/useTagihan";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthStore } from "@/store/auth";

export default function TagihanListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const { activeWarehouse } = useAuthStore();

  // Read URL query parameters
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 10;
  const relatedDocumentNumber = searchParams.get("relatedDocumentNumber") || "";
  const documentNumber = searchParams.get("documentNumber") || "";
  const type = searchParams.get("type") || "";
  const statusUuid = searchParams.get("statusUuid") || "";
  const productName = searchParams.get("productName") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const sortBy = searchParams.get("sortBy") || "tagihanDate";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

  // Search input state with debouncing
  const [searchInput, setSearchInput] = useState(relatedDocumentNumber);
  const debouncedSearch = useDebounce(searchInput, 400);

  const { statuses } = useMasterTagihanStatuses();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.get("relatedDocumentNumber") || "";
    if (debouncedSearch === current) return;

    if (debouncedSearch) {
      params.set("relatedDocumentNumber", debouncedSearch);
    } else {
      params.delete("relatedDocumentNumber");
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }, [debouncedSearch, searchParams, pathname, router]);

  useEffect(() => {
    setSearchInput(relatedDocumentNumber);
  }, [relatedDocumentNumber]);

  // SWR Hook
  const { tagihansData, isLoading } = useTagihans({
    page,
    limit,
    relatedDocumentNumber: relatedDocumentNumber || undefined,
    documentNumber: documentNumber || undefined,
    type: type || undefined,
    statusUuid: statusUuid || undefined,
    productName: productName || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    sortBy: sortBy || undefined,
    sortOrder: sortOrder || undefined,
  });

  const updateQueryParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const getTypeBadge = (t: string) => {
    switch (t) {
      case "LOADING":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-blue-400">
            LOADING (OUT)
          </span>
        );
      case "UNLOADING":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-400">
            UNLOADING (IN)
          </span>
        );
      case "REBAGGING":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-400">
            REBAGGING
          </span>
        );
      case "REPROSES":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-400">
            REPROSES
          </span>
        );
      case "OVERSTAPEL":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/30 dark:border-purple-900/40 dark:text-purple-400">
            OVERSTAPEL (INT)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-50 text-slate-700 border border-slate-200">
            {t || "-"}
          </span>
        );
    }
  };

  const getStatusBadge = (st: any) => {
    if (!st) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          Draft
        </span>
      );
    }
    const color = st.color || "blue";
    const colorClasses: Record<string, string> = {
      slate: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
      blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900",
      emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
      green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
      amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
      purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900",
      red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
    };

    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
          colorClasses[color] || colorClasses.blue
        }`}
      >
        {st.name}
      </span>
    );
  };

  const summary = tagihansData?.summary || {
    totalDocuments: 0,
    totalAmount: 0,
    countByType: {},
    countByStatus: {},
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
            <ReceiptText className="h-8 w-8 text-emerald-600 mr-3" />
            Manajemen Tagihan
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Kelola tagihan jasa pergudangan, dokumen ERP & Non-Commodity untuk gudang:{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {activeWarehouse?.name || "Semua Gudang"}
            </span>
          </p>
        </div>

        <Link
          href="/finance/tagihan/create"
          className="inline-flex items-center px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition cursor-pointer self-start sm:self-auto gap-2"
        >
          <Plus className="h-4 w-4" />
          Buat Tagihan Baru
        </Link>
      </div>

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tagihan (Rp) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 border border-emerald-100/40 dark:border-emerald-900/30">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Total Nilai Tagihan
            </span>
            <strong className="text-lg font-black text-slate-800 dark:text-slate-100 font-mono">
              {formatCurrency(summary.totalAmount)}
            </strong>
          </div>
        </div>

        {/* Total Dokumen Tagihan */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600 border border-blue-100/40 dark:border-blue-900/30">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Total Dokumen Tagihan
            </span>
            <strong className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {summary.totalDocuments.toLocaleString("id-ID")}
            </strong>
          </div>
        </div>

        {/* Loading & Unloading */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl text-purple-600 border border-purple-100/40 dark:border-purple-900/30">
            <FileCheck2 className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Loading / Unloading
            </span>
            <strong className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {((summary.countByType?.LOADING || 0) + (summary.countByType?.UNLOADING || 0)).toLocaleString("id-ID")}
            </strong>
          </div>
        </div>

        {/* Rebagging & Reproses */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-600 border border-amber-100/40 dark:border-amber-900/30">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Rebagging / Reproses / INT
            </span>
            <strong className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {(
                (summary.countByType?.REBAGGING || 0) +
                (summary.countByType?.REPROSES || 0) +
                (summary.countByType?.OVERSTAPEL || 0)
              ).toLocaleString("id-ID")}
            </strong>
          </div>
        </div>
      </div>

      {/* Filter and Queries Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
          <Filter className="h-4.5 w-4.5 mr-2 text-emerald-600" />
          Filter & Pencarian Tagihan
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Document Related Filter (Unified across 4 document types) */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Document Related (No. Dokumen/SDI & ERP & PO & Manual)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari No. Tagihan, Dokumen ERP, PO, atau Dokumen Manual..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Tipe Tagihan
            </label>
            <select
              value={type}
              onChange={(e) => updateQueryParam("type", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">SEMUA TIPE</option>
              <option value="LOADING">LOADING (OUT)</option>
              <option value="UNLOADING">UNLOADING (IN)</option>
              <option value="REBAGGING">REBAGGING (IN/OUT)</option>
              <option value="REPROSES">REPROSES (IN/OUT)</option>
              <option value="OVERSTAPEL">OVERSTAPEL (INT)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Status Tagihan
            </label>
            <select
              value={statusUuid}
              onChange={(e) => updateQueryParam("statusUuid", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">SEMUA STATUS</option>
              {statuses.map((s) => (
                <option key={s.uuid} value={s.uuid}>
                  {s.name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: No Dokumen specific, Commodity/Product, and Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* Specific No. Dokumen / SDI */}
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              No. Dokumen / SDI Tagihan
            </label>
            <input
              type="text"
              placeholder="Contoh: SDI/2026/..."
              value={documentNumber}
              onChange={(e) => updateQueryParam("documentNumber", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          {/* Commodity / Product */}
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Komoditas / Produk
            </label>
            <input
              type="text"
              placeholder="Contoh: Beras, Gula, Jagung..."
              value={productName}
              onChange={(e) => updateQueryParam("productName", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Tanggal Awal
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => updateQueryParam("startDate", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Tanggal Akhir
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => updateQueryParam("endDate", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tagihan Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full text-left border-collapse text-xs min-w-[950px]">
            <thead className="bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4 w-[16%]">Tanggal / Waktu</th>
                <th className="px-6 py-4 w-[14%]">Tipe</th>
                <th className="px-6 py-4 w-[24%]">No. Dokumen / SDI</th>
                <th className="px-6 py-4 text-right w-[18%]">Total Tagihan</th>
                <th className="px-6 py-4 text-center w-[14%]">Status</th>
                <th className="px-6 py-4 text-center w-[14%]">Detail & Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                Array.from({ length: limit }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-36"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24 ml-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div>
                    </td>
                  </tr>
                ))
              ) : !tagihansData?.data || tagihansData.data.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-16 text-center text-slate-400 dark:text-slate-500 font-semibold"
                  >
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <FolderOpen className="h-12 w-12 text-slate-300 dark:text-slate-700" />
                      <span>Tidak ada data Tagihan yang sesuai dengan filter pencarian.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                tagihansData.data.map((item: any) => (
                  <TagihanTableRow
                    key={item.uuid}
                    tagihan={item}
                    getTypeBadge={getTypeBadge}
                    getStatusBadge={getStatusBadge}
                    formatCurrency={formatCurrency}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {tagihansData?.meta && (
          <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Menampilkan {tagihansData.data.length} dari {tagihansData.meta.total} dokumen Tagihan
            </span>

            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                className="p-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {page} / {tagihansData.meta.totalPages || 1}
              </span>
              <button
                disabled={page >= tagihansData.meta.totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="p-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface TagihanTableRowProps {
  tagihan: any;
  getTypeBadge: (t: string) => React.ReactNode;
  getStatusBadge: (st: any) => React.ReactNode;
  formatCurrency: (amount: number) => string;
}

function TagihanTableRow({
  tagihan,
  getTypeBadge,
  getStatusBadge,
  formatCurrency,
}: TagihanTableRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formattedDate = tagihan.tagihanDate
    ? new Date(tagihan.tagihanDate).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  const erpDocs = tagihan.documentReferences || [];
  const poDocs = tagihan.nonCommodityDocuments || [];
  const manualDocs = tagihan.manualDocuments || [];
  const totalRelated = erpDocs.length + poDocs.length + manualDocs.length;

  return (
    <>
      <tr
        className={`hover:bg-slate-50/70 dark:hover:bg-slate-850/50 border-b border-slate-100 dark:border-slate-800 transition ${
          isExpanded ? "bg-slate-50/40 dark:bg-slate-900/60" : ""
        }`}
      >
        <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-400">
          {formattedDate}
        </td>

        <td className="px-6 py-4">{getTypeBadge(tagihan.type)}</td>

        <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              title="Lihat Dokumen Terkait"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            <span className="font-mono text-emerald-700 dark:text-emerald-400 select-all">
              {tagihan.documentNumber}
            </span>
            {totalRelated > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                {totalRelated} Dok
              </span>
            )}
          </div>
        </td>

        <td className="px-6 py-4 text-right font-mono font-black text-slate-900 dark:text-slate-100">
          {formatCurrency(tagihan.totalAmount)}
        </td>

        <td className="px-6 py-4 text-center">{getStatusBadge(tagihan.status)}</td>

        <td className="px-6 py-4 text-center">
          <Link
            href={`/finance/tagihan/${tagihan.uuid}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 transition font-bold text-xs"
          >
            <Eye className="h-3.5 w-3.5" />
            Detail
          </Link>
        </td>
      </tr>

      {/* Collapsible Related Documents Row */}
      {isExpanded && (
        <tr className="bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800">
          <td colSpan={6} className="px-8 py-4">
            <div className="space-y-3">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Collapsible Related Documents ({totalRelated} Dokumen Terkait)
              </h5>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. ERP Commodity Documents */}
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <FileCheck2 className="h-4 w-4 text-emerald-600" />
                      ERP Commodity ({erpDocs.length})
                    </span>
                  </div>
                  {erpDocs.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Tidak ada dokumen ERP.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {erpDocs.map((r: any) => {
                        const d = r.documentReference;
                        if (!d) return null;
                        return (
                          <div
                            key={r.uuid}
                            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850 text-[11px] border border-slate-100 dark:border-slate-800"
                          >
                            <div className="flex items-center justify-between font-mono font-bold text-slate-800 dark:text-slate-200">
                              <span>{d.documentNumber}</span>
                              <span className="text-[10px] uppercase font-semibold text-emerald-600">
                                {d.pickingTypeCode}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-slate-500 mt-0.5">
                              <span className="truncate max-w-[150px]">{d.partnerName || "-"}</span>
                              <span>Qty: {d.totalQuantity}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Non-Commodity Documents */}
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Receipt className="h-4 w-4 text-amber-600" />
                      Non-Commodity PO ({poDocs.length})
                    </span>
                  </div>
                  {poDocs.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Tidak ada dokumen PO.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {poDocs.map((r: any) => {
                        const po = r.documentPurchaseOrder;
                        if (!po) return null;
                        return (
                          <div
                            key={r.uuid}
                            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850 text-[11px] border border-slate-100 dark:border-slate-800"
                          >
                            <div className="flex items-center justify-between font-mono font-bold text-slate-800 dark:text-slate-200">
                              <span>{po.documentNumber}</span>
                              <span className="text-[10px] text-amber-600 uppercase">
                                {po.state}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-slate-500 mt-0.5">
                              <span className="truncate max-w-[140px]">{po.partner || "-"}</span>
                              <span>{formatCurrency(po.amountTotal)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Manual Documents */}
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-purple-600" />
                      Manual / Text ({manualDocs.length})
                    </span>
                  </div>
                  {manualDocs.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Tidak ada dokumen manual.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {manualDocs.map((m: any) => (
                        <div
                          key={m.uuid}
                          className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850 text-[11px] border border-slate-100 dark:border-slate-800"
                        >
                          <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {m.documentNumber}
                          </p>
                          {m.description && (
                            <p className="text-slate-500 mt-0.5 text-[10px] line-clamp-1">
                              {m.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

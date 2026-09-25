"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useNonCommodityOrders } from "@/hooks/useNonCommodityOrders";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  FileSpreadsheet,
  AlertTriangle,
  FolderOpen,
  Calendar,
  Settings2,
  DollarSign,
  CheckCircle2,
  Clock,
  Layers,
  FileCheck,
  Eye,
  ArrowUpDown,
} from "lucide-react";
import Link from "next/link";

export default function NonCommodityDocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const { activeWarehouse, user, hasPermission } = useAuthStore();

  // Read URL query parameters
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 10;
  const search = searchParams.get("search") || "";
  const state = searchParams.get("state") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const sortBy = searchParams.get("sortBy") || "dateOrder";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

  // Debounced search
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 400);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const currentSearch = params.get("search") || "";
    if (debouncedSearch === currentSearch) return;

    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }, [debouncedSearch, searchParams, pathname, router]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // SWR Hook
  const { ordersData, isLoading, refresh, forceSync } = useNonCommodityOrders({
    page,
    limit,
    search: search || undefined,
    state: state || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    sortBy: sortBy || undefined,
    sortOrder: sortOrder || undefined,
  });

  const [isSyncing, setIsSyncing] = useState(false);

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

  const handleForceSync = async () => {
    setIsSyncing(true);
    const toastId = toast.loading("Memulai sinkronisasi PO Non Commodity dari Odoo...");
    try {
      const res = await forceSync();
      if (res?.message?.includes("already in progress")) {
        toast.info("Sinkronisasi PO Non Commodity sedang berjalan.", { id: toastId });
      } else {
        toast.success("Proses sinkronisasi PO Non Commodity telah dipicu!", { id: toastId });
      }
      refresh();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Gagal sinkronisasi PO Non Commodity.",
        { id: toastId },
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusColor = (st: string) => {
    switch (st?.toLowerCase()) {
      case "purchase":
      case "done":
        return "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400";
      case "to approve":
      case "waiting":
        return "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400";
      case "draft":
        return "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400";
      case "sent":
        return "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400";
      case "cancel":
        return "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400";
      default:
        return "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400";
    }
  };

  const getStatusText = (st: string) => {
    switch (st?.toLowerCase()) {
      case "purchase":
        return "Purchase Order";
      case "done":
        return "Done / Locked";
      case "to approve":
        return "To Approve";
      case "draft":
        return "Draft";
      case "sent":
        return "RFQ Sent";
      case "cancel":
        return "Cancelled";
      default:
        return st || "-";
    }
  };

  const formatCurrency = (amount: number, currency: string = "IDR") => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currency || "IDR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const summary = ordersData?.summary || {
    totalDocuments: 0,
    totalAmount: 0,
    countApproved: 0,
    countWaiting: 0,
    countDraft: 0,
    lastSyncAt: null,
    lastOffset: 0,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
            <FileSpreadsheet className="h-8 w-8 text-purple-600 mr-3" />
            Dokumen Non Commodity (Purchase Order)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Manajemen penagihan & dokumen PO Non Commodity Odoo untuk gudang:{" "}
            <span className="font-semibold text-purple-600 dark:text-purple-400">
              {activeWarehouse?.name || "Semua Gudang"}
            </span>
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => refresh()}
            disabled={isLoading}
            className="flex items-center px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-750 transition text-xs cursor-pointer shadow-sm min-h-[38px]"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>

          {(user?.role === "SUPER_ADMIN" ||
            user?.role === "WAREHOUSE_ADMIN" ||
            (hasPermission &&
              hasPermission("update", "DocumentPurchaseOrder"))) && (
            <button
              type="button"
              onClick={handleForceSync}
              disabled={isSyncing}
              className="flex items-center justify-center bg-purple-600 hover:bg-purple-500 disabled:bg-purple-400 text-white font-bold px-4 py-2 rounded-xl shadow-md hover:shadow-purple-500/10 active:scale-[0.98] transition cursor-pointer text-xs min-h-[38px]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? "animate-spin" : ""}`}
              />
              Force Sync
            </button>
          )}
        </div>
      </div>

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Dokumen */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl text-purple-600 border border-purple-100/40 dark:border-purple-900/30">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Total Dokumen PO
            </span>
            <strong className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {summary.totalDocuments.toLocaleString("id-ID")}
            </strong>
          </div>
        </div>

        {/* Total Nilai (IDR) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 border border-emerald-100/40 dark:border-emerald-900/30">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Total Nilai PO
            </span>
            <strong className="text-lg font-black text-slate-800 dark:text-slate-100">
              {formatCurrency(summary.totalAmount)}
            </strong>
          </div>
        </div>

        {/* Status Approved */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600 border border-blue-100/40 dark:border-blue-900/30">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Status Approved
            </span>
            <strong className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {summary.countApproved.toLocaleString("id-ID")}
            </strong>
          </div>
        </div>

        {/* Status Waiting / Draft */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-600 border border-amber-100/40 dark:border-amber-900/30">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Waiting / Draft
            </span>
            <strong className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {(summary.countWaiting + summary.countDraft).toLocaleString("id-ID")}
            </strong>
          </div>
        </div>
      </div>

      {/* Filter and Queries Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
          <Settings2 className="h-4.5 w-4.5 mr-2 text-purple-600" />
          Filter & Pencarian Dokumen PO
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Input */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Cari No. Dokumen / Partner / Ref
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Contoh: PO/2024/..., PT Adhi, dsb."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-slate-850 transition"
              />
            </div>
          </div>

          {/* State Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Status PO
            </label>
            <select
              value={state}
              onChange={(e) => updateQueryParam("state", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-slate-850 cursor-pointer"
            >
              <option value="">SEMUA STATUS</option>
              <option value="draft">DRAFT</option>
              <option value="sent">RFQ SENT</option>
              <option value="to approve">TO APPROVE</option>
              <option value="purchase">PURCHASE ORDER</option>
              <option value="done">LOCKED / DONE</option>
              <option value="cancel">CANCELLED</option>
            </select>
          </div>

          {/* Page Limit */}
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Baris Per Halaman
            </label>
            <select
              value={limit}
              onChange={(e) => updateQueryParam("limit", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value={10}>10 Baris</option>
              <option value={25}>25 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
            </select>
          </div>
        </div>

        {/* Row 2: Date Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Tanggal Order Awal
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => updateQueryParam("startDate", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500 focus:bg-white cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Tanggal Order Akhir
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => updateQueryParam("endDate", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500 focus:bg-white cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Orders Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full text-left border-collapse table-layout-fixed min-w-[1050px]">
            <thead className="bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4 w-[16%]">No. Dokumen (PO)</th>
                <th className="px-6 py-4 w-[18%]">Mitra / Partner</th>
                <th className="px-6 py-4 w-[12%]">Partner Ref</th>
                <th className="px-6 py-4 text-center w-[11%]">Tgl Order</th>
                <th className="px-6 py-4 text-center w-[11%]">Tgl Approve</th>
                <th className="px-6 py-4 text-right w-[14%]">Amount Total</th>
                <th className="px-6 py-4 text-center w-[10%]">Status</th>
                <th className="px-6 py-4 text-center w-[8%]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {isLoading ? (
                Array.from({ length: limit }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-36"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24 ml-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4.5 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12 mx-auto"></div>
                    </td>
                  </tr>
                ))
              ) : !ordersData?.data || ordersData.data.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-16 text-center text-slate-400 dark:text-slate-500 font-semibold"
                  >
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <FolderOpen className="h-12 w-12 text-slate-300 dark:text-slate-700" />
                      <span>
                        Tidak ada data dokumen PO Non Commodity ditemukan.
                        Gunakan tombol Force Sync di atas atau cek konfigurasi kredensial Odoo Non Commodity.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                ordersData.data.map((order: any) => (
                  <PurchaseOrderRow
                    key={order.uuid}
                    order={order}
                    getStatusColor={getStatusColor}
                    getStatusText={getStatusText}
                    formatCurrency={formatCurrency}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {ordersData?.meta && (
          <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Menampilkan {ordersData.data.length} dari {ordersData.meta.total}{" "}
              dokumen PO Non Commodity
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
                {page} / {ordersData.meta.totalPages || 1}
              </span>
              <button
                disabled={page >= ordersData.meta.totalPages}
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

interface PurchaseOrderRowProps {
  order: any;
  getStatusColor: (st: string) => string;
  getStatusText: (st: string) => string;
  formatCurrency: (amount: number, curr?: string) => string;
}

function PurchaseOrderRow({
  order,
  getStatusColor,
  getStatusText,
  formatCurrency,
}: PurchaseOrderRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formattedDateOrder = order.dateOrder
    ? new Date(order.dateOrder).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "-";

  const formattedDateApprove = order.dateApprove
    ? new Date(order.dateApprove).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "-";

  return (
    <>
      <tr
        onClick={() => setIsExpanded(!isExpanded)}
        className={`hover:bg-slate-50/70 dark:hover:bg-slate-850/50 border-b border-slate-100 dark:border-slate-800 transition cursor-pointer select-none ${
          isExpanded ? "bg-slate-50/30 dark:bg-slate-900/60" : ""
        }`}
      >
        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
          <div className="flex items-center space-x-2">
            <div className="p-0.5 rounded hover:bg-slate-200/80 dark:hover:bg-slate-750 transition">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 text-slate-500 shrink-0" />
              )}
            </div>
            <span className="font-mono select-all truncate text-purple-700 dark:text-purple-400">
              {order.documentNumber}
            </span>
          </div>
        </td>
        <td
          className="px-6 py-4 font-semibold text-slate-750 dark:text-slate-300 truncate max-w-[220px]"
          title={order.partner || ""}
        >
          {order.partner || "-"}
        </td>
        <td className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 truncate font-mono">
          {order.partnerRef || "-"}
        </td>
        <td className="px-6 py-4 text-center font-medium text-slate-600 dark:text-slate-400">
          {formattedDateOrder}
        </td>
        <td className="px-6 py-4 text-center font-medium text-slate-600 dark:text-slate-400">
          {formattedDateApprove}
        </td>
        <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
          {formatCurrency(order.amountTotal, order.currencyName)}
        </td>
        <td className="px-6 py-4 text-center">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${getStatusColor(
              order.state,
            )}`}
          >
            {getStatusText(order.state)}
          </span>
        </td>
        <td
          className="px-6 py-4 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Link
            href={`/finance/non-commodity-documents/${order.uuid}`}
            className="inline-flex items-center px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold rounded-lg border border-purple-200 dark:border-purple-800 transition"
          >
            Detail
          </Link>
        </td>
      </tr>

      {/* Expanded Sub-table previewing product lines */}
      {isExpanded && (
        <tr>
          <td
            colSpan={8}
            className="bg-slate-50/40 dark:bg-slate-900/30 px-10 py-5 border-b border-slate-200 dark:border-slate-800"
          >
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <span>Rincian Produk & Pos Anggaran ({order.documentNumber})</span>
              </div>

              {!order.products || order.products.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-2">
                  Tidak ada rincian baris produk dalam dokumen PO ini.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/60 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        <th className="px-5 py-3 w-[40%]">Nama Produk</th>
                        <th className="px-5 py-3 w-[25%]">Pos Anggaran (Budget Activity)</th>
                        <th className="px-5 py-3 text-right w-[10%]">Qty</th>
                        <th className="px-5 py-3 text-center w-[10%]">UoM</th>
                        <th className="px-5 py-3 text-right w-[15%]">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                      {order.products.map((p: any, idx: number) => (
                        <tr
                          key={p.uuid || idx}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition"
                        >
                          <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200">
                            {p.productName}
                          </td>
                          <td className="px-5 py-3 font-mono text-[11px] text-purple-700 dark:text-purple-400">
                            {p.budgetActivityName || "-"}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                            {p.productQty?.toLocaleString("id-ID")}
                          </td>
                          <td className="px-5 py-3 text-center font-bold text-slate-500 uppercase">
                            {p.productUom || "Unit"}
                          </td>
                          <td className="px-5 py-3 text-right font-bold font-mono text-slate-900 dark:text-slate-100">
                            {formatCurrency(p.priceTotal, order.currencyName)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

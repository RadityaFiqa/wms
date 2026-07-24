"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { usePendingPickups } from "@/hooks/useErpDocuments";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Layers,
  Settings2,
  CheckCircle2,
  Clock,
  Truck,
  ArrowRight,
  Info,
} from "lucide-react";
import Link from "next/link";

export default function PendingPickupPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeWarehouse } = useAuthStore();

  // URL Query States
  const search = searchParams.get("search") || "";
  const partner = searchParams.get("partner") || "";
  const scheduledDate = searchParams.get("scheduledDate") || "";
  const state = searchParams.get("state") || "";
  const status = searchParams.get("status") || "";
  const pageStr = searchParams.get("page") || "1";
  const limitStr = searchParams.get("limit") || "10";

  const page = parseInt(pageStr, 10);
  const limit = parseInt(limitStr, 10);

  // Debounced input states
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 400);

  const [partnerInput, setPartnerInput] = useState(partner);
  const debouncedPartner = useDebounce(partnerInput, 400);

  // Expanded products state
  const [expandedProductIds, setExpandedProductIds] = useState<number[]>([]);
  // Expanded nested documents state
  const [expandedDocUuids, setExpandedDocUuids] = useState<string[]>([]);

  // Sync inputs with URL changes
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    setPartnerInput(partner);
  }, [partner]);

  // Sync debounced search to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const currentSearch = params.get("search") || "";
    if (debouncedSearch === currentSearch) {
      return;
    }

    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }, [debouncedSearch, searchParams, pathname, router]);

  // Sync debounced partner to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const currentPartner = params.get("partner") || "";
    if (debouncedPartner === currentPartner) {
      return;
    }

    if (debouncedPartner) {
      params.set("partner", debouncedPartner);
    } else {
      params.delete("partner");
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }, [debouncedPartner, searchParams, pathname, router]);

  const { pendingPickupsData, error, isLoading, refresh } = usePendingPickups({
    search,
    partner,
    scheduledDate,
    state,
    status,
    page,
    limit,
  });

  const handleFilterChange = (key: string, value: string) => {
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

  const handleRefresh = async () => {
    try {
      await refresh();
      toast.success("Data pending Operation berhasil diperbarui");
    } catch (err) {
      toast.error("Gagal memperbarui data pending Operation");
    }
  };

  const toggleExpandProduct = (productId: number) => {
    setExpandedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleExpandDoc = (docUuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDocUuids((prev) =>
      prev.includes(docUuid)
        ? prev.filter((uuid) => uuid !== docUuid)
        : [...prev, docUuid]
    );
  };

  const getStatusBadgeClass = (statusStr: string) => {
    if (statusStr === "Not Picked") {
      return "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400";
    }
    return "bg-amber-50 dark:bg-amber-950/20 border-amber-250 dark:border-amber-900/40 text-amber-700 dark:text-amber-400";
  };

  const getStateText = (stateStr: string) => {
    switch (stateStr.toLowerCase()) {
      case "assigned":
        return "Ready / Assigned";
      case "confirmed":
        return "Confirmed";
      default:
        return stateStr;
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const products = pendingPickupsData?.products || [];
  const summary = pendingPickupsData?.summary || {
    totalPendingDocuments: 0,
    totalPendingProducts: 0,
    totalPendingPrimaryQty: [],
    totalPendingSecondaryQty: [],
    completionRate: 0,
  };
  const pagination = pendingPickupsData?.pagination || {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
            <Clock className="h-8 w-8 text-blue-600 mr-3 animate-pulse" />
            Pending Operation
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Monitor produk yang masih pending dan buat Gate Operation lanjutan untuk dokumen ERP terkait di gudang:{" "}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {activeWarehouse?.name || "Belum Dipilih"}
            </span>
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm transition disabled:opacity-50 select-none cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filter panel (Nama Produk saja) */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari Nama Produk..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      {/* Product List Table (Main List) */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Memuat data pending Operation...
          </p>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-4">
          <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-full border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-450 animate-pulse" />
          </div>
          <div className="max-w-md">
            <h4 className="text-lg font-bold text-slate-850 dark:text-white">
              Tidak ada Pending Operation
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Tidak ada Pending Operation. Seluruh Document Reference telah selesai diproses.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto relative">
              <table className="w-full text-left border-collapse table-layout-fixed min-w-[1000px]">
                <thead className="bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4 w-[50%]">Product</th>
                    <th className="px-6 py-4 text-center w-[12%]">Pending Docs</th>
                    <th className="px-6 py-4 text-right w-[11%]">ERP Qty</th>
                    <th className="px-6 py-4 text-right w-[11%]">Picked Qty</th>
                    <th className="px-6 py-4 text-right w-[12%] text-amber-700 dark:text-amber-450 bg-amber-50/10 dark:bg-amber-955/5">
                      Remaining Qty
                    </th>
                    <th className="px-6 py-4 text-center w-[4%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {products.map((prod: any) => {
                    const isExpanded = expandedProductIds.includes(prod.productId);

                    return (
                      <React.Fragment key={prod.productId}>
                        {/* Main Product Row */}
                        <tr
                          onClick={() => toggleExpandProduct(prod.productId)}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-850/50 border-b border-slate-100 dark:border-slate-800 transition cursor-pointer select-none ${
                            isExpanded ? "bg-slate-50/30 dark:bg-slate-900/60" : ""
                          }`}
                        >
                          <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                            <div className="flex items-center space-x-2">
                              <div className="p-0.5 rounded hover:bg-slate-200/80 dark:hover:bg-slate-750 transition">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-slate-550 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-550 shrink-0" />
                                )}
                              </div>
                              <span className="truncate">{prod.productName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-blue-655 dark:text-blue-450">
                            <span className="bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg border border-blue-100 dark:border-blue-900/30">
                              {prod.pendingDocumentsCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-medium">
                            <div>
                              {prod.erpQuantityPrimary.toLocaleString("id-ID")}{" "}
                              <span className="text-[10px] text-slate-400 font-normal uppercase">{prod.uom}</span>
                            </div>
                            {prod.erpQuantitySecondary !== null && (
                              <div className="text-[10px] text-slate-450 dark:text-slate-555 font-normal mt-0.5">
                                ({prod.erpQuantitySecondary.toLocaleString("id-ID")} {prod.secondaryUom})
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-medium">
                            <div>
                              {prod.pickedQuantityPrimary.toLocaleString("id-ID")}{" "}
                              <span className="text-[10px] text-slate-400 font-normal uppercase">{prod.uom}</span>
                            </div>
                            {prod.pickedQuantitySecondary !== null && (
                              <div className="text-[10px] text-slate-450 dark:text-slate-555 font-normal mt-0.5">
                                ({prod.pickedQuantitySecondary.toLocaleString("id-ID")} {prod.secondaryUom})
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-extrabold text-amber-700 dark:text-amber-350 bg-amber-50/10 dark:bg-amber-955/5">
                            <div>
                              {prod.remainingQuantityPrimary.toLocaleString("id-ID")}{" "}
                              <span className="text-[10px] text-amber-500 font-bold uppercase">{prod.uom}</span>
                            </div>
                            {prod.remainingQuantitySecondary !== null && (
                              <div className="text-[10px] text-amber-600/80 dark:text-amber-400/85 font-semibold mt-0.5">
                                ({prod.remainingQuantitySecondary.toLocaleString("id-ID")} {prod.secondaryUom})
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {/* Empty column aligned with th */}
                          </td>
                        </tr>

                        {/* Expandable Product Details Row (Document List) */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="px-6 py-5 bg-slate-50/30 dark:bg-slate-900/50 border-t border-b border-slate-200 dark:border-slate-800">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    Associated Pending Documents
                                  </h4>
                                  <span className="text-[10px] font-semibold text-slate-405">
                                    *Hanya menampilkan dokumen yang masih memiliki sisa produk ini
                                  </span>
                                </div>

                                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                                  <table className="w-full text-left border-collapse min-w-[900px] table-layout-fixed">
                                    <thead>
                                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        <th className="px-5 py-3 w-[25%]">Document Number</th>
                                        <th className="px-5 py-3 w-[25%]">Partner</th>
                                        <th className="px-5 py-3 text-right w-[14%]">ERP Qty</th>
                                        <th className="px-5 py-3 text-right w-[14%]">Picked Qty</th>
                                        <th className="px-5 py-3 text-right w-[14%] text-amber-700 dark:text-amber-450 bg-amber-50/10 dark:bg-amber-955/5">
                                          Remaining Qty
                                        </th>
                                        <th className="px-5 py-3 text-center w-[8%]">Status</th>
                                        <th className="px-5 py-3 text-center w-[4%]"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-105 dark:divide-slate-850 text-xs text-slate-700 dark:text-slate-350">
                                      {prod.documents.map((doc: any) => {
                                        const isDocExpanded = expandedDocUuids.includes(`${prod.productId}-${doc.uuid}`);

                                        return (
                                          <React.Fragment key={doc.uuid}>
                                            <tr
                                              onClick={(e) => toggleExpandDoc(`${prod.productId}-${doc.uuid}`, e)}
                                              className={`hover:bg-slate-50/50 dark:hover:bg-slate-850/15 border-b border-slate-100 dark:border-slate-800 transition cursor-pointer select-none ${
                                                isDocExpanded ? "bg-slate-50/20 dark:bg-slate-900/40" : ""
                                              }`}
                                            >
                                              <td className="px-5 py-3 font-bold text-slate-850 dark:text-slate-200">
                                                <div className="flex items-center space-x-2">
                                                  <div className="p-0.5 rounded hover:bg-slate-200/50 dark:hover:bg-slate-805 transition">
                                                    {isDocExpanded ? (
                                                      <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                                    ) : (
                                                      <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                                    )}
                                                  </div>
                                                  <span className="font-mono truncate">{doc.documentNumber}</span>
                                                </div>
                                              </td>
                                              <td className="px-5 py-3 font-medium text-slate-600 dark:text-slate-300 truncate">
                                                {doc.partnerName || "-"}
                                              </td>
                                              <td className="px-5 py-3 text-right font-medium">
                                                <div>
                                                  {doc.erpQuantityPrimary.toLocaleString("id-ID")}{" "}
                                                  <span className="text-[10px] text-slate-400 font-normal uppercase">{prod.uom}</span>
                                                </div>
                                                {doc.erpQuantitySecondary !== null && (
                                                  <div className="text-[10px] text-slate-400/80 font-normal mt-0.5">
                                                    ({doc.erpQuantitySecondary.toLocaleString("id-ID")} {prod.secondaryUom})
                                                  </div>
                                                )}
                                              </td>
                                              <td className="px-5 py-3 text-right font-medium">
                                                <div>
                                                  {doc.pickedQuantityPrimary.toLocaleString("id-ID")}{" "}
                                                  <span className="text-[10px] text-slate-400 font-normal uppercase">{prod.uom}</span>
                                                </div>
                                                {doc.pickedQuantitySecondary !== null && (
                                                  <div className="text-[10px] text-slate-400/80 font-normal mt-0.5">
                                                    ({doc.pickedQuantitySecondary.toLocaleString("id-ID")} {prod.secondaryUom})
                                                  </div>
                                                )}
                                              </td>
                                              <td className="px-5 py-3 text-right font-bold text-amber-700 dark:text-amber-350 bg-amber-50/10 dark:bg-amber-955/5">
                                                <div>
                                                  {doc.remainingQuantityPrimary.toLocaleString("id-ID")}{" "}
                                                  <span className="text-[10px] text-amber-500 font-bold uppercase">{prod.uom}</span>
                                                </div>
                                                {doc.remainingQuantitySecondary !== null && (
                                                  <div className="text-[10px] text-amber-600/80 dark:text-amber-400/70 font-semibold mt-0.5">
                                                    ({doc.remainingQuantitySecondary.toLocaleString("id-ID")} {prod.secondaryUom})
                                                  </div>
                                                )}
                                              </td>
                                              <td className="px-5 py-3 text-center">
                                                <span
                                                  className={`px-2 py-0.5 border rounded-full text-[9px] font-extrabold uppercase ${getStatusBadgeClass(
                                                    doc.status
                                                  )}`}
                                                >
                                                  {doc.status}
                                                </span>
                                              </td>
                                              <td className="px-5 py-3 text-center">
                                                {/* Details trigger aligned */}
                                              </td>
                                            </tr>

                                            {/* Nested Document Info and History */}
                                            {isDocExpanded && (
                                              <tr>
                                                <td colSpan={7} className="px-6 py-5 bg-slate-50/40 dark:bg-slate-900/60 border-t border-b border-slate-100 dark:border-slate-850">
                                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {/* Document Information panel */}
                                                    <div className="space-y-3">
                                                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                        <Info className="h-3.5 w-3.5 text-blue-500" />
                                                        Document Information
                                                      </h5>
                                                      <div className="grid grid-cols-2 gap-4 text-xs bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-850 rounded-xl">
                                                        <div>
                                                          <p className="text-slate-400 text-[10px]">No. Dokumen ERP</p>
                                                          <p className="font-bold text-slate-750 dark:text-slate-200 mt-0.5">
                                                            {doc.documentNumber}
                                                          </p>
                                                        </div>
                                                        <div>
                                                          <p className="text-slate-400 text-[10px]">Origin</p>
                                                          <p className="font-semibold text-slate-700 dark:text-slate-350 mt-0.5">
                                                            {doc.origin || "-"}
                                                          </p>
                                                        </div>
                                                        <div>
                                                          <p className="text-slate-400 text-[10px]">Partner</p>
                                                          <p className="font-semibold text-slate-700 dark:text-slate-350 mt-0.5">
                                                            {doc.partnerName || "-"}
                                                          </p>
                                                        </div>
                                                        <div>
                                                          <p className="text-slate-400 text-[10px]">Scheduled Date</p>
                                                          <p className="font-semibold text-slate-700 dark:text-slate-350 mt-0.5">
                                                            {formatDate(doc.scheduledDate)}
                                                          </p>
                                                        </div>
                                                        <div>
                                                          <p className="text-slate-400 text-[10px]">Driver Name</p>
                                                          <p className="font-semibold text-slate-700 dark:text-slate-350 mt-0.5">
                                                            {doc.driver || "-"}
                                                          </p>
                                                        </div>
                                                        <div>
                                                          <p className="text-slate-400 text-[10px]">License Plate</p>
                                                          <p className="font-bold text-slate-700 dark:text-slate-350 mt-0.5 uppercase">
                                                            {doc.plateNumber || "-"}
                                                          </p>
                                                        </div>
                                                        <div className="col-span-2">
                                                          <p className="text-slate-400 text-[10px]">State</p>
                                                          <p className="font-bold text-blue-600 dark:text-blue-400 mt-0.5 uppercase tracking-wide">
                                                            {getStateText(doc.state)}
                                                          </p>
                                                        </div>
                                                      </div>
                                                    </div>

                                                    {/* Pickup History panel */}
                                                    <div className="space-y-3">
                                                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                        <Clock className="h-3.5 w-3.5 text-indigo-500" />
                                                        Gate Operation History
                                                      </h5>
                                                      {doc.gateOperations.length === 0 ? (
                                                        <div className="flex items-center gap-2 p-4 bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-850 rounded-xl text-xs text-slate-450 dark:text-slate-500">
                                                          <span>Belum ada riwayat Gate Operation untuk produk ini di dokumen ini.</span>
                                                        </div>
                                                      ) : (
                                                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                                                          <table className="w-full text-left border-collapse">
                                                            <thead>
                                                              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                                <th className="px-4 py-2 font-semibold">Gate Operation</th>
                                                                <th className="px-4 py-2 font-semibold">Date</th>
                                                                <th className="px-4 py-2 font-semibold text-right">Picked Qty</th>
                                                              </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs text-slate-650 dark:text-slate-350">
                                                              {doc.gateOperations.map((op: any) => (
                                                                <tr key={op.uuid} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/10 transition">
                                                                  <td className="px-4 py-2 font-bold text-blue-600 dark:text-blue-400">
                                                                    <Link
                                                                      href={`/gate-operations/${op.uuid}`}
                                                                      className="hover:underline flex items-center gap-1 w-fit"
                                                                    >
                                                                      {op.opNumber}
                                                                      <ArrowRight className="h-3 w-3" />
                                                                    </Link>
                                                                  </td>
                                                                  <td className="px-4 py-2 text-slate-500 dark:text-slate-455">
                                                                    {formatDateTime(op.createdAt)}
                                                                  </td>
                                                                  <td className="px-4 py-2 text-right font-semibold">
                                                                    <div>
                                                                      {op.quantity.toLocaleString("id-ID")}{" "}
                                                                      <span className="text-[10px] text-slate-400 font-normal uppercase">{prod.uom}</span>
                                                                    </div>
                                                                    {op.secondaryQuantity !== null && (
                                                                      <div className="text-[9px] text-slate-450 dark:text-slate-500 font-normal mt-0.5">
                                                                        ({op.secondaryQuantity.toLocaleString("id-ID")} {prod.secondaryUom})
                                                                      </div>
                                                                    )}
                                                                  </td>
                                                                </tr>
                                                              ))}
                                                            </tbody>
                                                          </table>
                                                        </div>
                                                      )}

                                                      {/* Quick link action button */}
                                                      <div className="flex justify-end pt-2">
                                                        <Link
                                                          href={`/gate-operations/new?docRefUuid=${doc.uuid}`}
                                                          className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition select-none cursor-pointer"
                                                        >
                                                          <Truck className="h-3.5 w-3.5" />
                                                          Buat Gate Operation Lanjutan
                                                        </Link>
                                                      </div>
                                                    </div>
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

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  Menampilkan <span className="font-bold text-slate-700 dark:text-slate-350">{(page - 1) * limit + 1}</span>-
                  <span className="font-bold text-slate-700 dark:text-slate-350">
                    {Math.min(page * limit, pagination.total)}
                  </span> dari{" "}
                  <span className="font-bold text-slate-700 dark:text-slate-350">{pagination.total}</span> produk
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => handlePageChange(Math.max(1, page - 1))}
                    className="p-1.5 border border-slate-205 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4 text-slate-605" />
                  </button>
                  {Array.from({ length: pagination.totalPages }).map((_, index) => {
                    const pNum = index + 1;
                    const isActive = pNum === page;
                    return (
                      <button
                        key={pNum}
                        onClick={() => handlePageChange(pNum)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition select-none cursor-pointer ${
                          isActive
                            ? "bg-blue-600 text-white shadow-sm"
                            : "border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850"
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  })}
                  <button
                    disabled={page >= pagination.totalPages}
                    onClick={() => handlePageChange(page + 1)}
                    className="p-1.5 border border-slate-205 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4 text-slate-605" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

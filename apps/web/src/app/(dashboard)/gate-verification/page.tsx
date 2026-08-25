"use client";

import React, { useState } from "react";
import { useGate, useGateOperations } from "@/hooks/useGate";
import { useAuthStore } from "@/store/auth";
import { useDebounce } from "@/hooks/useDebounce";
import Link from "next/link";
import { toast } from "sonner";
import {
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  Calendar,
  Info,
  Clock,
  AlertTriangle,
} from "lucide-react";

const getProductDetails = (item: any) => {
  if (!item) return { sku: "-", name: "-", uom: "-" };

  const sku = item.sku || item.inventory?.sku || item.product?.sku;
  const name = item.name || item.inventory?.name || item.product?.name;
  const uom = item.uom || item.inventory?.uom || item.product?.uom;

  if (!sku || !name || !uom) {
    console.warn(
      "Warning: Product details mapping failed or incomplete for item:",
      item,
    );
  }

  return {
    sku: sku || "-",
    name: name || "-",
    uom: uom || "-",
  };
};

export default function GateVerificationListPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [cardType, setCardType] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const { activeWarehouse } = useAuthStore();
  const { bulkApprove, bulkReject, refreshList } = useGate();
  
  // Selection and submission states
  const [selectedUuids, setSelectedUuids] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [summaryData, setSummaryData] = useState<any>(null);

  // Fetch gate operations with status and date filter for verification queue
  const { data, isLoading, error } = useGateOperations({
    search: debouncedSearch || undefined,
    cardType: cardType || undefined,
    status: status || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    limit: 10,
    sortOrder: "asc",
  });

  const getCardTypeBadge = (type: string) => {
    return type === "IN" ? (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-150">
        Masuk
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-55 text-purple-700 border border-purple-150">
        Keluar
      </span>
    );
  };

  const getStatusBadge = (statusValue: string) => {
    switch (statusValue) {
      case "PENDING":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Pending
          </span>
        );
      case "VERIFIED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Verified
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            Rejected
          </span>
        );
      case "CANCELED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Canceled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {statusValue}
          </span>
        );
    }
  };

  // Derive selection helpers
  const itemsList = data?.items || [];
  const eligibleItems = itemsList.filter(
    (item: any) => item.documentReference && item.status === "PENDING"
  );
  const selectedEligibleInPage = eligibleItems.filter((item: any) =>
    selectedUuids.includes(item.uuid)
  );
  const isAllSelected =
    eligibleItems.length > 0 &&
    selectedEligibleInPage.length === eligibleItems.length;
  const isIndeterminate =
    selectedEligibleInPage.length > 0 &&
    selectedEligibleInPage.length < eligibleItems.length;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUuids((prev) => {
        const next = [...prev];
        eligibleItems.forEach((item: any) => {
          if (!next.includes(item.uuid)) {
            next.push(item.uuid);
          }
        });
        return next;
      });
    } else {
      const pageUuids = eligibleItems.map((item: any) => item.uuid);
      setSelectedUuids((prev) => prev.filter((uuid) => !pageUuids.includes(uuid)));
    }
  };

  const handleSelectRow = (uuid: string, checked: boolean) => {
    if (checked) {
      setSelectedUuids((prev) => [...prev, uuid]);
    } else {
      setSelectedUuids((prev) => prev.filter((id) => id !== uuid));
    }
  };

  const selectedItemsDetails = itemsList.filter((item: any) =>
    selectedUuids.includes(item.uuid)
  );

  const handleBulkApproveSubmit = async () => {
    setIsSubmitting(true);
    setIsApproveOpen(false);
    const toastId = toast.loading("Sedang memproses bulk approval...");
    try {
      const res = await bulkApprove({ ids: selectedUuids });
      setSummaryData({
        action: "Approve",
        successCount: res.successCount,
        failedCount: res.failedCount,
        results: res.results.map((r: any) => {
          const item = itemsList.find((i: any) => i.uuid === r.id);
          return {
            opNumber: item?.opNumber || r.id,
            success: r.success,
            message: r.message,
          };
        }),
      });
      toast.success("Bulk approval selesai diproses.", { id: toastId });
      setSelectedUuids([]);
      refreshList();
      setIsSummaryOpen(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memproses bulk approval.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkRejectSubmit = async () => {
    if (!rejectReason || rejectReason.trim() === "") {
      setRejectError("Alasan penolakan tidak boleh kosong.");
      return;
    }
    setRejectError("");
    setIsSubmitting(true);
    setIsRejectOpen(false);
    const toastId = toast.loading("Sedang memproses bulk rejection...");
    try {
      const res = await bulkReject({ ids: selectedUuids, reason: rejectReason.trim() });
      setSummaryData({
        action: "Reject",
        successCount: res.successCount,
        failedCount: res.failedCount,
        results: res.results.map((r: any) => {
          const item = itemsList.find((i: any) => i.uuid === r.id);
          return {
            opNumber: item?.opNumber || r.id,
            success: r.success,
            message: r.message,
          };
        }),
      });
      toast.success("Bulk rejection selesai diproses.", { id: toastId });
      setSelectedUuids([]);
      setRejectReason("");
      refreshList();
      setIsSummaryOpen(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memproses bulk rejection.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeWarehouse) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm space-y-4">
        <ShieldCheck className="h-12 w-12 text-slate-350 mx-auto animate-pulse" />
        <h3 className="text-lg font-bold text-slate-800">
          Gudang Aktif Belum Dipilih
        </h3>
        <p className="text-sm text-slate-505 max-w-md mx-auto">
          Silakan pilih gudang aktif terlebih dahulu di panel navigasi atas
          untuk melihat antrean verifikasi gerbang.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center">
          <ShieldCheck className="h-8 w-8 text-blue-606 mr-3 shrink-0" />
          Verifikasi Gate
        </h1>
        <p className="text-slate-500 mt-1">
          Lakukan audit dan verifikasi logistik untuk kendaraan masuk/keluar di{" "}
          {activeWarehouse.name}.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Nomor GO, Driver, Plat Nomor, atau Dokumen Referensi..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-55 border border-slate-200 text-slate-905 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition duration-200 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2 border border-slate-200 rounded-lg px-3 bg-slate-50">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={cardType}
                onChange={(e) => {
                  setCardType(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-sm text-slate-600 focus:outline-none py-1.5 cursor-pointer font-medium"
              >
                <option value="">Semua Tipe Kartu</option>
                <option value="IN">Gate In</option>
                <option value="OUT">Gate Out</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 border border-slate-200 rounded-lg px-3 bg-slate-50">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-sm text-slate-600 focus:outline-none py-1.5 cursor-pointer font-medium"
              >
                <option value="PENDING">Pending (Antrean)</option>
                <option value="CANCELED">Canceled</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
                <option value="">Semua Status</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 border border-slate-200 rounded-lg px-3 bg-slate-50">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-bold uppercase">
                Mulai:
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-sm text-slate-655 focus:outline-none py-1 cursor-pointer font-medium"
              />
            </div>

            <div className="flex items-center space-x-2 border border-slate-200 rounded-lg px-3 bg-slate-50">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-bold uppercase">
                Selesai:
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-sm text-slate-655 focus:outline-none py-1 cursor-pointer font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedUuids.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-blue-800">
              {selectedUuids.length} dokumen terpilih
            </span>
            <button
              onClick={() => setSelectedUuids([])}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
            >
              Bersihkan Pilihan
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled={isSubmitting}
              onClick={() => setIsApproveOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition flex items-center gap-1.5"
            >
              Approve
            </button>
            <button
              disabled={isSubmitting}
              onClick={() => setIsRejectOpen(true)}
              className="bg-red-600 hover:bg-red-600 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition flex items-center gap-1.5"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Queue Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <svg
              className="animate-spin h-8 w-8 text-blue-500"
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
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">
            <Info className="h-8 w-8 mx-auto mb-2" />
            Gagal mengambil data antrean verifikasi gerbang.
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Clock className="h-12 w-12 mx-auto text-slate-355 mb-4 animate-bounce" />
            <p className="text-base font-semibold text-slate-700">
              Antrean Verifikasi Kosong
            </p>
            <p className="text-sm text-slate-450 mt-1">
              Seluruh data operasi gerbang telah diverifikasi dan diaudit.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                    <th className="px-4 py-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = isIndeterminate;
                          }
                        }}
                        onChange={handleSelectAll}
                        disabled={eligibleItems.length === 0 || isSubmitting}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-4">Nomor Tiket</th>
                    <th className="px-6 py-4">Waktu</th>
                    <th className="px-6 py-4">Aksi</th>
                    <th className="px-6 py-4">Dokumen Referensi</th>
                    <th className="px-6 py-4">Klien / Partner</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {data.items.map((item: any) => (
                    <GateVerificationRow
                      key={item.uuid}
                      item={item}
                      getCardTypeBadge={getCardTypeBadge}
                      getStatusBadge={getStatusBadge}
                      search={search}
                      cardType={cardType}
                      status={status}
                      startDate={startDate}
                      endDate={endDate}
                      isSelected={selectedUuids.includes(item.uuid)}
                      onSelectChange={handleSelectRow}
                      isSubmitting={isSubmitting}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-150 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Halaman <strong>{page}</strong> dari{" "}
                  <strong>{data.totalPages}</strong> ({data.total} total
                  antrean)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer"
                  >
                    <ChevronLeft className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(data.totalPages, p + 1))
                    }
                    disabled={page === data.totalPages}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer"
                  >
                    <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Approve Confirmation Modal */}
      {isApproveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Konfirmasi Bulk Approve
            </h3>
            <p className="text-sm text-slate-550">
              Apakah Anda yakin ingin menyetujui{" "}
              <strong>{selectedUuids.length}</strong> dokumen berikut?
            </p>
            <div className="max-h-48 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs text-slate-700">
              {selectedItemsDetails.map((item: any) => (
                <div key={item.uuid} className="flex justify-between border-b border-slate-100 pb-1 last:border-b-0 last:pb-0">
                  <span className="font-mono font-bold">{item.opNumber}</span>
                  <span className="text-slate-500">{item.driverName} ({item.licensePlate})</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsApproveOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleBulkApproveSubmit}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                Setujui Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Konfirmasi Bulk Reject
            </h3>
            <p className="text-sm text-slate-550">
              Anda akan menolak <strong>{selectedUuids.length}</strong> dokumen terpilih. Harap isi alasan penolakan di bawah ini.
            </p>
            
            <div className="max-h-32 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs text-slate-700">
              {selectedItemsDetails.map((item: any) => (
                <div key={item.uuid} className="flex justify-between border-b border-slate-100 pb-1 last:border-b-0 last:pb-0">
                  <span className="font-mono font-bold">{item.opNumber}</span>
                  <span className="text-slate-500">{item.driverName}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Alasan Penolakan <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  if (e.target.value.trim() !== "") setRejectError("");
                }}
                placeholder="Tulis alasan mengapa dokumen-dokumen ini ditolak..."
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl p-3 focus:outline-none focus:border-blue-500 text-sm"
              />
              {rejectError && (
                <p className="text-xs text-red-500 font-medium">{rejectError}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setIsRejectOpen(false);
                  setRejectReason("");
                  setRejectError("");
                }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleBulkRejectSubmit}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                Tolak Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {isSummaryOpen && summaryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Hasil Bulk {summaryData.action}
            </h3>
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <div className="text-2xl font-extrabold text-emerald-700">
                  {summaryData.successCount}
                </div>
                <div className="text-xs text-emerald-600 font-bold uppercase tracking-wider mt-0.5">
                  Berhasil
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <div className="text-2xl font-extrabold text-red-700">
                  {summaryData.failedCount}
                </div>
                <div className="text-xs text-red-600 font-bold uppercase tracking-wider mt-0.5">
                  Gagal
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Detail Status Setiap Dokumen
              </span>
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                {summaryData.results.map((r: any, idx: number) => (
                  <div key={idx} className="p-3 flex items-start justify-between gap-4">
                    <span className="font-mono font-bold text-slate-700 shrink-0">{r.opNumber}</span>
                    <div className="text-right">
                      {r.success ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-150 font-semibold">
                          Berhasil
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-150 font-semibold">
                            Gagal
                          </span>
                          <p className="text-[11px] text-red-550 font-medium leading-normal">{r.message}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setIsSummaryOpen(false);
                  setSummaryData(null);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GateVerificationRow({
  item,
  getCardTypeBadge,
  getStatusBadge,
  search,
  cardType,
  status,
  startDate,
  endDate,
  isSelected,
  onSelectChange,
  isSubmitting,
}: {
  item: any;
  getCardTypeBadge: any;
  getStatusBadge: any;
  search: string;
  cardType: string;
  status: string;
  startDate: string;
  endDate: string;
  isSelected: boolean;
  onSelectChange: (uuid: string, checked: boolean) => void;
  isSubmitting: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Map products to verify table rows
  const productRows =
    item.products?.map((gp: any) => {
      const docItem = item.documentReference?.items?.find(
        (di: any) => di.inventoryId === gp.productId,
      );
      const erpQty = docItem ? (docItem.productQty || docItem.quantity) : 0;
      const prodDetails = getProductDetails(gp);
      return {
        productId: gp.productId,
        sku: prodDetails.sku,
        name: prodDetails.name,
        uom: prodDetails.uom,
        qtyCargo: gp.quantity,
        qtyErp: erpQty,
      };
    }) || [];

  return (
    <>
      <tr
        onClick={() => setIsExpanded(!isExpanded)}
        className={`hover:bg-slate-50/70 border-b border-slate-100 transition cursor-pointer select-none ${
          isExpanded ? "bg-slate-50/40" : ""
        }`}
      >
        <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            disabled={!item.documentReference || item.status !== "PENDING" || isSubmitting}
            onChange={(e) => onSelectChange(item.uuid, e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </td>
        <td className="px-6 py-4 font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <div className="p-0.5 rounded-md hover:bg-slate-200 transition">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-550 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-550 shrink-0" />
            )}
          </div>
          <span>{item.opNumber}</span>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center space-x-1.5 text-slate-550 text-xs">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {new Date(item.createdAt).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
        </td>
        <td className="px-6 py-4">{getCardTypeBadge(item.cardType)}</td>
        <td className="px-6 py-4 font-mono text-xs font-semibold">
          {item.documentReference?.documentNumber ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-250">
              {item.documentReference.documentNumber}
            </span>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </td>
        <td className="px-6 py-4 font-semibold text-slate-800">
          {item.clientPartner || "-"}
        </td>
        <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
        <td
          className="px-6 py-4 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const queryParams = new URLSearchParams();
            if (search) queryParams.append("search", search);
            if (cardType) queryParams.append("cardType", cardType);
            if (status) queryParams.append("status", status);
            if (startDate) queryParams.append("startDate", startDate);
            if (endDate) queryParams.append("endDate", endDate);
            const queryStr = queryParams.toString();
            return (
              <Link
                href={`/gate-verification/${item.uuid}${queryStr ? `?${queryStr}` : ""}`}
                className="inline-flex items-center justify-center bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                {item.status === "VERIFIED" || item.status === "CANCELED" || item.status === "REJECTED"
                  ? "Detail"
                  : "Verifikasi"}
              </Link>
            );
          })()}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td
            colSpan={8}
            className="bg-slate-50/50 px-12 py-4 border-b border-slate-200"
          >
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden max-w-3xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-55 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-2">Nama Produk</th>
                    <th className="px-4 py-2 text-right">Cargo Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-105 text-xs text-slate-700">
                  {productRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-4 text-center text-slate-400 italic"
                      >
                        Tidak ada barang logistik yang dicatat
                      </td>
                    </tr>
                  ) : (
                    productRows.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/30 transition">
                        <td className="px-4 py-2.5 font-bold">
                          {r.name}{" "}
                          <span className="text-[10px] font-mono font-normal text-slate-450 ml-1">
                            SKU: {r.sku}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-black text-slate-500">
                          {r.qtyCargo.toLocaleString("id-ID")} {r.uom}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

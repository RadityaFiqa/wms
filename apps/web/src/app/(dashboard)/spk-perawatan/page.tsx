"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileSpreadsheet,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
} from "lucide-react";
import type { SpkPerawatanItem, SpkTreatmentType } from "@bulog-wms/schema";
import { useAuthStore } from "@/store/auth";
import { useDebounce } from "@/hooks/useDebounce";
import { useSpkPerawatan, useSpkPerawatanActions } from "@/hooks/useSpkPerawatan";

const TREATMENTS: { value: SpkTreatmentType; label: string; className: string }[] = [
  { value: "SPRAYING", label: "Spraying", className: "bg-sky-50 text-sky-700 border-sky-100" },
  { value: "FUMIGASI", label: "Fumigasi", className: "bg-amber-50 text-amber-700 border-amber-100" },
  { value: "FOGGING", label: "Fogging", className: "bg-violet-50 text-violet-700 border-violet-100" },
];

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Makassar",
      })
    : "-";

const formatQty = (value: number | null) =>
  value === null ? "-" : value.toLocaleString("id-ID", { maximumFractionDigits: 2 });

function TreatmentBadges({ spk }: { spk: SpkPerawatanItem }) {
  const raw: Record<SpkTreatmentType, string | null> = {
    SPRAYING: spk.typeSpraying,
    FUMIGASI: spk.typeFumigasi,
    FOGGING: spk.typeFogging,
  };
  if (!spk.treatmentTypes.length) return <span className="text-slate-400">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {TREATMENTS.filter((t) => spk.treatmentTypes.includes(t.value)).map((t) => (
        <span
          key={t.value}
          title={raw[t.value] ?? undefined}
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${t.className}`}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

export default function SpkPerawatanPage() {
  const { hasPermission } = useAuthStore();
  const canSync = hasPermission("update", "Inventory");

  const [search, setSearch] = useState("");
  const [treatmentType, setTreatmentType] = useState<SpkTreatmentType | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const limit = 20;

  const debouncedSearch = useDebounce(search.trim(), 400);
  const filters = {
    search: debouncedSearch || undefined,
    treatmentType: treatmentType || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const { spkData, isLoading } = useSpkPerawatan({ ...filters, page, limit });
  const { syncSpk, exportSpkXlsx } = useSpkPerawatanActions();

  const handleSync = async () => {
    setIsSyncing(true);
    const toastId = toast.loading("Menyinkronkan SPK Perawatan dari Odoo...");
    try {
      const res = await syncSpk();
      toast.success(res.message, { id: toastId });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Gagal menyinkronkan SPK Perawatan.", {
        id: toastId,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportSpkXlsx(filters);
    } catch {
      toast.error("Gagal mengekspor SPK Perawatan.");
    } finally {
      setIsExporting(false);
    }
  };

  const resetPage = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const inputClass =
    "w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:bg-white";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">SPK Perawatan</h1>
          <p className="text-slate-500 mt-1">
            Usulan perawatan (spraying, fumigasi, fogging) dari Odoo dan tumpukan yang memuat produk + lot
            yang sama. Tanggal perawatan terakhir otomatis tampil di Kartu Tumpukan.
          </p>
          {spkData?.lastSyncedAt && (
            <p className="text-xs text-slate-400 mt-1">
              Terakhir disinkronkan: {new Date(spkData.lastSyncedAt).toLocaleString("id-ID")}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            )}
            Export Excel
          </button>
          {canSync && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              Sinkronkan Odoo
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cari</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Nomor SPK, mingguan, lokasi, pemohon, produk, atau lot..."
              value={search}
              onChange={(e) => resetPage(setSearch)(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Jenis Perawatan
          </label>
          <select
            value={treatmentType}
            onChange={(e) => resetPage(setTreatmentType)(e.target.value as SpkTreatmentType | "")}
            className={inputClass}
          >
            <option value="">Semua</option>
            {TREATMENTS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Dari</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => resetPage(setDateFrom)(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sampai</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => resetPage(setDateTo)(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="w-10 px-4 py-4"></th>
                <th className="px-4 py-4">Nomor SPK</th>
                <th className="px-4 py-4">Tanggal</th>
                <th className="px-4 py-4">Mingguan</th>
                <th className="px-4 py-4">Lokasi</th>
                <th className="px-4 py-4">Pemohon</th>
                <th className="px-4 py-4">Jenis</th>
                <th className="px-4 py-4 text-center">Produk</th>
                <th className="px-4 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading && !spkData ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="px-4 py-4">
                      <div className="h-4 bg-slate-200 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : !spkData?.data.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400 font-medium">
                    Belum ada SPK Perawatan. {canSync && "Klik \"Sinkronkan Odoo\" untuk mengambil data."}
                  </td>
                </tr>
              ) : (
                spkData.data.map((spk) => {
                  const isOpen = !!expanded[spk.uuid];
                  const relatedCount = spk.lines.filter((l) => l.relatedStacks.length).length;
                  return (
                    <React.Fragment key={spk.uuid}>
                      <tr
                        className="hover:bg-slate-50/50 transition cursor-pointer"
                        onClick={() => setExpanded((prev) => ({ ...prev, [spk.uuid]: !isOpen }))}
                      >
                        <td className="px-4 py-4 text-slate-400">
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-800">{spk.name}</td>
                        <td className="px-4 py-4 text-slate-600 whitespace-nowrap">{formatDate(spk.date)}</td>
                        <td className="px-4 py-4 text-slate-600">{spk.weeklyName || "-"}</td>
                        <td className="px-4 py-4 text-slate-600">{spk.locationName || "-"}</td>
                        <td className="px-4 py-4 text-slate-600">
                          <div>{spk.namaSuratPemohon || "-"}</div>
                          {spk.jabatanPihakPertama && (
                            <div className="text-xs text-slate-400">{spk.jabatanPihakPertama}</div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <TreatmentBadges spk={spk} />
                        </td>
                        <td className="px-4 py-4 text-center text-slate-600 whitespace-nowrap">
                          {spk.lines.length}
                          <span className="text-xs text-slate-400"> ({relatedCount} di tumpukan)</span>
                        </td>
                        <td className="px-4 py-4 text-slate-600 capitalize">{spk.state || "-"}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={9} className="bg-slate-50/60 px-6 py-4">
                            {spk.lines.length === 0 ? (
                              <p className="text-sm text-slate-400">SPK ini tidak memiliki baris produk.</p>
                            ) : (
                              <table className="w-full text-sm bg-white border border-slate-200 rounded-lg overflow-hidden">
                                <thead>
                                  <tr className="bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="px-3 py-2 text-left">Produk</th>
                                    <th className="px-3 py-2 text-left">Lot</th>
                                    <th className="px-3 py-2 text-right">Jumlah Stok</th>
                                    <th className="px-3 py-2 text-left">Tumpukan Terkait</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {spk.lines.map((line, i) => (
                                    <tr key={i}>
                                      <td className="px-3 py-2 text-slate-700">{line.productName}</td>
                                      <td className="px-3 py-2 text-slate-600 font-mono text-xs">{line.lotName || "-"}</td>
                                      <td className="px-3 py-2 text-right text-slate-600">{formatQty(line.jumlahStock)}</td>
                                      <td className="px-3 py-2">
                                        {line.relatedStacks.length ? (
                                          <div className="flex flex-wrap gap-1">
                                            {line.relatedStacks.map((s, j) => (
                                              <span
                                                key={j}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 border border-teal-100 text-xs text-teal-700"
                                              >
                                                <MapPin className="h-3 w-3" />
                                                {s.locationName} · {formatQty(s.quantity)} {s.uom}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-xs text-slate-400">Tidak ada di kartu tumpukan</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
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

        {spkData && spkData.total > 0 && (
          <div className="bg-slate-50 px-4 sm:px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500 font-semibold">
              Menampilkan {spkData.data.length} dari {spkData.total} SPK
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <span className="text-sm font-bold text-slate-700">
                {page} / {spkData.totalPages}
              </span>
              <button
                disabled={page >= spkData.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition"
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

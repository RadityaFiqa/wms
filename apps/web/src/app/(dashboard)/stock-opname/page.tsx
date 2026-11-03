"use client";

import React, { useState } from "react";
import { useStockOpname } from "@/hooks/useStockOpname";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Clipboard,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  FileText,
  Download,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Trash2,
  User,
} from "lucide-react";

interface OpnameRow {
  uuid: string;
  opnameNumber: string;
  status: string;
  createdAt: string;
  createdBy: string;
  totalStacks: number;
}

interface DayGroup {
  key: string;
  label: string;
  items: OpnameRow[];
}

// Day only, e.g. "Senin, 3 Nov 2026"
function formatDay(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Items arrive newest first, so groups keep that order
function groupByDay(items: OpnameRow[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const op of items) {
    const key = new Date(op.createdAt).toLocaleDateString("en-CA");
    let group = groups.get(key);
    if (!group) {
      group = { key, label: formatDay(op.createdAt), items: [] };
      groups.set(key, group);
    }
    group.items.push(op);
  }
  return Array.from(groups.values());
}

function OpnameStatusBadge({ status }: { status: string }) {
  return status === "COMPLETED" ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-900/30">
      Selesai
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-150 dark:border-amber-900/30">
      Draf Counting
    </span>
  );
}

function OpnameListRow({
  op,
  dateLabel,
  nested = false,
  warehouseName,
  canDelete,
  deletingUuid,
  onOpen,
  onDelete,
}: {
  op: OpnameRow;
  /** Shown for a single opname on its day; nested rows sit under the day header */
  dateLabel?: string;
  nested?: boolean;
  warehouseName?: string;
  canDelete: boolean;
  deletingUuid: string | null;
  onOpen: (op: OpnameRow) => void;
  onDelete: (op: OpnameRow) => void;
}) {
  const isDraft = op.status === "DRAFT";
  const actions = (
    <div className="flex items-center justify-end md:justify-center gap-2">
      <button
        onClick={() => onOpen(op)}
        title={isDraft ? "Lanjutkan Isi Counting" : "Tinjau Detail"}
        className={`p-2 rounded-lg border transition cursor-pointer ${
          isDraft
            ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30"
            : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
        }`}
      >
        {isDraft ? <Edit2 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      {isDraft && canDelete && (
        <button
          onClick={() => onDelete(op)}
          disabled={deletingUuid === op.uuid}
          title="Hapus Draf"
          className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div
      className={`px-4 md:px-6 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition text-slate-700 dark:text-slate-350 ${
        nested ? "shadow-[inset_4px_0_0_var(--color-blue-200)]" : ""
      }`}
    >
      {/* Mobile card */}
      <div className="md:hidden flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onOpen(op)}
          className="min-w-0 text-left space-y-1 cursor-pointer"
        >
          {dateLabel && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              {dateLabel}
            </div>
          )}
          <div className="font-mono font-bold text-slate-900 dark:text-slate-200 truncate">
            {op.opnameNumber}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <OpnameStatusBadge status={op.status} />
            <span>{op.totalStacks} tumpukan</span>
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {op.createdBy}
            </span>
          </div>
        </button>
        {actions}
      </div>

      {/* Desktop row */}
      <div className="hidden md:grid grid-cols-[2.2fr_1.6fr_1.6fr_1.1fr_1.1fr_1fr] gap-4 items-center">
        <div className="text-xs">
          {dateLabel && (
            <div className="font-semibold text-slate-700 dark:text-slate-300">
              {dateLabel}
            </div>
          )}
          <div className="text-[11px] text-slate-400 mt-0.5">
            Oleh: {op.createdBy}
          </div>
        </div>
        <span className="font-mono font-bold text-slate-900 dark:text-slate-200 truncate">
          {op.opnameNumber}
        </span>
        <span className="truncate">{warehouseName}</span>
        <span className="text-center">
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700">
            {op.totalStacks} tumpukan
          </span>
        </span>
        <span className="text-center">
          <OpnameStatusBadge status={op.status} />
        </span>
        {actions}
      </div>
    </div>
  );
}

export default function StockOpnameListPage() {
  const router = useRouter();
  const { activeWarehouse, hasPermission } = useAuthStore();
  const canDelete = hasPermission("delete", "StockOpname");
  const [deletingUuid, setDeletingUuid] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>(
    {},
  );

  const {
    stockOpnameData,
    isLoading,
    refresh,
    createStockOpname,
    deleteStockOpname,
  } = useStockOpname({
    search,
    status,
    startDate,
    endDate,
    page,
    limit,
  });

  const handleCreate = async () => {
    if (!activeWarehouse) {
      toast.error("Silakan pilih gudang aktif terlebih dahulu.");
      return;
    }

    setIsCreating(true);
    const toastId = toast.loading(
      "Membuat sesi Stock Opname baru & mengambil snapshot stok...",
    );
    try {
      const res = await createStockOpname(
        "Sesi Opname " + activeWarehouse.name,
      );
      toast.success("Sesi Stock Opname berhasil dibuat!", { id: toastId });
      router.push(`/stock-opname/${res.uuid}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal membuat Stock Opname.", {
        id: toastId,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (op: { uuid: string; opnameNumber: string }) => {
    if (
      !confirm(
        `Hapus draf Stock Opname ${op.opnameNumber}? Seluruh hasil hitung pada draf ini akan ikut terhapus.`,
      )
    )
      return;
    setDeletingUuid(op.uuid);
    try {
      await deleteStockOpname(op.uuid);
      toast.success(`Draf ${op.opnameNumber} berhasil dihapus.`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menghapus Stock Opname.");
    } finally {
      setDeletingUuid(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Clipboard className="h-8 w-8 text-blue-600 shrink-0" />
            Stock Opname
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Kelola dan catat audit perhitungan stok fisik gudang untuk gudang:{" "}
            <span className="font-semibold text-blue-600">
              {activeWarehouse?.name || "Belum Dipilih"}
            </span>
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] transition cursor-pointer text-sm shrink-0"
        >
          <Plus className="h-4.5 w-4.5 mr-2" />
          Mulai Opname Baru
        </button>
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-700 dark:text-slate-350">
          <Filter className="h-4.5 w-4.5 text-slate-550" />
          <span>Filter Pencarian</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search by Number */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No. Opname..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* Status */}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="DRAFT">Draf (Draft)</option>
            <option value="COMPLETED">Selesai (Completed)</option>
          </select>

          {/* Start Date */}
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              placeholder="Mulai Tanggal"
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              placeholder="Hingga Tanggal"
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* List grouped per day; a day with several opnames collapses into one row */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-[2.2fr_1.6fr_1.6fr_1.1fr_1.1fr_1fr] gap-4 px-6 py-4 bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          <span>Tanggal</span>
          <span className="font-mono">No. Opname</span>
          <span>Gudang</span>
          <span className="text-center">Tumpukan</span>
          <span className="text-center">Status</span>
          <span className="text-center">Aksi</span>
        </div>

        {isLoading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-6 py-4 animate-pulse flex gap-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 ml-auto"></div>
              </div>
            ))}
          </div>
        ) : !stockOpnameData || stockOpnameData.items.length === 0 ? (
          <p className="px-6 py-16 text-center text-slate-400 font-medium text-sm">
            Tidak ada sesi Stock Opname ditemukan. Silakan klik tombol Mulai
            Opname Baru.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {groupByDay(stockOpnameData.items as OpnameRow[]).map((group) => {
              const rowProps = {
                warehouseName: activeWarehouse?.name,
                canDelete,
                deletingUuid,
                onOpen: (op: OpnameRow) =>
                  router.push(`/stock-opname/${op.uuid}`),
                onDelete: handleDelete,
              };
              if (group.items.length === 1) {
                return (
                  <OpnameListRow
                    key={group.key}
                    op={group.items[0]}
                    dateLabel={group.label}
                    {...rowProps}
                  />
                );
              }
              const isOpen = !!expandedDays[group.key];
              const drafts = group.items.filter(
                (op) => op.status === "DRAFT",
              ).length;
              return (
                <div key={group.key}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDays((prev) => ({
                        ...prev,
                        [group.key]: !prev[group.key],
                      }))
                    }
                    aria-expanded={isOpen}
                    className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-4 md:px-6 py-4 text-left hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition cursor-pointer"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                    )}
                    <Calendar className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {group.label}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                      {group.items.length} opname
                    </span>
                    {drafts > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-150 dark:border-amber-900/30">
                        {drafts} draf
                      </span>
                    )}
                    <span className="ml-auto text-xs font-semibold text-slate-400">
                      {isOpen ? "Sembunyikan" : "Lihat semua"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850/20">
                      {group.items.map((op) => (
                        <OpnameListRow
                          key={op.uuid}
                          op={op}
                          nested
                          {...rowProps}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination footer */}
        {stockOpnameData?.totalPages > 1 && (
          <div className="bg-slate-50 dark:bg-slate-850/80 px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500 font-semibold text-center sm:text-left">
              Menampilkan {stockOpnameData.items.length} dari{" "}
              {stockOpnameData.total} data opname
            </span>

            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <span className="text-sm font-bold text-slate-700">
                {page} / {stockOpnameData.totalPages}
              </span>
              <button
                disabled={page >= stockOpnameData.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
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

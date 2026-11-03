"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useStockOpnameDetail } from "@/hooks/useStockOpname";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import {
  QuantityCalculatorRows,
  summarizeCalculationRows,
} from "@/components/QuantityCalculatorRows";
import { formatQuantity, formatSignedQuantity } from "@/lib/quantity";
import {
  QUANTITY_PRECISION,
  STOCK_OPNAME_NOTE_MAX_LENGTH,
  roundQuantity,
  type StockOpnameCalculationRow,
  type UpdateStockOpnameInput,
} from "@bulog-wms/schema";
import {
  Calculator,
  Clipboard,
  ChevronLeft,
  Calendar,
  Save,
  CheckCircle,
  FileText,
  MapPin,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Info,
  Layers,
  Trash2,
  Printer,
  StickyNote,
  History,
  RefreshCw,
  Warehouse,
  User,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";

interface OpnameStack {
  uuid: string;
  locationName: string;
  erpQty: number;
  calculatedPhysical: number | null;
  actualQty: number | null;
  variance: number | null;
  calculationRows?: StockOpnameCalculationRow[] | null;
  note?: string | null;
  requiresConfirmation?: boolean;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
}

interface LocationEntry {
  stack: OpnameStack;
  productName: string;
  productSku: string;
  productUom: string | null;
}

/** One tumpukan; all SKUs in it share a single calculator. */
interface LocationGroup {
  key: string;
  locationName: string;
  entries: LocationEntry[];
  uom: string | null;
  erpQty: number;
  calculatedPhysical: number | null;
  /** Count was prefilled from the previous opname; confirming it is optional */
  requiresConfirmation: boolean;
  /** Saved confirmation of the prefilled count */
  confirmed: boolean;
  confirmedBy: string | null;
}

interface AreaGroup {
  area: string;
  locations: LocationGroup[];
}

// Area is the part before "/", e.g. "GBB 01/C04.1.2" -> "GBB 01"
function locationArea(locationName: string): string {
  const slash = locationName.indexOf("/");
  return (slash >= 0 ? locationName.slice(0, slash) : locationName).trim();
}

function quantityToExpression(qty: number): string {
  const str = String(qty);
  // Avoid exponent notation (e.g. 1e-7), which the expression parser rejects
  return /e/i.test(str) ? qty.toFixed(QUANTITY_PRECISION) : str;
}

// Rows to show for a tumpukan: saved calculator rows of every SKU in it, or
// legacy totals as single rows
function initialLocationRows(location: LocationGroup): string[] {
  const rows: string[] = [];
  let hasZeroCount = false;
  for (const { stack } of location.entries) {
    if (stack.calculationRows && stack.calculationRows.length > 0) {
      rows.push(...stack.calculationRows.map((r) => r.expression));
    } else if (stack.actualQty === 0) {
      hasZeroCount = true;
    } else if (stack.actualQty !== null) {
      rows.push(quantityToExpression(stack.actualQty));
    }
  }
  if (rows.length > 0) return rows;
  return [hasZeroCount ? "0" : ""];
}

// Note of a tumpukan: kept on its first SKU, but merge any legacy per-SKU notes
function initialLocationNote(location: LocationGroup): string {
  const notes = location.entries
    .map((e) => e.stack.note?.trim())
    .filter((n): n is string => !!n);
  return Array.from(new Set(notes)).join("; ");
}

function groupByLocation(items: any[]): AreaGroup[] {
  const collator = new Intl.Collator("id-ID", { numeric: true });
  const locations = new Map<string, LocationGroup>();
  for (const item of items) {
    for (const stack of item.stacks as OpnameStack[]) {
      let loc = locations.get(stack.locationName);
      if (!loc) {
        loc = {
          key: stack.locationName,
          locationName: stack.locationName,
          entries: [],
          uom: item.productUom,
          erpQty: 0,
          calculatedPhysical: null,
          requiresConfirmation: false,
          confirmed: false,
          confirmedBy: null,
        };
        locations.set(stack.locationName, loc);
      }
      loc.entries.push({
        stack,
        productName: item.productName,
        productSku: item.productSku,
        productUom: item.productUom,
      });
    }
  }

  const areas = new Map<string, LocationGroup[]>();
  for (const loc of locations.values()) {
    // The first SKU holds the tumpukan count when saving, so keep the order stable
    loc.entries.sort((a, b) => collator.compare(a.productName, b.productName));
    loc.uom = loc.entries[0].productUom;
    loc.erpQty = roundQuantity(
      loc.entries.reduce((sum, e) => sum + e.stack.erpQty, 0),
    );
    const recon = loc.entries.filter(
      (e) =>
        e.stack.calculatedPhysical !== null &&
        e.stack.calculatedPhysical !== undefined,
    );
    loc.calculatedPhysical = recon.length
      ? roundQuantity(
          recon.reduce((sum, e) => sum + (e.stack.calculatedPhysical ?? 0), 0),
        )
      : null;

    const prefilled = loc.entries.filter((e) => e.stack.requiresConfirmation);
    loc.requiresConfirmation = prefilled.length > 0;
    loc.confirmed =
      loc.requiresConfirmation && prefilled.every((e) => !!e.stack.confirmedAt);
    loc.confirmedBy =
      prefilled.find((e) => e.stack.confirmedBy)?.stack.confirmedBy ?? null;

    const area = locationArea(loc.locationName);
    const list = areas.get(area) ?? [];
    list.push(loc);
    areas.set(area, list);
  }

  return Array.from(areas.entries())
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([area, locs]) => ({
      area,
      locations: locs.sort((a, b) =>
        collator.compare(a.locationName, b.locationName),
      ),
    }));
}

function varianceClass(value: number): string {
  return value < 0
    ? "text-red-650"
    : value > 0
      ? "text-emerald-650"
      : "text-slate-500";
}

function formatDay(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const LOCATION_GRID =
  "md:grid md:grid-cols-[minmax(0,2.4fr)_repeat(4,minmax(0,1fr))] md:gap-4";

function QtyCell({
  label,
  children,
  emphasis = false,
}: {
  label: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2 md:p-0 md:rounded-none md:text-right ${
        emphasis
          ? "bg-blue-50/70 dark:bg-blue-950/20 md:bg-transparent md:dark:bg-transparent"
          : "bg-slate-50 dark:bg-slate-800/40 md:bg-transparent md:dark:bg-transparent"
      }`}
    >
      <div className="md:hidden text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="text-sm font-bold">{children}</div>
    </div>
  );
}

const secondaryButton =
  "flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed";

export default function StockOpnameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const uuid = params.uuid as string;

  const {
    detailData,
    isLoading,
    error,
    updateDraft,
    submitOpname,
    refreshStock,
    deleteOpname,
    downloadPhysicalCountSheet,
  } = useStockOpnameDetail(uuid);
  const { hasPermission } = useAuthStore();
  const canDelete = hasPermission("delete", "StockOpname");
  const [isDeleting, setIsDeleting] = useState(false);

  const [notes, setNotes] = useState("");
  // Calculator rows per tumpukan (location name); the physical count is their total
  const [calcRows, setCalcRows] = useState<Record<string, string[]>>({});
  // Note per tumpukan (location name)
  const [stackNotes, setStackNotes] = useState<Record<string, string>>({});
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingStock, setIsRefreshingStock] = useState(false);
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>(
    {},
  );
  const [expandedCalculators, setExpandedCalculators] = useState<
    Record<string, boolean>
  >({});
  // Rows as loaded, so untouched tumpukan (incl. legacy counts) are not re-sent
  const loadedRowsRef = useRef<Record<string, string[]>>({});
  const loadedNotesRef = useRef<Record<string, string>>({});
  // Optional "Masih sama" per prefilled tumpukan (location name)
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>(
    {},
  );

  const areaGroups = useMemo(
    () => (detailData ? groupByLocation(detailData.items) : []),
    [detailData],
  );

  // Sync state with loaded data
  useEffect(() => {
    if (detailData) {
      setNotes(detailData.notes || "");
      setAttachmentPaths(detailData.attachments.map((a: any) => a.filePath));
    }
  }, [detailData]);

  useEffect(() => {
    const rows: Record<string, string[]> = {};
    const notesByLocation: Record<string, string> = {};
    const confirmedByLocation: Record<string, boolean> = {};
    for (const { locations } of areaGroups) {
      for (const loc of locations) {
        rows[loc.key] = initialLocationRows(loc);
        notesByLocation[loc.key] = initialLocationNote(loc);
        confirmedByLocation[loc.key] = loc.confirmed;
      }
    }
    loadedRowsRef.current = rows;
    loadedNotesRef.current = notesByLocation;
    setCalcRows(rows);
    setStackNotes(notesByLocation);
    setConfirmations(confirmedByLocation);
  }, [areaGroups]);

  // A prefilled tumpukan whose rows or note were changed counts as updated
  const isLocationEdited = useCallback(
    (key: string) => {
      const filled = (rows: string[] | undefined) =>
        (rows ?? [])
          .map((r) => r.trim())
          .filter((r) => r !== "")
          .join("\n");
      return (
        filled(calcRows[key]) !== filled(loadedRowsRef.current[key]) ||
        (stackNotes[key] ?? "").trim() !==
          (loadedNotesRef.current[key] ?? "").trim()
      );
    },
    [calcRows, stackNotes],
  );

  const isLocationConfirmed = useCallback(
    (loc: LocationGroup) =>
      !loc.requiresConfirmation ||
      !!confirmations[loc.key] ||
      isLocationEdited(loc.key),
    [confirmations, isLocationEdited],
  );

  const handleRowsChange = useCallback(
    (locationKey: string, rows: string[]) => {
      setCalcRows((prev) => ({ ...prev, [locationKey]: rows }));
    },
    [],
  );

  const toggleCalculator = useCallback((locationKey: string) => {
    setExpandedCalculators((prev) => ({
      ...prev,
      [locationKey]: !prev[locationKey],
    }));
  }, []);

  const hasInvalidExpression = useMemo(
    () =>
      Object.values(calcRows).some(
        (rows) => summarizeCalculationRows(rows).hasError,
      ),
    [calcRows],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-3">
        <svg
          className="animate-spin h-10 w-10 text-blue-600"
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
        <span className="text-sm font-semibold text-slate-500">
          Memuat detail Stock Opname...
        </span>
      </div>
    );
  }

  if (error || !detailData) {
    return (
      <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-150 space-y-4">
        <h2 className="text-lg font-bold">Error Memuat Data</h2>
        <p>
          {error?.response?.data?.message ||
            "Sesi Stock Opname tidak ditemukan."}
        </p>
        <button
          onClick={() => router.push("/stock-opname")}
          className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-500 transition cursor-pointer"
        >
          Kembali ke Daftar
        </button>
      </div>
    );
  }

  const isDraft = detailData.status === "DRAFT";
  const isBusy = isSaving || isSubmitting || isRefreshingStock || isDeleting;

  const toggleAreaExpand = (area: string) => {
    setExpandedAreas((prev) => ({ ...prev, [area]: !prev[area] }));
  };

  // Physical count of a tumpukan: live calculator total in draft, saved counts otherwise
  const locationPhysicalQty = (loc: LocationGroup): number | null => {
    if (isDraft) {
      const rows = calcRows[loc.key];
      return rows ? summarizeCalculationRows(rows).total : null;
    }
    const counted = loc.entries.filter((e) => e.stack.actualQty !== null);
    return counted.length
      ? roundQuantity(
          counted.reduce((sum, e) => sum + (e.stack.actualQty ?? 0), 0),
        )
      : null;
  };

  const allLocations = areaGroups.flatMap((a) => a.locations);
  const totalLocations = allLocations.length;
  const countedLocations = allLocations.filter(
    (loc) => locationPhysicalQty(loc) !== null,
  ).length;
  const prefilledLocations = allLocations.filter(
    (loc) => loc.requiresConfirmation,
  ).length;
  const progressPercent = totalLocations
    ? Math.round((countedLocations / totalLocations) * 100)
    : 0;

  const buildSavePayload = (): UpdateStockOpnameInput => {
    const stacksPayload: NonNullable<UpdateStockOpnameInput["stacks"]> = [];
    for (const loc of allLocations) {
      const rows = calcRows[loc.key];
      const note = stackNotes[loc.key] ?? "";
      const confirmed = isLocationConfirmed(loc);
      const confirmationChanged =
        loc.requiresConfirmation && confirmed !== loc.confirmed;
      if (
        !rows ||
        (rows === loadedRowsRef.current[loc.key] &&
          note === loadedNotesRef.current[loc.key] &&
          !confirmationChanged)
      )
        continue;
      const total = summarizeCalculationRows(rows).total;
      const confirmation = loc.requiresConfirmation ? { confirmed } : {};
      // The tumpukan count is stored on its first SKU; other SKUs get 0, so
      // the summed variance equals count - total ERP of the tumpukan
      loc.entries.forEach(({ stack }, i) => {
        stacksPayload.push(
          i === 0
            ? {
                uuid: stack.uuid,
                actualQty: total,
                calculationRows: rows.filter((r) => r.trim() !== ""),
                note: note.trim() || null,
                ...confirmation,
              }
            : {
                uuid: stack.uuid,
                actualQty: total === null ? null : 0,
                calculationRows: [],
                note: null,
                ...confirmation,
              },
        );
      });
    }
    return {
      notes,
      stacks: stacksPayload,
      attachmentPaths,
    };
  };

  const handleSaveDraft = async () => {
    if (hasInvalidExpression) return;
    setIsSaving(true);
    const toastId = toast.loading("Menyimpan draf perhitungan...");
    try {
      await updateDraft(buildSavePayload());
      toast.success("Draf berhasil disimpan.", { id: toastId });
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menyimpan draf.", {
        id: toastId,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitOpname = async () => {
    if (hasInvalidExpression) return;
    // Save first, then submit
    setIsSubmitting(true);
    const toastId = toast.loading(
      "Menyimpan data dan menyelesaikan Stock Opname...",
    );
    try {
      await updateDraft(buildSavePayload());
      await submitOpname();
      toast.success("Stock Opname berhasil diselesaikan dan dikunci.", {
        id: toastId,
      });
    } catch (e: any) {
      toast.error(
        e.response?.data?.message || "Gagal menyelesaikan Stock Opname.",
        { id: toastId },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshStock = async () => {
    if (hasInvalidExpression) return;
    if (
      !confirm(
        "Perbarui Snapshot ERP dan Stok Sistem draf ini ke stok terbaru? Hitungan fisik, catatan, dan konfirmasi yang sudah diisi tidak akan berubah.",
      )
    )
      return;
    setIsRefreshingStock(true);
    const toastId = toast.loading("Menyimpan draf dan memperbarui stok...");
    try {
      // Save first so unsaved counts are not lost when the detail reloads
      await updateDraft(buildSavePayload());
      const result = await refreshStock();
      const details = [
        result?.newStacks ? `${result.newStacks} tumpukan baru` : null,
        result?.prefilled ? `${result.prefilled} diisi otomatis` : null,
      ].filter(Boolean);
      toast.success(
        `Stok berhasil diperbarui${details.length ? ` (${details.join(", ")})` : ""}.`,
        { id: toastId },
      );
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal memperbarui stok.", {
        id: toastId,
      });
    } finally {
      setIsRefreshingStock(false);
    }
  };

  const handleDeleteOpname = async () => {
    if (
      !confirm(
        `Hapus draf Stock Opname ${detailData.opnameNumber}? Seluruh hasil hitung pada draf ini akan ikut terhapus.`,
      )
    )
      return;
    setIsDeleting(true);
    try {
      await deleteOpname();
      toast.success(`Draf ${detailData.opnameNumber} berhasil dihapus.`);
      router.push("/stock-opname");
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menghapus Stock Opname.");
      setIsDeleting(false);
    }
  };

  const handlePrintPhysicalCountSheet = async () => {
    const toastId = toast.loading("Mengunduh Lembar Perhitungan Fisik...");
    try {
      await downloadPhysicalCountSheet();
      toast.success("Unduhan sukses!", { id: toastId });
    } catch (e) {
      toast.error("Gagal mengunduh berkas PDF.", { id: toastId });
    }
  };

  const saveButton = (
    <button
      onClick={handleSaveDraft}
      disabled={isBusy || hasInvalidExpression}
      className="flex flex-1 md:flex-none items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 font-bold px-4 py-3 md:py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Save className="h-4.5 w-4.5" />
      {isSaving ? "Menyimpan..." : "Simpan Draf"}
    </button>
  );

  const submitButton = (
    <button
      onClick={handleSubmitOpname}
      disabled={isBusy || hasInvalidExpression}
      className="flex flex-1 md:flex-none items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-3 md:py-2.5 rounded-xl shadow-lg hover:shadow-emerald-500/10 transition cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <CheckCircle className="h-4.5 w-4.5" />
      {isSubmitting ? (
        "Memproses..."
      ) : (
        <>
          Selesaikan<span className="hidden md:inline"> Opname</span>
        </>
      )}
    </button>
  );

  return (
    <div className="space-y-6 pb-28 md:pb-12">
      {/* Breadcrumb Navigation */}
      <button
        onClick={() => router.push("/stock-opname")}
        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
      >
        <ChevronLeft className="h-4 w-4" />
        Kembali ke Daftar Stock Opname
      </button>

      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 md:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Stock Opname
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-xl md:text-2xl font-black text-slate-850 dark:text-slate-100 break-all">
                  {detailData.opnameNumber}
                </h1>
                {isDraft ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-150 dark:border-amber-900/30">
                    Draf Perhitungan
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-900/30">
                    Selesai
                  </span>
                )}
              </div>
            </div>

            {/* Desktop actions */}
            <div className="hidden md:flex flex-wrap items-center gap-2 lg:justify-end">
              <button
                onClick={handlePrintPhysicalCountSheet}
                className={secondaryButton}
              >
                <Printer className="h-4.5 w-4.5 text-slate-500" />
                Cetak Lembar Hitung
              </button>
              {isDraft && (
                <>
                  <button
                    onClick={handleRefreshStock}
                    disabled={isBusy || hasInvalidExpression}
                    className={secondaryButton}
                  >
                    <RefreshCw
                      className={`h-4.5 w-4.5 text-slate-500 ${isRefreshingStock ? "animate-spin" : ""}`}
                    />
                    {isRefreshingStock ? "Memperbarui..." : "Perbarui Stok"}
                  </button>
                  {canDelete && (
                    <button
                      onClick={handleDeleteOpname}
                      disabled={isBusy}
                      title="Hapus Draf"
                      className={`${secondaryButton} !text-red-600 !border-red-200 dark:!border-red-900/40`}
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                      {isDeleting ? "Menghapus..." : "Hapus"}
                    </button>
                  )}
                  <span className="hidden lg:block w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1" />
                  {saveButton}
                  {submitButton}
                </>
              )}
            </div>
          </div>

          {/* Key info */}
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3 min-w-0">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Warehouse className="h-3.5 w-3.5" />
                Gudang
              </dt>
              <dd className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200 break-words">
                {detailData.warehouseName}
              </dd>
              <dd className="text-xs text-slate-400 font-mono truncate">
                {detailData.warehouseCode}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3 min-w-0">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Calendar className="h-3.5 w-3.5" />
                Tanggal Opname
              </dt>
              <dd className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">
                {formatDay(detailData.createdAt)}
              </dd>
              {detailData.completionDate && (
                <dd className="text-xs text-emerald-600 dark:text-emerald-400">
                  Selesai {formatDay(detailData.completionDate)}
                </dd>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3 min-w-0">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <User className="h-3.5 w-3.5" />
                Dibuat Oleh
              </dt>
              <dd className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                {detailData.createdBy}
              </dd>
              <dd className="text-xs text-slate-400">
                {detailData.totalProducts} komoditas
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3 min-w-0">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Layers className="h-3.5 w-3.5" />
                Progres Hitung
              </dt>
              <dd className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">
                {countedLocations}/{totalLocations} tumpukan
                <span className="ml-1 text-xs font-semibold text-slate-400">
                  ({progressPercent}%)
                </span>
              </dd>
              <dd className="mt-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progressPercent === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </dd>
            </div>
          </dl>

          {/* Mobile secondary actions */}
          <div
            className={`md:hidden grid gap-2 ${isDraft ? (canDelete ? "grid-cols-3" : "grid-cols-2") : "grid-cols-1"}`}
          >
            <button
              onClick={handlePrintPhysicalCountSheet}
              className={`${secondaryButton} flex-col !gap-1 !text-xs`}
            >
              <Printer className="h-4.5 w-4.5 text-slate-500" />
              Cetak
            </button>
            {isDraft && (
              <button
                onClick={handleRefreshStock}
                disabled={isBusy || hasInvalidExpression}
                className={`${secondaryButton} flex-col !gap-1 !text-xs`}
              >
                <RefreshCw
                  className={`h-4.5 w-4.5 text-slate-500 ${isRefreshingStock ? "animate-spin" : ""}`}
                />
                {isRefreshingStock ? "Memperbarui..." : "Perbarui Stok"}
              </button>
            )}
            {isDraft && canDelete && (
              <button
                onClick={handleDeleteOpname}
                disabled={isBusy}
                className={`${secondaryButton} flex-col !gap-1 !text-xs !text-red-600 !border-red-200`}
              >
                <Trash2 className="h-4.5 w-4.5" />
                {isDeleting ? "Menghapus..." : "Hapus"}
              </button>
            )}
          </div>
        </div>

        {detailData.previousStockOpname && prefilledLocations > 0 && (
          <div className="flex items-start gap-2.5 border-t border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/10 px-5 md:px-6 py-3 text-xs text-blue-900 dark:text-blue-300">
            <History className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>
              {prefilledLocations} tumpukan yang tidak bergerak sudah diisi
              otomatis dari hitungan terakhir{" "}
              <span className="font-bold font-mono">
                {detailData.previousStockOpname.opnameNumber}
              </span>
              .{isDraft && " Periksa dan ubah bila berbeda."}
            </span>
          </div>
        )}
      </div>

      {isDraft && (
        <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-bold">Panduan:</span> Buka lokasi (mis. GBB
            01, GKP), lalu ketuk &quot;Isi Hitungan&quot; pada tumpukan. Satu
            isian berlaku untuk semua SKU dalam tumpukan yang sama, bisa berupa
            ekspresi seperti 20x2x5 atau (10+5)x2 dalam beberapa baris. Tumpukan
            tanpa hitungan tidak dimasukkan ke perhitungan selisih.
          </div>
        </div>
      )}

      {isDraft && hasInvalidExpression && (
        <div className="bg-red-50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 flex items-start gap-3 text-xs font-semibold text-red-700 dark:text-red-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          Masih ada ekspresi perhitungan yang tidak valid. Perbaiki terlebih
          dahulu sebelum menyimpan atau menyelesaikan Stock Opname.
        </div>
      )}

      {/* Locations, grouped by area (GBB 01, GBB 02, GKP, ...) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-slate-100 dark:border-slate-800/80">
          <h2 className="text-base font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600 shrink-0" />
            Hitung per Lokasi
            <span className="text-sm font-semibold text-slate-400">
              ({totalLocations} tumpukan)
            </span>
          </h2>
        </div>

        {areaGroups.length === 0 && (
          <p className="px-6 py-8 text-center text-xs italic text-slate-400">
            Tidak ada lokasi dengan Snapshot ERP atau Stok Sistem lebih dari 0.
          </p>
        )}

        <div className="divide-y divide-slate-150 dark:divide-slate-800">
          {areaGroups.map(({ area, locations }) => {
            const isExpanded = !!expandedAreas[area];
            const countedCount = locations.filter(
              (loc) => locationPhysicalQty(loc) !== null,
            ).length;
            const done = countedCount === locations.length;

            return (
              <div key={area}>
                {/* Area header */}
                <button
                  type="button"
                  onClick={() => toggleAreaExpand(area)}
                  aria-expanded={isExpanded}
                  className={`w-full flex items-center gap-2 px-4 md:px-6 py-4 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition cursor-pointer select-none ${
                    isExpanded ? "bg-slate-50/60 dark:bg-slate-850/20" : ""
                  }`}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                  )}
                  <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {area}
                  </span>
                  <span
                    className={`ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${
                      done
                        ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-150 dark:border-emerald-900/30"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {done && <CheckCircle className="h-3 w-3" />}
                    {countedCount}/{locations.length} dihitung
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800">
                    {/* Desktop column headers */}
                    <div
                      className={`hidden ${LOCATION_GRID} px-6 py-2.5 bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider`}
                    >
                      <span>Tumpukan / Komoditas</span>
                      <span className="text-right">Snapshot ERP</span>
                      <span className="text-right">Stok Sistem</span>
                      <span className="text-right">Hitung Fisik</span>
                      <span className="text-right">Selisih</span>
                    </div>

                    <div className="md:divide-y divide-slate-100 dark:divide-slate-800 p-2 md:p-0 space-y-2 md:space-y-0">
                      {locations.map((loc) => {
                        const rows = calcRows[loc.key] ?? [""];
                        const summary = summarizeCalculationRows(rows);
                        const physicalQty = locationPhysicalQty(loc);
                        const variance =
                          physicalQty !== null
                            ? roundQuantity(physicalQty - loc.erpQty)
                            : null;
                        const isCalcOpen = !!expandedCalculators[loc.key];
                        const isMixed = loc.entries.length > 1;
                        const isEdited =
                          loc.requiresConfirmation &&
                          isDraft &&
                          isLocationEdited(loc.key);
                        const isConfirmed = isDraft
                          ? isLocationConfirmed(loc)
                          : loc.confirmed;
                        const filledRows = rows.filter(
                          (r) => r.trim() !== "",
                        ).length;

                        return (
                          <div
                            key={loc.key}
                            className="rounded-xl md:rounded-none border md:border-0 border-slate-200 dark:border-slate-800 p-3 md:px-6 md:py-4 space-y-3"
                          >
                            <div className={`${LOCATION_GRID} md:items-start`}>
                              {/* Tumpukan + komoditas */}
                              <div className="min-w-0 mb-3 md:mb-0">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-bold text-slate-800 dark:text-slate-200 break-words">
                                    {loc.locationName}
                                  </span>
                                  {physicalQty !== null && (
                                    <CheckCircle className="md:hidden h-4.5 w-4.5 text-emerald-500 shrink-0" />
                                  )}
                                </div>
                                <div className="mt-1 space-y-1">
                                  {loc.entries.map((e) => (
                                    <div key={e.stack.uuid} className="text-xs">
                                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                                        {e.productName}
                                      </span>
                                      <span className="ml-1.5 text-slate-400 font-mono text-[10px]">
                                        {e.productSku}
                                        {isMixed &&
                                          ` · ERP ${formatQuantity(e.stack.erpQty)} ${e.productUom ?? ""}`}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 md:contents">
                                <QtyCell label="Snapshot ERP">
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {formatQuantity(loc.erpQty)}{" "}
                                    <span className="text-slate-400 text-xs font-normal">
                                      {loc.uom}
                                    </span>
                                  </span>
                                </QtyCell>
                                <QtyCell label="Stok Sistem">
                                  <span className="text-slate-500 dark:text-slate-400">
                                    {loc.calculatedPhysical !== null ? (
                                      <>
                                        {formatQuantity(loc.calculatedPhysical)}{" "}
                                        <span className="text-slate-400 text-xs font-normal">
                                          {loc.uom}
                                        </span>
                                      </>
                                    ) : (
                                      "-"
                                    )}
                                  </span>
                                </QtyCell>
                                <QtyCell label="Hitung Fisik" emphasis>
                                  {physicalQty !== null ? (
                                    <span className="font-extrabold text-slate-800 dark:text-slate-200">
                                      {formatQuantity(physicalQty)}{" "}
                                      <span className="text-slate-400 text-xs font-normal">
                                        {loc.uom}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic font-normal text-xs">
                                      Belum dihitung
                                    </span>
                                  )}
                                </QtyCell>
                                <QtyCell label="Selisih">
                                  {variance !== null ? (
                                    <span
                                      className={`font-black ${varianceClass(variance)}`}
                                    >
                                      {formatSignedQuantity(variance)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </QtyCell>
                              </div>
                            </div>

                            {loc.requiresConfirmation && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/10 px-3 py-2 text-xs text-blue-900 dark:text-blue-300">
                                <History className="h-3.5 w-3.5 shrink-0" />
                                <span>Diisi dari hitungan terakhir.</span>
                                {isDraft ? (
                                  <label className="ml-auto inline-flex items-center gap-2 py-1 font-bold cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      className="h-5 w-5 md:h-4 md:w-4 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed"
                                      checked={isConfirmed}
                                      disabled={isEdited}
                                      onChange={(e) =>
                                        setConfirmations((prev) => ({
                                          ...prev,
                                          [loc.key]: e.target.checked,
                                        }))
                                      }
                                    />
                                    {isEdited
                                      ? "Diperbarui petugas"
                                      : "Masih sama (opsional)"}
                                  </label>
                                ) : (
                                  isConfirmed && (
                                    <span className="ml-auto font-bold">
                                      Dikonfirmasi
                                      {loc.confirmedBy
                                        ? ` oleh ${loc.confirmedBy}`
                                        : ""}
                                    </span>
                                  )
                                )}
                              </div>
                            )}

                            <div className="rounded-lg border border-slate-200 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => toggleCalculator(loc.key)}
                                aria-expanded={isCalcOpen}
                                className="w-full flex items-center gap-2 px-3 py-3 md:py-2 text-sm md:text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg transition cursor-pointer"
                              >
                                {isCalcOpen ? (
                                  <ChevronDown className="h-4 w-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0" />
                                )}
                                <Calculator className="h-4 w-4 text-blue-500 shrink-0" />
                                {!isDraft
                                  ? "Rincian Perhitungan"
                                  : filledRows > 0
                                    ? "Ubah Hitungan"
                                    : "Isi Hitungan"}
                                {filledRows > 0 && (
                                  <span className="text-slate-400 font-semibold">
                                    ({filledRows} baris)
                                  </span>
                                )}
                                {summary.hasError && (
                                  <span className="ml-auto inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Tidak valid
                                  </span>
                                )}
                              </button>
                              {isCalcOpen && (
                                <div className="max-w-2xl px-2 md:px-3 pb-3 pt-1">
                                  <QuantityCalculatorRows
                                    rowsKey={loc.key}
                                    rows={rows}
                                    onChange={handleRowsChange}
                                    uom={loc.uom}
                                    disabled={!isDraft}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex items-start gap-2">
                              <StickyNote className="h-4 w-4 mt-2.5 md:mt-2 text-amber-500 shrink-0" />
                              {isDraft ? (
                                <input
                                  type="text"
                                  value={stackNotes[loc.key] ?? ""}
                                  maxLength={STOCK_OPNAME_NOTE_MAX_LENGTH}
                                  onChange={(e) =>
                                    setStackNotes((prev) => ({
                                      ...prev,
                                      [loc.key]: e.target.value,
                                    }))
                                  }
                                  placeholder="Catatan tumpukan (mis. karung rusak, tumpukan miring)..."
                                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2.5 md:py-1.5 text-base md:text-xs focus:outline-none focus:border-blue-500 focus:bg-white dark:bg-slate-850 dark:border-slate-800 dark:text-slate-200"
                                />
                              ) : (
                                <p className="py-1.5 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                  {stackNotes[loc.key] || (
                                    <span className="italic text-slate-400">
                                      Tidak ada catatan tumpukan.
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Long form notes and justification */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notes column */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Clipboard className="h-5 w-5 text-blue-600 shrink-0" />
            Justifikasi & Catatan Penemuan
          </h2>
          {isDraft ? (
            <textarea
              rows={5}
              placeholder="Tuliskan temuan selisih, barang rusak, penomoran batch salah, catatan operasional, atau justifikasi rekonsiliasi stok di sini..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-3 text-base md:text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-350 leading-relaxed whitespace-pre-wrap">
              {notes || "Tidak ada catatan penemuan."}
            </div>
          )}
        </div>

        {/* Attachments column */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600 shrink-0" />
            Berkas Lampiran / Bukti
          </h2>

          {isDraft ? (
            <AttachmentUploader
              value={attachmentPaths}
              onChange={(paths) => setAttachmentPaths(paths)}
              initialAttachments={detailData.attachments}
              accept="image/*,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              label=""
            />
          ) : (
            <div className="space-y-2">
              {detailData.attachments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Tidak ada lampiran berkas.
                </p>
              ) : (
                detailData.attachments.map((attach: any) => (
                  <a
                    key={attach.uuid}
                    href={attach.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100/80 transition text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    <span className="truncate max-w-[200px]">
                      {attach.fileName}
                    </span>
                    <Download className="h-4 w-4 text-slate-500 shrink-0" />
                  </a>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile sticky save / submit bar */}
      {isDraft && (
        <div className="md:hidden fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
          {saveButton}
          {submitButton}
        </div>
      )}
    </div>
  );
}

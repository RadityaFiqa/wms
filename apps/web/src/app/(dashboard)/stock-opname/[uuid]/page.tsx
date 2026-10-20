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
  Tag,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Info,
  Layers,
  Trash2,
  Printer,
  StickyNote,
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
    deleteOpname,
    downloadPhysicalCountSheet,
    downloadResultPdf,
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
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>(
    {},
  );
  const [expandedCalculators, setExpandedCalculators] = useState<
    Record<string, boolean>
  >({});
  // Rows as loaded, so untouched tumpukan (incl. legacy counts) are not re-sent
  const loadedRowsRef = useRef<Record<string, string[]>>({});
  const loadedNotesRef = useRef<Record<string, string>>({});

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
    for (const { locations } of areaGroups) {
      for (const loc of locations) {
        rows[loc.key] = initialLocationRows(loc);
        notesByLocation[loc.key] = initialLocationNote(loc);
      }
    }
    loadedRowsRef.current = rows;
    loadedNotesRef.current = notesByLocation;
    setCalcRows(rows);
    setStackNotes(notesByLocation);
  }, [areaGroups]);

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

  const buildSavePayload = (): UpdateStockOpnameInput => {
    const stacksPayload: NonNullable<UpdateStockOpnameInput["stacks"]> = [];
    for (const { locations } of areaGroups) {
      for (const loc of locations) {
        const rows = calcRows[loc.key];
        const note = stackNotes[loc.key] ?? "";
        if (
          !rows ||
          (rows === loadedRowsRef.current[loc.key] &&
            note === loadedNotesRef.current[loc.key])
        )
          continue;
        const total = summarizeCalculationRows(rows).total;
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
                }
              : {
                  uuid: stack.uuid,
                  actualQty: total === null ? null : 0,
                  calculationRows: [],
                  note: null,
                },
          );
        });
      }
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

  const handleExportPdf = async () => {
    const toastId = toast.loading("Mengunduh Laporan Stock Opname...");
    try {
      await downloadResultPdf();
      toast.success("Unduhan sukses!", { id: toastId });
    } catch (e) {
      toast.error("Gagal mengunduh berkas PDF.", { id: toastId });
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Breadcrumb Navigation */}
      <button
        onClick={() => router.push("/stock-opname")}
        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
      >
        <ChevronLeft className="h-4 w-4" />
        Kembali ke Daftar Stock Opname
      </button>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl md:text-2xl font-black text-slate-850 dark:text-slate-100">
              {detailData.opnameNumber}
            </span>
            {isDraft ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-150 dark:border-amber-900/30">
                Draf Perhitungan
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-900/30">
                Final (Completed)
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              Mulai:{" "}
              {new Date(detailData.createdAt).toLocaleString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {detailData.completionDate && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                Selesai:{" "}
                {new Date(detailData.completionDate).toLocaleString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <span>Pembuat: {detailData.createdBy}</span>
          </div>
        </div>

        {/* Action button bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {!isDraft && (
            <button
              onClick={handleExportPdf}
              className="flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm"
            >
              <FileText className="h-4.5 w-4.5 mr-2 text-slate-500" />
              Unduh Laporan Hasil
            </button>
          )}

          <button
            onClick={handlePrintPhysicalCountSheet}
            className="flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm"
          >
            <Printer className="h-4.5 w-4.5 mr-2 text-slate-500" />
            Cetak Lembar Hitung Fisik
          </button>

          {isDraft && (
            <>
              {canDelete && (
                <button
                  onClick={handleDeleteOpname}
                  disabled={isSaving || isSubmitting || isDeleting}
                  className="flex items-center justify-center bg-white border border-red-200 text-red-600 hover:bg-red-50/50 font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4.5 w-4.5 mr-2" />
                  {isDeleting ? "Menghapus..." : "Hapus Draf"}
                </button>
              )}

              <button
                onClick={handleSaveDraft}
                disabled={isSaving || isSubmitting || hasInvalidExpression}
                className="flex items-center justify-center bg-white border border-blue-200 text-blue-600 hover:bg-blue-50/50 font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4.5 w-4.5 mr-2" />
                {isSaving ? "Menyimpan..." : "Simpan Draf"}
              </button>

              <button
                onClick={handleSubmitOpname}
                disabled={isSaving || isSubmitting || hasInvalidExpression}
                className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-emerald-500/10 transition cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="h-4.5 w-4.5 mr-2" />
                {isSubmitting ? "Memproses..." : "Selesaikan Opname"}
              </button>
            </>
          )}
        </div>
      </div>

      {isDraft && (
        <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4 flex items-start gap-3.5 shadow-xs">
          <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-bold">Panduan Counting:</span> Klik pada
            lokasi (mis. GBB 01, GKP) untuk menampilkan tumpukannya. Buka
            &quot;Perhitungan Kuantum Fisik&quot; untuk memasukkan hasil hitung
            tumpukan (satu isian untuk semua SKU dalam tumpukan yang sama), bisa
            berupa ekspresi seperti 20x2x5 atau (10+5)x2 dalam beberapa baris.
            Lokasi tanpa baris terisi akan diabaikan dan tidak dimasukkan ke
            dalam perhitungan selisih/varian.
          </div>
        </div>
      )}

      {isDraft && hasInvalidExpression && (
        <div className="bg-red-50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 flex items-start gap-3.5 text-xs font-semibold text-red-700 dark:text-red-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          Masih ada ekspresi perhitungan yang tidak valid. Perbaiki terlebih
          dahulu sebelum menyimpan atau menyelesaikan Stock Opname.
        </div>
      )}

      {/* Locations list card, grouped by area (GBB 01, GBB 02, GKP, ...) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80">
          <h2 className="text-base font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600 shrink-0" />
            Tabel Hitung per Lokasi (
            {areaGroups.reduce((n, a) => n + a.locations.length, 0)} Tumpukan)
          </h2>
        </div>

        {areaGroups.length === 0 && (
          <p className="px-6 py-8 text-center text-xs italic text-slate-400">
            Tidak ada lokasi dengan Snapshot ERP atau Stok Rekonsiliasi lebih
            dari 0.
          </p>
        )}

        <div className="divide-y divide-slate-150 dark:divide-slate-800">
          {areaGroups.map(({ area, locations }) => {
            const isExpanded = !!expandedAreas[area];
            const countedCount = locations.filter(
              (loc) => locationPhysicalQty(loc) !== null,
            ).length;

            return (
              <div key={area}>
                {/* Area header */}
                <button
                  type="button"
                  onClick={() => toggleAreaExpand(area)}
                  aria-expanded={isExpanded}
                  className={`w-full flex items-center gap-2 px-6 py-4 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition cursor-pointer select-none ${
                    isExpanded ? "bg-slate-50/20 dark:bg-slate-850/10" : ""
                  }`}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                  )}
                  <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {area}
                  </span>
                  <span className="ml-auto text-xs font-semibold text-slate-400">
                    {countedCount}/{locations.length} tumpukan dihitung
                  </span>
                </button>

                {isExpanded && (
                  <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800">
                        <tr className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          <th className="px-6 py-3 w-[16%]">Tumpukan</th>
                          <th className="px-6 py-3 w-[28%]">Komoditas</th>
                          <th className="px-6 py-3 text-right w-[14%]">
                            Snapshot ERP
                          </th>
                          <th className="px-6 py-3 text-right w-[14%]">
                            Stok Rekonsiliasi
                          </th>
                          <th className="px-6 py-3 text-right w-[14%]">
                            Hasil Hitung Fisik
                          </th>
                          <th className="px-6 py-3 text-right w-[14%]">
                            Selisih
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
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

                          return (
                            <React.Fragment key={loc.key}>
                              <tr className="align-top">
                                <td className="px-6 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                                  {loc.locationName}
                                </td>
                                <td className="px-6 py-3.5 space-y-1.5">
                                  {loc.entries.map((e) => (
                                    <div key={e.stack.uuid}>
                                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                                        {e.productName}
                                      </div>
                                      <div className="text-slate-400 font-mono text-[10px]">
                                        {e.productSku}
                                        {isMixed &&
                                          ` · ERP ${formatQuantity(e.stack.erpQty)} ${e.productUom ?? ""}`}
                                      </div>
                                    </div>
                                  ))}
                                </td>
                                <td className="px-6 py-3.5 text-right font-bold text-slate-700 dark:text-slate-300">
                                  {formatQuantity(loc.erpQty)}{" "}
                                  <span className="text-slate-400 text-xs font-normal">
                                    {loc.uom}
                                  </span>
                                </td>
                                <td className="px-6 py-3.5 text-right font-bold text-slate-500 dark:text-slate-400">
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
                                </td>
                                <td className="px-6 py-3.5 text-right font-extrabold text-slate-800 dark:text-slate-200">
                                  {physicalQty !== null ? (
                                    <>
                                      {formatQuantity(physicalQty)}{" "}
                                      <span className="text-slate-400 text-xs font-normal">
                                        {loc.uom}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-slate-350 dark:text-slate-650 italic font-normal text-xs">
                                      Belum dihitung
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-3.5 text-right font-black">
                                  {variance !== null ? (
                                    <span className={varianceClass(variance)}>
                                      {formatSignedQuantity(variance)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                              </tr>
                              <tr>
                                <td colSpan={6} className="px-6 pb-3.5">
                                  <div className="rounded-lg border border-slate-150 dark:border-slate-800">
                                    <button
                                      type="button"
                                      onClick={() => toggleCalculator(loc.key)}
                                      aria-expanded={isCalcOpen}
                                      className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg transition cursor-pointer"
                                    >
                                      {isCalcOpen ? (
                                        <ChevronDown className="h-4 w-4 shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 shrink-0" />
                                      )}
                                      <Calculator className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                      Perhitungan Kuantum Fisik
                                      {summary.hasError && (
                                        <span className="ml-auto inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                                          <AlertTriangle className="h-3.5 w-3.5" />
                                          Ekspresi tidak valid
                                        </span>
                                      )}
                                    </button>
                                    {isCalcOpen && (
                                      <div className="max-w-2xl px-3 pb-3 pt-1">
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
                                  <div className="mt-2 flex items-start gap-1.5">
                                    <StickyNote className="h-3.5 w-3.5 mt-2 text-amber-500 shrink-0" />
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
                                        placeholder={`Catatan tumpukan ${loc.locationName} (mis. karung rusak, tumpukan miring)...`}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white dark:bg-slate-850 dark:border-slate-800 dark:text-slate-200"
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
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
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
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
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
    </div>
  );
}

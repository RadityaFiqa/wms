"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
} from "lucide-react";
import { useAuthStore } from "@/store/auth";

// Rows to show for a stack: saved calculator rows, or the legacy total as a single row
function initialCalculationRows(stack: {
  actualQty: number | null;
  calculationRows?: StockOpnameCalculationRow[] | null;
}): string[] {
  if (stack.calculationRows && stack.calculationRows.length > 0) {
    return stack.calculationRows.map((r) => r.expression);
  }
  if (stack.actualQty !== null) {
    const str = String(stack.actualQty);
    // Avoid exponent notation (e.g. 1e-7), which the expression parser rejects
    return [/e/i.test(str) ? stack.actualQty.toFixed(QUANTITY_PRECISION) : str];
  }
  return [""];
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
    downloadCountingSheet,
    downloadPhysicalCountSheet,
    downloadResultPdf,
  } = useStockOpnameDetail(uuid);
  const { hasPermission } = useAuthStore();
  const canDelete = hasPermission("delete", "StockOpname");
  const [isDeleting, setIsDeleting] = useState(false);

  const [notes, setNotes] = useState("");
  // Calculator rows per stack uuid; the physical count is their total
  const [calcRows, setCalcRows] = useState<Record<string, string[]>>({});
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<
    Record<string, boolean>
  >({});
  const [expandedCalculators, setExpandedCalculators] = useState<
    Record<string, boolean>
  >({});
  // Rows as loaded, to leave legacy counts untouched when the user did not edit them
  const loadedRowsRef = useRef<Record<string, string[]>>({});
  const legacyStacksRef = useRef<Record<string, number | null>>({});

  // Sync state with loaded data
  useEffect(() => {
    if (detailData) {
      setNotes(detailData.notes || "");

      const rows: Record<string, string[]> = {};
      const legacy: Record<string, number | null> = {};
      for (const item of detailData.items) {
        for (const stack of item.stacks) {
          rows[stack.uuid] = initialCalculationRows(stack);
          if (!stack.calculationRows?.length) {
            legacy[stack.uuid] = stack.actualQty;
          }
        }
      }
      loadedRowsRef.current = rows;
      legacyStacksRef.current = legacy;
      setCalcRows(rows);
      setAttachmentPaths(detailData.attachments.map((a: any) => a.filePath));
    }
  }, [detailData]);

  const handleRowsChange = useCallback((stackUuid: string, rows: string[]) => {
    setCalcRows((prev) => ({ ...prev, [stackUuid]: rows }));
  }, []);

  const toggleCalculator = useCallback((stackUuid: string) => {
    setExpandedCalculators((prev) => ({
      ...prev,
      [stackUuid]: !prev[stackUuid],
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

  // Toggle row expansion
  const toggleProductExpand = (prodUuid: string) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [prodUuid]: !prev[prodUuid],
    }));
  };

  const buildSavePayload = (): UpdateStockOpnameInput => {
    const stacksPayload = Object.entries(calcRows).map(([stackUuid, rows]) => {
      // Legacy count (no saved rows) the user did not touch: send it back as-is
      if (
        stackUuid in legacyStacksRef.current &&
        rows === loadedRowsRef.current[stackUuid]
      ) {
        return {
          uuid: stackUuid,
          actualQty: legacyStacksRef.current[stackUuid],
        };
      }
      return {
        uuid: stackUuid,
        actualQty: summarizeCalculationRows(rows).total,
        calculationRows: rows.filter((r) => r.trim() !== ""),
      };
    });
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
    const toastId = toast.loading(
      isDraft
        ? "Mengunduh Counting Sheet..."
        : "Mengunduh Laporan Stock Opname...",
    );
    try {
      if (isDraft) {
        await downloadCountingSheet();
      } else {
        await downloadResultPdf();
      }
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
          <button
            onClick={handleExportPdf}
            className="flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm"
          >
            <FileText className="h-4.5 w-4.5 mr-2 text-slate-500" />
            {isDraft ? "Cetak Counting Sheet" : "Unduh Laporan Hasil"}
          </button>

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
            <span className="font-bold">Panduan Counting:</span> Klik pada baris
            produk di tabel untuk menampilkan rincian tumpukan/lokasi. Buka
            &quot;Perhitungan Kuantum Fisik&quot; untuk memasukkan hasil hitung,
            bisa berupa ekspresi seperti 20x2x5 atau (10+5)x2 dalam beberapa
            baris. Lokasi tanpa baris terisi akan diabaikan dan tidak
            dimasukkan ke dalam perhitungan selisih/varian.
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

      {/* Products list card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80">
          <h2 className="text-base font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600 shrink-0" />
            Tabel Hitung Produk ({detailData.items.length} Item)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-layout-fixed">
            <thead className="bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3.5 w-[35%]">Produk</th>
                <th className="px-6 py-3.5 text-right w-[18%]">
                  ERP Stock Snapshot
                </th>
                <th className="px-6 py-3.5 text-right w-[18%]">
                  Realtime Stock Snapshot
                </th>
                <th className="px-6 py-3.5 text-right w-[18%]">
                  Perhitungan Aktual
                </th>
                <th className="px-6 py-3.5 text-right w-[11%]">Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {detailData.items.map((item: any) => {
                const isExpanded = !!expandedProducts[item.uuid];

                // Sum actual counts
                let actualSum = 0;
                let hasActualVal = false;
                for (const stack of item.stacks) {
                  const rows = calcRows[stack.uuid];
                  const val = isDraft
                    ? rows
                      ? summarizeCalculationRows(rows).total
                      : null
                    : stack.actualQty;
                  if (val !== null) {
                    actualSum += val;
                    hasActualVal = true;
                  }
                }
                actualSum = roundQuantity(actualSum);

                // If completed, use completed difference, otherwise calculate dynamically
                const diff = !isDraft
                  ? item.difference
                  : hasActualVal
                    ? roundQuantity(actualSum - item.erpStock)
                    : null;

                return (
                  <React.Fragment key={item.uuid}>
                    {/* Product Row */}
                    <tr
                      onClick={() => toggleProductExpand(item.uuid)}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 border-b border-slate-150/40 dark:border-slate-800/40 transition cursor-pointer select-none ${
                        isExpanded ? "bg-slate-50/20 dark:bg-slate-850/10" : ""
                      }`}
                    >
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                        <div className="p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4.5 w-4.5 text-slate-500" />
                          ) : (
                            <ChevronRight className="h-4.5 w-4.5 text-slate-500" />
                          )}
                        </div>
                        <div className="truncate">
                          <div>{item.productName}</div>
                          <div className="text-slate-400 font-mono text-[10px] mt-0.5">
                            {item.productSku}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-700 dark:text-slate-300">
                        {item.erpStock.toLocaleString("id-ID")}{" "}
                        <span className="text-slate-400 text-xs font-normal ml-0.5">
                          {item.productUom}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-500 dark:text-slate-400">
                        {item.realtimeStock.toLocaleString("id-ID")}{" "}
                        <span className="text-slate-400 text-xs font-normal ml-0.5">
                          {item.productUom}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-extrabold text-slate-800 dark:text-slate-200">
                        {hasActualVal ? (
                          <span>
                            {actualSum.toLocaleString("id-ID")}{" "}
                            <span className="text-slate-400 text-xs font-normal ml-0.5">
                              {item.productUom}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-350 dark:text-slate-650 italic font-normal text-xs">
                            Belum dihitung
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {diff !== null ? (
                          <span
                            className={`font-black text-xs px-2 py-0.5 rounded ${
                              diff < 0
                                ? "bg-red-50 text-red-700 border border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30"
                                : diff > 0
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30"
                                  : "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                            }`}
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>

                    {/* Stacks/Locations Inputs nested area */}
                    {isExpanded && (
                      <tr>
                        <td
                          colSpan={5}
                          className="bg-slate-50/50 dark:bg-slate-900/20 px-8 py-4 border-b border-slate-200 dark:border-slate-800"
                        >
                          <div className="max-w-2xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4 space-y-3.5 shadow-xs">
                            <div className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
                              <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
                              <span>Hitung Per Tumpukan / Lokasi</span>
                            </div>

                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {item.stacks.length === 0 && (
                                <p className="py-2.5 text-xs italic text-slate-400">
                                  Tidak ada lokasi dengan Snapshot ERP atau
                                  Stok Rekonsiliasi lebih dari 0.
                                </p>
                              )}
                              {item.stacks.map((stack: any) => {
                                const rows = calcRows[stack.uuid] ?? [""];
                                const summary = summarizeCalculationRows(rows);
                                const physicalQty: number | null = isDraft
                                  ? summary.total
                                  : stack.actualQty;
                                const stackVar: number | null = isDraft
                                  ? physicalQty !== null
                                    ? roundQuantity(physicalQty - stack.erpQty)
                                    : null
                                  : stack.variance;
                                const isCalcOpen =
                                  !!expandedCalculators[stack.uuid];

                                return (
                                  <div
                                    key={stack.uuid}
                                    className="py-3 space-y-2.5 text-xs sm:text-sm"
                                  >
                                    <div className="font-bold text-slate-800 dark:text-slate-200">
                                      {stack.locationName}
                                    </div>

                                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-[11px]">
                                      <div>
                                        <dt className="text-slate-400">
                                          Snapshot ERP
                                        </dt>
                                        <dd className="font-bold text-slate-600 dark:text-slate-400">
                                          {formatQuantity(stack.erpQty)}{" "}
                                          {item.productUom}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="text-slate-400">
                                          Stok Rekonsiliasi
                                        </dt>
                                        <dd className="font-bold text-slate-600 dark:text-slate-400">
                                          {stack.calculatedPhysical !== null &&
                                          stack.calculatedPhysical !== undefined
                                            ? `${formatQuantity(stack.calculatedPhysical)} ${item.productUom ?? ""}`
                                            : "-"}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="text-slate-400">
                                          Hasil Hitung Fisik
                                        </dt>
                                        <dd className="font-black text-slate-800 dark:text-slate-200">
                                          {physicalQty !== null ? (
                                            `${formatQuantity(physicalQty)} ${item.productUom ?? ""}`
                                          ) : (
                                            <span className="font-normal italic text-slate-400">
                                              Belum dihitung
                                            </span>
                                          )}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="text-slate-400">
                                          Selisih (vs ERP)
                                        </dt>
                                        <dd className="font-black">
                                          {stackVar !== null ? (
                                            <span
                                              className={varianceClass(stackVar)}
                                            >
                                              {formatSignedQuantity(stackVar)}
                                            </span>
                                          ) : (
                                            <span className="text-slate-300">
                                              -
                                            </span>
                                          )}
                                        </dd>
                                      </div>
                                    </dl>

                                    <div className="rounded-lg border border-slate-150 dark:border-slate-800">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleCalculator(stack.uuid)
                                        }
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
                                        <div className="px-3 pb-3 pt-1">
                                          <QuantityCalculatorRows
                                            rowsKey={stack.uuid}
                                            rows={rows}
                                            onChange={handleRowsChange}
                                            uom={item.productUom}
                                            disabled={!isDraft}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
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

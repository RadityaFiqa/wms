"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileDown,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  useTagihanReportsStatus,
  generateTagihanReport,
} from "@/hooks/useTagihan";

interface TagihanExportReportsProps {
  tagihanUuid: string;
  tagihanType: string; // "LOADING" | "UNLOADING" | etc.
  hasErpDocuments: boolean;
  onFilesChange?: () => void;
}

export function TagihanExportReports({
  tagihanUuid,
  tagihanType,
  hasErpDocuments,
  onFilesChange,
}: TagihanExportReportsProps) {
  const isEligible = tagihanType === "LOADING" || tagihanType === "UNLOADING";
  const { reportsStatus, isLoading, refresh } =
    useTagihanReportsStatus(tagihanUuid);

  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isEligible) {
    return null; // Feature is strictly scoped to LOADING and UNLOADING
  }

  const handleTriggerReport = async (
    reportType: "COMMODITY_RECAP_EXCEL" | "COMMODITY_RECAP_PDF" | "ODOO_REPORT_PDF",
  ) => {
    setActionError(null);
    if (!hasErpDocuments) {
      setActionError("Pilih minimal satu dokumen ERP Commodity untuk menghasilkan laporan.");
      return;
    }

    setLoadingType(reportType);
    try {
      const res = await generateTagihanReport(tagihanUuid, reportType);
      // If it was cached, trigger immediate download
      if (res?.isCached && res?.file?.downloadUrl) {
        window.open(res.file.downloadUrl, "_blank");
      }
      refresh();
      if (onFilesChange) {
        onFilesChange();
      }
    } catch (err: any) {
      setActionError(
        err?.response?.data?.message ||
          err?.message ||
          "Gagal memproses permintaan laporan.",
      );
    } finally {
      setLoadingType(null);
    }
  };

  const getReportState = (
    reportType: "COMMODITY_RECAP_EXCEL" | "COMMODITY_RECAP_PDF" | "ODOO_REPORT_PDF",
  ) => {
    return (
      reportsStatus?.reports?.[reportType] || {
        status: "IDLE",
        file: null,
        progress: 0,
        stage: null,
        processedCount: 0,
        totalCount: 0,
        currentItem: null,
        errorMessage: null,
      }
    );
  };

  const excelState = getReportState("COMMODITY_RECAP_EXCEL");
  const pdfState = getReportState("COMMODITY_RECAP_PDF");
  const odooState = getReportState("ODOO_REPORT_PDF");

  const isExcelRunning =
    excelState.status === "PENDING" ||
    excelState.status === "PROCESSING" ||
    loadingType === "COMMODITY_RECAP_EXCEL";

  const isPdfRunning =
    pdfState.status === "PENDING" ||
    pdfState.status === "PROCESSING" ||
    loadingType === "COMMODITY_RECAP_PDF";

  const isOdooRunning =
    odooState.status === "PENDING" ||
    odooState.status === "PROCESSING" ||
    loadingType === "ODOO_REPORT_PDF";

  const odooDocName =
    tagihanType === "LOADING"
      ? "Picking Operation Template"
      : "Delivery Slip Template";

  const odooStageLabel = (() => {
    const counter =
      odooState.totalCount > 0
        ? ` (${odooState.processedCount ?? 0}/${odooState.totalCount})`
        : "";
    switch (odooState.stage) {
      case "DOWNLOADING":
        return `Mengunduh PDF${counter}`;
      case "OPTIMIZING":
        return `Mengoptimalkan halaman PDF${counter}`;
      case "MERGING":
        return "Menggabungkan PDF";
      case "SAVING":
        return "Menyimpan PDF final";
      case "COMPLETED":
        return "Selesai";
      case "FAILED":
        return "Gagal";
      default:
        return "Menyiapkan dokumen";
    }
  })();

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Export & Reports Rekapitulasi
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
              {tagihanType === "LOADING" ? "Loading (Outgoing)" : "Unloading (Incoming)"}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Export rekapitulasi kuantitas & kuantum komoditas dari dokumen ERP terkait serta unduh laporan PDF resmi Odoo. Berkas otomatis disimpan ke Supporting Files.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refresh()}
          disabled={isLoading}
          className="self-start sm:self-auto px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition inline-flex items-center gap-1.5 cursor-pointer"
          title="Perbarui Status Laporan"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
          Perbarui Status
        </button>
      </div>

      {actionError && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Grid of Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Rekapitulasi Excel Card */}
        <div className="flex flex-col justify-between p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-4 hover:border-emerald-300 dark:hover:border-emerald-700 transition">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              {excelState.status === "COMPLETED" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Tersedia
                </span>
              )}
              {isExcelRunning && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900">
                  <Loader2 className="h-3 w-3 animate-spin text-amber-600" /> Memproses ({excelState.progress}%)
                </span>
              )}
              {excelState.status === "FAILED" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900">
                  <AlertCircle className="h-3 w-3 text-red-600" /> Gagal
                </span>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Rekapitulasi Excel (.xlsx)
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                Tabel rekapitulasi kuantitas dan kuantum komoditas terhubung, lengkap dengan header dan baris total.
              </p>
            </div>

            {excelState.status === "FAILED" && excelState.errorMessage && (
              <p className="text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg border border-red-100 dark:border-red-900/40">
                {excelState.errorMessage}
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-col gap-2">
            {excelState.status === "COMPLETED" && excelState.file?.downloadUrl ? (
              <div className="flex items-center gap-2">
                <a
                  href={excelState.file.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={excelState.file.fileName}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 inline-flex items-center justify-center gap-1.5 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh Excel
                </a>
                <button
                  type="button"
                  disabled={isExcelRunning}
                  onClick={() => handleTriggerReport("COMMODITY_RECAP_EXCEL")}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer"
                  title="Generate Ulang"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isExcelRunning || !hasErpDocuments}
                onClick={() => handleTriggerReport("COMMODITY_RECAP_EXCEL")}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isExcelRunning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sedang Diproses...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    {excelState.status === "FAILED" ? "Coba Lagi (Retry)" : "Export Excel"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 2. Rekapitulasi PDF Card */}
        <div className="flex flex-col justify-between p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-4 hover:border-rose-300 dark:hover:border-rose-700 transition">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-rose-100/70 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                <FileText className="h-5 w-5" />
              </div>
              {pdfState.status === "COMPLETED" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Tersedia
                </span>
              )}
              {isPdfRunning && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900">
                  <Loader2 className="h-3 w-3 animate-spin text-amber-600" /> Memproses ({pdfState.progress}%)
                </span>
              )}
              {pdfState.status === "FAILED" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900">
                  <AlertCircle className="h-3 w-3 text-red-600" /> Gagal
                </span>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Rekapitulasi PDF
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                Format laporan PDF resmi rekapitulasi pengeluaran/pemasukan dengan header Kanwil, Kompleks Gudang, dan tanda tangan.
              </p>
            </div>

            {pdfState.status === "FAILED" && pdfState.errorMessage && (
              <p className="text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg border border-red-100 dark:border-red-900/40">
                {pdfState.errorMessage}
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-col gap-2">
            {pdfState.status === "COMPLETED" && pdfState.file?.downloadUrl ? (
              <div className="flex items-center gap-2">
                <a
                  href={pdfState.file.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={pdfState.file.fileName}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-600/20 inline-flex items-center justify-center gap-1.5 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh PDF
                </a>
                <button
                  type="button"
                  disabled={isPdfRunning}
                  onClick={() => handleTriggerReport("COMMODITY_RECAP_PDF")}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer"
                  title="Generate Ulang"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isPdfRunning || !hasErpDocuments}
                onClick={() => handleTriggerReport("COMMODITY_RECAP_PDF")}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50 inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isPdfRunning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sedang Diproses...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    {pdfState.status === "FAILED" ? "Coba Lagi (Retry)" : "Export PDF"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 3. Download Odoo Report Card */}
        <div className="flex flex-col justify-between p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-indigo-100/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
                <FileDown className="h-5 w-5" />
              </div>
              {odooState.status === "COMPLETED" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Tersedia
                </span>
              )}
              {isOdooRunning && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900">
                  <Loader2 className="h-3 w-3 animate-spin text-amber-600" /> Memproses ({odooState.progress}%)
                </span>
              )}
              {odooState.status === "FAILED" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900">
                  <AlertCircle className="h-3 w-3 text-red-600" /> Gagal
                </span>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Laporan Asli Odoo
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                Unduh PDF resmi dari Odoo ({odooDocName}) per dokumen stock.picking secara berurutan, PDF 2 halaman atau lebih dibuat 2-up, lalu digabung menjadi satu berkas.
              </p>
            </div>

            {isOdooRunning && (
              <div className="space-y-1.5 p-2.5 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-800 dark:text-indigo-300">
                  <span>{odooStageLabel}</span>
                  <span>{odooState.progress ?? 0}%</span>
                </div>
                <div
                  className="h-1.5 w-full rounded-full bg-indigo-100 dark:bg-indigo-900/50 overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={odooState.progress ?? 0}
                >
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                    style={{ width: `${odooState.progress ?? 0}%` }}
                  />
                </div>
                {odooState.currentItem && (
                  <p className="text-[10px] text-indigo-700/80 dark:text-indigo-400/80 truncate" title={odooState.currentItem}>
                    Dokumen: {odooState.currentItem}
                  </p>
                )}
              </div>
            )}

            {odooState.status === "FAILED" && odooState.errorMessage && (
              <p className="text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg border border-red-100 dark:border-red-900/40">
                {odooState.errorMessage}
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-col gap-2">
            {odooState.status === "COMPLETED" && odooState.file?.downloadUrl ? (
              <div className="flex items-center gap-2">
                <a
                  href={odooState.file.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={odooState.file.fileName}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 inline-flex items-center justify-center gap-1.5 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh PDF Odoo
                </a>
                <button
                  type="button"
                  disabled={isOdooRunning}
                  onClick={() => handleTriggerReport("ODOO_REPORT_PDF")}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer"
                  title="Generate Ulang"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isOdooRunning || !hasErpDocuments}
                onClick={() => handleTriggerReport("ODOO_REPORT_PDF")}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isOdooRunning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sedang Diproses...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    {odooState.status === "FAILED" ? "Coba Lagi (Retry)" : "Download Odoo Report"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

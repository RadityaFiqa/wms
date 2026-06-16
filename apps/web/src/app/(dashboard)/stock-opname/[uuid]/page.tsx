"use client";

import React, { useState, useEffect } from "react";
import { useStockOpnameDetail } from "@/hooks/useStockOpname";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import {
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
} from "lucide-react";

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
    downloadCountingSheet,
    downloadResultPdf,
  } = useStockOpnameDetail(uuid);

  const [notes, setNotes] = useState("");
  const [actualCounts, setActualCounts] = useState<Record<string, number | "">>(
    {},
  );
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<
    Record<string, boolean>
  >({});

  // Sync state with loaded data
  useEffect(() => {
    if (detailData) {
      setNotes(detailData.notes || "");

      const counts: Record<string, number | ""> = {};
      for (const item of detailData.items) {
        for (const stack of item.stacks) {
          counts[stack.uuid] = stack.actualQty !== null ? stack.actualQty : "";
        }
      }
      setActualCounts(counts);
      setAttachmentPaths(detailData.attachments.map((a: any) => a.filePath));
    }
  }, [detailData]);

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

  const handleInputChange = (stackUuid: string, val: string) => {
    if (!isDraft) return;
    const num = val === "" ? "" : Number(val);
    if (num !== "" && isNaN(num)) return;
    setActualCounts((prev) => ({
      ...prev,
      [stackUuid]: num,
    }));
  };

  const buildSavePayload = () => {
    const stacksPayload = Object.entries(actualCounts).map(
      ([stackUuid, val]) => ({
        uuid: stackUuid,
        actualQty: val === "" ? null : val,
      }),
    );
    return {
      notes,
      stacks: stacksPayload,
      attachmentPaths,
    };
  };

  const handleSaveDraft = async () => {
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

          {isDraft && (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={isSaving || isSubmitting}
                className="flex items-center justify-center bg-white border border-blue-200 text-blue-600 hover:bg-blue-50/50 font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm"
              >
                <Save className="h-4.5 w-4.5 mr-2" />
                {isSaving ? "Menyimpan..." : "Simpan Draf"}
              </button>

              <button
                onClick={handleSubmitOpname}
                disabled={isSaving || isSubmitting}
                className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-emerald-500/10 transition cursor-pointer text-sm"
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
            produk di tabel untuk menampilkan rincian tumpukan/lokasi. Masukkan
            kuantitas aktual yang Anda hitung. Kolom input yang dibiarkan kosong
            akan diabaikan dan tidak dimasukkan ke dalam perhitungan
            selisih/varian.
          </div>
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
                  const val = actualCounts[stack.uuid];
                  if (val !== undefined && val !== "") {
                    actualSum += Number(val);
                    hasActualVal = true;
                  }
                }

                // If completed, use completed difference, otherwise calculate dynamically
                const diff = !isDraft
                  ? item.difference
                  : hasActualVal
                    ? actualSum - item.erpStock
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
                              {item.stacks.map((stack: any) => {
                                const inputVal = actualCounts[stack.uuid];
                                const stackVar =
                                  inputVal !== undefined && inputVal !== ""
                                    ? Number(inputVal) - stack.erpQty
                                    : null;

                                return (
                                  <div
                                    key={stack.uuid}
                                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs sm:text-sm"
                                  >
                                    <div className="space-y-0.5">
                                      <div className="font-bold text-slate-800 dark:text-slate-200">
                                        {stack.locationName}
                                      </div>
                                      <div className="text-[11px] text-slate-400">
                                        Qty Snapshot ERP:{" "}
                                        <strong className="font-bold text-slate-600 dark:text-slate-400">
                                          {stack.erpQty.toLocaleString("id-ID")}{" "}
                                          {item.productUom}
                                        </strong>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                      {/* Input */}
                                      <div className="flex items-center gap-2">
                                        <label className="text-xs text-slate-400 font-medium">
                                          Aktual:
                                        </label>
                                        <input
                                          type="text"
                                          disabled={!isDraft}
                                          value={
                                            isDraft
                                              ? inputVal
                                              : stack.actualQty !== null
                                                ? stack.actualQty
                                                : ""
                                          }
                                          onChange={(e) =>
                                            handleInputChange(
                                              stack.uuid,
                                              e.target.value,
                                            )
                                          }
                                          placeholder="Belum dihitung"
                                          className="w-28 bg-slate-50 dark:bg-slate-800 border border-slate-250 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-right text-xs focus:outline-none focus:border-blue-500 focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                                        />
                                        <span className="text-xs text-slate-450">
                                          {item.productUom}
                                        </span>
                                      </div>

                                      {/* Variance at stack level */}
                                      <div className="w-16 text-right font-black">
                                        {isDraft ? (
                                          stackVar !== null ? (
                                            <span
                                              className={
                                                stackVar < 0
                                                  ? "text-red-650"
                                                  : stackVar > 0
                                                    ? "text-emerald-650"
                                                    : "text-slate-500"
                                              }
                                            >
                                              {stackVar > 0
                                                ? `+${stackVar}`
                                                : stackVar}
                                            </span>
                                          ) : (
                                            <span className="text-slate-300">
                                              -
                                            </span>
                                          )
                                        ) : stack.variance !== null ? (
                                          <span
                                            className={
                                              stack.variance < 0
                                                ? "text-red-650"
                                                : stack.variance > 0
                                                  ? "text-emerald-650"
                                                  : "text-slate-500"
                                            }
                                          >
                                            {stack.variance > 0
                                              ? `+${stack.variance}`
                                              : stack.variance}
                                          </span>
                                        ) : (
                                          <span className="text-slate-300">
                                            -
                                          </span>
                                        )}
                                      </div>
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

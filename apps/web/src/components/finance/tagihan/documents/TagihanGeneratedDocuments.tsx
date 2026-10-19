"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { FileStack, Loader2, Eye, FileDown, CheckCircle2, XCircle, X } from "lucide-react";
import { TAGIHAN_PURPOSE_LABELS, type TagihanGeneratedDocumentItem } from "@bulog-wms/schema";
import PdfViewer from "@/components/PdfViewer";
import { getTagihanDocumentUrl } from "@/hooks/useTagihanDocuments";

interface TagihanGeneratedDocumentsProps {
  tagihanUuid: string;
  documents: TagihanGeneratedDocumentItem[];
  isLoading: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  PENDING: "Menunggu antrean",
  PREPARING: "Menyiapkan template",
  RENDERING: "Mengisi data",
  CONVERTING: "Konversi ke PDF",
  MERGING: "Menyusun dokumen",
  SAVING: "Menyimpan file",
};

/** Generation history for Surat Permohonan & Tanda Terima with live progress */
export function TagihanGeneratedDocuments({ tagihanUuid, documents, isLoading }: TagihanGeneratedDocumentsProps) {
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const openPreview = async (doc: TagihanGeneratedDocumentItem) => {
    try {
      const url = await getTagihanDocumentUrl(tagihanUuid, doc.uuid, "preview");
      setPreview({ url, title: doc.title });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memuat preview dokumen.");
    }
  };

  const download = async (doc: TagihanGeneratedDocumentItem, format: "pdf" | "docx") => {
    try {
      const url = await getTagihanDocumentUrl(tagihanUuid, doc.uuid, format);
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengunduh file.");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
          <FileStack className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Dokumen Tagihan</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Riwayat Surat Permohonan &amp; Tanda Terima. File hasil juga tersimpan di Supporting Files.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Memuat riwayat...
        </div>
      ) : documents.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400">
          Belum ada dokumen. Gunakan tombol Generate Dokumen atau Generate Tanda Terima di atas.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
          {documents.map((doc) => (
            <li key={doc.uuid} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {TAGIHAN_PURPOSE_LABELS[doc.purpose]}
                  </span>
                  <StatusBadge doc={doc} />
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{doc.title}</div>
                <div className="text-[11px] text-slate-500">
                  No. {doc.documentNumber} · {doc.template?.name ?? "-"} v{doc.template?.version ?? "-"} ·{" "}
                  {new Date(doc.generatedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                  {doc.generator?.name ? ` · ${doc.generator.name}` : ""}
                </div>
                {doc.status === "PROCESSING" && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>{STAGE_LABELS[doc.stage ?? ""] ?? "Memproses"}</span>
                      <span>{doc.progress}%</span>
                    </div>
                    <div
                      className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={doc.progress}
                    >
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${doc.progress}%` }} />
                    </div>
                  </div>
                )}
                {doc.status === "FAILED" && doc.errorMessage && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 break-words">{doc.errorMessage}</p>
                )}
              </div>

              {doc.status === "GENERATED" && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openPreview(doc)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => download(doc, "pdf")}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FileDown className="h-3.5 w-3.5" /> PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => download(doc, "docx")}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FileDown className="h-3.5 w-3.5" /> DOCX
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{preview.title}</h3>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Tutup preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-50 dark:bg-slate-950">
              <PdfViewer url={preview.url} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ doc }: { doc: TagihanGeneratedDocumentItem }) {
  if (doc.status === "GENERATED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Selesai
      </span>
    );
  }
  if (doc.status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
        <XCircle className="h-3.5 w-3.5" /> Gagal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Diproses
    </span>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useDocumentGenerator } from "@/hooks/useDocumentGenerator";
import { toast } from "sonner";
import {
  FileText,
  Search,
  Filter,
  Eye,
  Download,
  FileDown,
  Trash2,
  Calendar,
  X,
  History,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import PdfViewer from "@/components/PdfViewer";

export default function DocumentHistoryPage() {
  const { hasPermission } = useAuthStore();
  const {
    categories,
    getTemplates,
    getGeneratedHistory,
    getPreviewUrl,
    getDownloadDocxUrl,
    getDownloadPdfUrl,
    deleteGeneratedDocument,
  } = useDocumentGenerator();

  // Data states
  const [docs, setDocs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1 });

  // Filter states
  const [search, setSearch] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  // Load initial templates filter options
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await getTemplates({ page: 1, limit: 100 });
        setTemplates(res.data);
      } catch (err) {
        console.error("Gagal memuat template:", err);
      }
    };
    loadTemplates();
  }, []);

  // Load history list
  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await getGeneratedHistory({
        page,
        limit: 10,
        search: search || undefined,
        templateId: templateId || undefined,
        categoryId: categoryId || undefined,
        status: status || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setDocs(res.data);
      setPagination(res.pagination);
    } catch (err) {
      toast.error("Gagal memuat riwayat dokumen.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [search, templateId, categoryId, status, startDate, endDate, page]);

  const handlePreview = async (uuid: string, jobTitle: string) => {
    const toastId = toast.loading("Membuat tautan preview...");
    try {
      const url = await getPreviewUrl(uuid);
      setPreviewUrl(url);
      setPreviewTitle(jobTitle);
      toast.success("Preview siap ditampilkan.", { id: toastId });
    } catch (err: any) {
      toast.error("Gagal memuat preview dokumen.", { id: toastId });
    }
  };

  const handleDownload = async (uuid: string, type: "pdf" | "docx") => {
    try {
      const url = type === "pdf" ? await getDownloadPdfUrl(uuid) : await getDownloadDocxUrl(uuid);
      window.open(url, "_blank");
    } catch (err) {
      toast.error("Gagal mengunduh file.");
    }
  };

  const handleDelete = async (uuid: string, title: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus metadata dokumen "${title}"?`)) return;
    try {
      await deleteGeneratedDocument(uuid);
      toast.success("Dokumen berhasil dihapus dari riwayat.");
      loadHistory();
    } catch (err) {
      toast.error("Gagal menghapus dokumen.");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setTemplateId("");
    setCategoryId("");
    setStatus("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
            <History className="h-8 w-8 text-blue-600 mr-3" />
            Riwayat Dokumen
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Daftar seluruh dokumen yang berhasil di-generate secara dinamis dari template Word.
          </p>
        </div>
      </div>

      {/* Filters Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <input
              type="text"
              placeholder="Cari judul dokumen atau nomor..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          </div>

          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
            >
              <option value="">Semua Status</option>
              <option value="PROCESSING">Processing (Rendering)</option>
              <option value="GENERATED">Generated (Sukses)</option>
              <option value="FAILED">Failed (Gagal)</option>
            </select>
          </div>

          <div className="flex justify-end">
            <button
              onClick={resetFilters}
              className="text-xs text-blue-600 hover:text-blue-500 font-bold flex items-center justify-center p-2 cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Kategori</label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
            >
              <option value="">Semua Kategori</option>
              {categories?.map((cat: any) => (
                <option key={cat.uuid} value={cat.uuid}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Template</label>
            <select
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
            >
              <option value="">Semua Template</option>
              {templates.map((t) => (
                <option key={t.uuid} value={t.uuid}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tanggal Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tanggal Akhir</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            Memuat riwayat dokumen...
          </div>
        ) : docs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            Tidak ada dokumen hasil generate yang ditemukan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4">Judul / No Dokumen</th>
                  <th className="px-6 py-4">Template</th>
                  <th className="px-6 py-4">Kategori</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Tanggal Generate</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {docs.map((doc: any) => (
                  <tr key={doc.uuid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-850 dark:text-slate-150">
                        {doc.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-450 mt-0.5 font-mono">
                        {doc.documentNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-650 dark:text-slate-350">
                      {doc.template?.name || "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs">
                      {doc.category?.name || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          doc.status === "GENERATED"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : doc.status === "FAILED"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-955/20 dark:text-rose-400"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                        }`}
                      >
                        {doc.status === "PROCESSING" ? "Rendering" : doc.status === "GENERATED" ? "Sukses" : "Gagal"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs">
                      <div>{doc.generator?.name || "-"}</div>
                      <div className="text-[10px] mt-0.5">
                        {new Date(doc.generatedAt).toLocaleDateString("id-ID")}{" "}
                        {new Date(doc.generatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                      {doc.status === "GENERATED" && (
                        <>
                          <button
                            onClick={() => handlePreview(doc.uuid, doc.title)}
                            className="inline-flex items-center justify-center p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg cursor-pointer transition"
                            title="Preview PDF"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDownload(doc.uuid, "pdf")}
                            className="inline-flex items-center justify-center p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg cursor-pointer transition"
                            title="Unduh PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDownload(doc.uuid, "docx")}
                            className="inline-flex items-center justify-center p-2 text-slate-500 hover:text-indigo-650 hover:bg-indigo-50/20 rounded-lg cursor-pointer transition"
                            title="Unduh Word (DOCX)"
                          >
                            <FileDown className="h-4 w-4" />
                          </button>
                        </>
                      )}

                      {hasPermission("delete", "DocumentGenerated") && (
                        <button
                          onClick={() => handleDelete(doc.uuid, doc.title)}
                          className="inline-flex items-center justify-center p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-955/20 rounded-lg cursor-pointer transition"
                          title="Hapus dari Riwayat"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500">
              Menampilkan Halaman {pagination.page} dari {pagination.totalPages}
            </span>
            <div className="flex space-x-1.5">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
              >
                Sebelumnya
              </button>
              <button
                disabled={page === pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                Live Preview: {previewTitle}
              </h3>
              <button
                onClick={() => setPreviewUrl(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="h-[600px] border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50">
                <PdfViewer url={previewUrl} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

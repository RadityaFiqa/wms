"use client";

import React, { useState, useEffect } from "react";
import { useDigitalSignature } from "@/hooks/useDigitalSignature";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import {
  FileCheck,
  Search,
  Upload,
  Calendar,
  FileText,
  CheckCircle2,
  X,
  Eye,
  Download,
  Info,
  Layers,
  ArrowUpRight,
  Filter,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import PdfViewer from "@/components/PdfViewer";
import CreatableSelect from "react-select/creatable";

export default function SignedDocumentsPage() {
  const { hasPermission } = useAuthStore();
  const { categories, categoriesLoading, createManualDoc, getSignedDocuments } =
    useDigitalSignature();

  // Filters State
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Signed Documents list
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal manual upload states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadData, setUploadData] = useState({
    title: "",
    categoryId: "",
    description: "",
    fileUrl: "",
  });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);

  // In-app PDF Viewer Modal states
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  // Load documents
  const loadDocs = async () => {
    setLoading(true);
    try {
      const data = await getSignedDocuments({
        search: search || undefined,
        categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
        sourceType: sourceType || undefined,
        status: status || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setDocs(data);
    } catch (err: any) {
      toast.error("Gagal memuat dokumen digital.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [search, categoryId, sourceType, status, startDate, endDate]);

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Hanya file PDF yang diperbolehkan.");
      return;
    }

    setUploadingFile(true);
    const toastId = toast.loading("Mengunggah file PDF...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post(API_ROUTES.storage.upload, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploadData((prev) => ({ ...prev, fileUrl: res.data.url }));
      toast.success("File PDF berhasil diunggah!", { id: toastId });
    } catch (err: any) {
      const msg = err.response?.data?.message || "Gagal mengunggah file.";
      toast.error(msg, { id: toastId });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadData.title.trim()) {
      toast.error("Judul dokumen wajib diisi.");
      return;
    }
    if (!uploadData.categoryId) {
      toast.error("Kategori wajib dipilih.");
      return;
    }
    if (!uploadData.fileUrl) {
      toast.error("File PDF wajib diunggah.");
      return;
    }

    setSavingDoc(true);
    const toastId = toast.loading("Menyimpan dokumen manual...");

    try {
      const parsedCatId = /^\d+$/.test(uploadData.categoryId)
        ? parseInt(uploadData.categoryId, 10)
        : uploadData.categoryId;
      const doc = await createManualDoc({
        title: uploadData.title,
        categoryId: parsedCatId,
        description: uploadData.description || null,
        fileUrl: uploadData.fileUrl,
      });

      toast.success(
        'Dokumen manual berhasil diunggah! Silakan pilih "Sign Document" untuk menandatanganinya.',
        { id: toastId },
      );
      setIsUploadOpen(false);

      // Reset form
      setUploadData({
        title: "",
        categoryId: "",
        description: "",
        fileUrl: "",
      });

      // Auto open signing flow or reload docs (we will redirect/sign this document later)
      loadDocs();

      // Direct user to signing workspace for this manual doc!
      // Path: /sign-document/manual/[uuid]
      window.location.href = `/sign-document/manual/${doc.uuid}`;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Gagal menyimpan dokumen.";
      toast.error(msg, { id: toastId });
    } finally {
      setSavingDoc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
            <FileCheck className="h-8 w-8 text-blue-600 mr-3" />
            Dokumen Digital
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Daftar seluruh dokumen ERP dan Manual yang telah ditandatangani
            secara digital & bersertifikat.
          </p>
        </div>

        {hasPermission("create", "ManualDocument") && (
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] transition cursor-pointer text-sm"
          >
            <Upload className="h-4.5 w-4.5 mr-2" />
            Upload Dokumen Manual
          </button>
        )}
      </div>

      {/* Filters Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center text-sm font-bold text-slate-700 dark:text-slate-350 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Filter className="h-4.5 w-4.5 mr-2 text-blue-500" />
          Filter Dokumen Digital
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          {/* Search */}
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Cari Judul / Token
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-805 dark:text-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Kategori
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-805 dark:text-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
            >
              <option value="">Semua Kategori</option>
              {categories?.map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Source Type */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Sumber
            </label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-805 dark:text-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
            >
              <option value="">Semua Sumber</option>
              <option value="ERP">ERP Document</option>
              <option value="MANUAL">Manual Upload</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-805 dark:text-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
            >
              <option value="">Semua Status</option>
              <option value="VALID">VALID</option>
              <option value="INVALID">INVALID</option>
              <option value="REVOKED">REVOKED</option>
            </select>
          </div>
        </div>

        {/* Date Range */}
        <div className="flex flex-col sm:flex-row gap-4 items-end pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Tanggal Mulai Tanda Tangan
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-800 dark:text-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Tanggal Selesai Tanda Tangan
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-800 dark:text-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none"
              />
            </div>
          </div>
          <button
            onClick={() => {
              setSearch("");
              setCategoryId("");
              setSourceType("");
              setStatus("");
              setStartDate("");
              setEndDate("");
            }}
            className="px-4 py-2 text-xs font-bold text-slate-505 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer h-[34px]"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {/* Signed Documents Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-layout-fixed min-w-[1000px]">
            <thead className="bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4 w-[16%]">No. Dokumen</th>
                <th className="px-6 py-4 w-[22%]">Judul Dokumen</th>
                <th className="px-6 py-4 w-[12%] text-center">Kategori</th>
                <th className="px-6 py-4 w-[12%] text-center">Sumber</th>
                <th className="px-6 py-4 w-[14%]">Ditandatangani Oleh</th>
                <th className="px-6 py-4 w-[12%] text-center">
                  Tgl Tanda Tangan
                </th>
                <th className="px-6 py-4 w-[12%] text-center">Status</th>
                <th className="px-6 py-4 w-[12%] text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-44"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div>
                    </td>
                  </tr>
                ))
              ) : docs.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-16 text-center text-slate-400 font-semibold"
                  >
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <FileText className="h-12 w-12 text-slate-200" />
                      <span>
                        Tidak ada dokumen digital bertanda tangan ditemukan.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                docs.map((doc) => {
                  const signedDate = new Date(doc.signedAt).toLocaleDateString(
                    "id-ID",
                    {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    },
                  );
                  const docNum =
                    doc.sourceType === "ERP"
                      ? doc.title.split(" - ")[1] || doc.title
                      : "MANUAL-DOC";

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition"
                    >
                      <td className="px-6 py-4 font-mono font-bold text-slate-800 dark:text-slate-200 select-all truncate">
                        {docNum}
                      </td>
                      <td
                        className="px-6 py-4 font-semibold text-slate-750 dark:text-slate-300 truncate"
                        title={doc.title}
                      >
                        {doc.title}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 bg-slate-100 dark:bg-slate-805 text-slate-605 dark:text-slate-350 border border-slate-200 dark:border-slate-750 font-bold rounded-lg text-[10px]">
                          {doc.category.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {doc.sourceType === "ERP" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-blue-700 font-bold text-[10px] uppercase">
                            ERP
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-50 border border-purple-100 text-purple-700 font-bold text-[10px] uppercase">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                        {doc.signer.name}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-slate-505">
                        {signedDate}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {doc.status === "VALID" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Valid
                          </span>
                        ) : doc.status === "REVOKED" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 border border-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Revoked
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-500">
                            Invalid
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => {
                              setPreviewTitle(doc.title);
                              setPreviewUrl(doc.signedPdfUrl);
                            }}
                            className="p-1.5 bg-slate-105 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition"
                            title="Pratinjau PDF"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <a
                            href={API_ROUTES.digitalSignature.signedDocuments.download(
                              doc.uuid,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg transition"
                            title="Unduh PDF"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-850 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-805 bg-slate-50 dark:bg-slate-900/30">
              <h3 className="font-bold text-slate-805 dark:text-slate-150 text-md flex items-center">
                <Upload className="h-4.5 w-4.5 mr-2 text-blue-500" />
                Upload Dokumen Manual
              </h3>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUploadSubmit}>
              <div className="p-6 space-y-4">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block">
                    Judul Dokumen *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Laporan Penilaian Aset GBB Landasan Ulin..."
                    value={uploadData.title}
                    onChange={(e) =>
                      setUploadData({ ...uploadData, title: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-505"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-455 dark:text-slate-550 uppercase tracking-wider block">
                    Kategori Dokumen *
                  </label>
                  <CreatableSelect
                    unstyled
                    placeholder="Pilih atau Buat Kategori..."
                    options={
                      categories?.map((cat: any) => ({
                        value: String(cat.id),
                        label: cat.name,
                      })) || []
                    }
                    value={
                      categories
                        ?.map((cat: any) => ({
                          value: String(cat.id),
                          label: cat.name,
                        }))
                        .find(
                          (opt: any) => opt.value === uploadData.categoryId,
                        ) ||
                      (uploadData.categoryId
                        ? {
                            value: uploadData.categoryId,
                            label: uploadData.categoryId,
                          }
                        : null)
                    }
                    onChange={(newValue: any) => {
                      setUploadData({
                        ...uploadData,
                        categoryId: newValue ? newValue.value : "",
                      });
                    }}
                    classNames={{
                      control: ({ isFocused }) =>
                        `w-full bg-slate-50 dark:bg-slate-800 border ${
                          isFocused
                            ? "border-blue-500 ring-1 ring-blue-500"
                            : "border-slate-200 dark:border-slate-700"
                        } text-slate-805 dark:text-slate-200 rounded-xl px-3.5 py-1.5 text-sm transition`,
                      menu: () =>
                        "mt-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden z-50 absolute w-full",
                      option: ({ isFocused, isSelected }) =>
                        `px-3 py-2 text-sm cursor-pointer transition ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : isFocused
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              : "text-slate-700 dark:text-slate-300"
                        }`,
                      singleValue: () =>
                        "text-slate-808 dark:text-slate-200 text-sm",
                      placeholder: () =>
                        "text-slate-400 dark:text-slate-500 text-sm",
                      input: () => "text-slate-808 dark:text-slate-200 text-sm",
                      noOptionsMessage: () =>
                        "text-slate-500 dark:text-slate-400 p-2 text-center text-xs",
                    }}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block">
                    Deskripsi Dokumen
                  </label>
                  <textarea
                    placeholder="Tuliskan keterangan detail tambahan..."
                    rows={2}
                    value={uploadData.description}
                    onChange={(e) =>
                      setUploadData({
                        ...uploadData,
                        description: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2 text-sm focus:outline-none resize-none"
                  />
                </div>

                {/* PDF Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block">
                    File PDF Dokumen *
                  </label>

                  {uploadData.fileUrl ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/40 rounded-xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5 truncate">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-305 truncate">
                          PDF Terunggah Sukses
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setUploadData({ ...uploadData, fileUrl: "" })
                        }
                        className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg text-emerald-600 dark:text-emerald-400 transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer transition relative">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        disabled={uploadingFile}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-605 dark:text-slate-400">
                        Pilih file PDF atau seret ke sini
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Hanya format PDF diperbolehkan (Max 5MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-805 flex justify-end space-x-3 bg-slate-50 dark:bg-slate-900/30">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={savingDoc || uploadingFile}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingDoc || uploadingFile || !uploadData.fileUrl}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-bold rounded-xl text-xs shadow-md active:scale-[0.98] transition cursor-pointer"
                >
                  {savingDoc ? "Menyimpan..." : "Upload & Tanda Tangani"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline PDF Viewer Modal (In-app viewer) */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
              <div className="flex items-center space-x-2 truncate">
                <FileText className="h-5 w-5 text-blue-500" />
                <h3 className="font-extrabold text-slate-805 dark:text-slate-150 text-sm truncate max-w-[500px]">
                  Pratinjau Dokumen: {previewTitle}
                </h3>
              </div>
              <button
                onClick={() => setPreviewUrl(null)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Canvas PdfViewer Body */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950 flex flex-col items-center">
              <PdfViewer url={previewUrl} />
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex justify-end">
              <button
                onClick={() => setPreviewUrl(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
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

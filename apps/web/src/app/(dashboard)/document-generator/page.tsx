"use client";

import React, { useState, useEffect, useRef } from "react";
import { useDocumentGenerator } from "@/hooks/useDocumentGenerator";
import { toast } from "sonner";
import {
  FileText,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Eye,
  FileDown,
  RefreshCw,
  FolderOpen,
  Upload,
} from "lucide-react";
import PdfViewer from "@/components/PdfViewer";
import Link from "next/link";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";

export default function DocumentGeneratorPage() {
  const {
    getTemplates,
    getTemplateDetail,
    getPlaceholders,
    generateDocument,
    getGeneratedHistory,
    getPreviewUrl,
    getDownloadDocxUrl,
    getDownloadPdfUrl,
  } = useDocumentGenerator();

  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateUuid, setSelectedTemplateUuid] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [placeholders, setPlaceholders] = useState<any[]>([]);
  const [loadingPlaceholders, setLoadingPlaceholders] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [userUploadAttachments, setUserUploadAttachments] = useState<any[]>([]);

  // History/jobs state
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load templates on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await getTemplates({ page: 1, limit: 100, active: true });
        setTemplates(res.data);
      } catch (err) {
        toast.error("Gagal memuat template aktif.");
      }
    };
    loadTemplates();
  }, []);

  // Load history
  const loadHistory = async () => {
    try {
      const res = await getGeneratedHistory({ page: 1, limit: 10 });
      setJobs(res.data);
      
      // If there are processing jobs, start polling
      const hasProcessing = res.data.some((job: any) => job.status === "PROCESSING");
      if (hasProcessing && !pollIntervalRef.current) {
        startPolling();
      } else if (!hasProcessing && pollIntervalRef.current) {
        stopPolling();
      }
    } catch (err) {
      console.error("Gagal memuat riwayat job:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
    return () => stopPolling();
  }, []);

  const startPolling = () => {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(() => {
      loadHistory();
    }, 3000); // Poll every 3 seconds
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Load placeholders when template changes
  useEffect(() => {
    if (!selectedTemplateUuid) {
      setSelectedTemplate(null);
      setPlaceholders([]);
      setValues({});
      setUserUploadAttachments([]);
      return;
    }

    const tpl = templates.find((t) => t.uuid === selectedTemplateUuid);
    setSelectedTemplate(tpl);
    setTitle(tpl ? `Dokumen ${tpl.name}` : "");

    const loadPlaceholders = async () => {
      setLoadingPlaceholders(true);
      try {
        const [schema, tplDetail] = await Promise.all([
          getPlaceholders(selectedTemplateUuid),
          getTemplateDetail(selectedTemplateUuid),
        ]);
        setPlaceholders(schema);

        // Parse assembly schema for user uploaded PDFs
        if (tplDetail?.assemblySchema) {
          const userPdfAtts = (tplDetail.assemblySchema as any[])
            .filter((item) => item.type === "PDF" && item.source === "USER_UPLOAD")
            .map((item, idx) => ({
              id: idx,
              label: `Lampiran PDF #${idx + 1} (${
                item.position === "AFTER_DOCUMENT"
                  ? "Setelah Dokumen"
                  : item.position === "LAST_PAGE"
                  ? "Halaman Terakhir"
                  : item.position === "BEFORE_SECTION"
                  ? `Sebelum Section ${item.templateCode}`
                  : `Setelah Section ${item.templateCode}`
              })`,
              objectKey: "",
            }));
          setUserUploadAttachments(userPdfAtts);
        } else {
          setUserUploadAttachments([]);
        }
        
        // Initialize values object
        const initVals: Record<string, any> = {};
        schema.forEach((p: any) => {
          if (p.type === "BOOLEAN") {
            initVals[p.key] = false;
          } else if (p.type === "MULTI_SELECT") {
            initVals[p.key] = [];
          } else if (p.type === "TABLE") {
            const cols = p.columns && p.columns.length > 0 ? p.columns : [{ key: "item" }, { key: "value" }];
            const row: Record<string, any> = {};
            cols.forEach((col: any) => { row[col.key] = ""; });
            initVals[p.key] = [row];
          } else {
            initVals[p.key] = "";
          }
        });
        setValues(initVals);
      } catch (err) {
        toast.error("Gagal membaca struktur template.");
      } finally {
        setLoadingPlaceholders(false);
      }
    };
    loadPlaceholders();
  }, [selectedTemplateUuid, templates]);

  const handleInputChange = (key: string, val: any) => {
    setValues({ ...values, [key]: val });
  };

  // Handle table section changes (loops)
  const handleTableChange = (key: string, rowIndex: number, colKey: string, val: any) => {
    const tableRows = [...(values[key] || [{}])];
    tableRows[rowIndex] = { ...tableRows[rowIndex], [colKey]: val };
    setValues({ ...values, [key]: tableRows });
  };

  const addTableRow = (pKey: string) => {
    const p = placeholders.find((item) => item.key === pKey);
    const columns = p?.columns && p.columns.length > 0
      ? p.columns
      : [{ key: "item" }, { key: "value" }];

    const tableRows = [...(values[pKey] || [{}])];
    const newRow: Record<string, any> = {};
    columns.forEach((col: any) => {
      newRow[col.key] = "";
    });
    tableRows.push(newRow);
    setValues({ ...values, [pKey]: tableRows });
  };

  const removeTableRow = (key: string, rowIndex: number) => {
    const tableRows = [...(values[key] || [{}])];
    if (tableRows.length <= 1) return;
    tableRows.splice(rowIndex, 1);
    setValues({ ...values, [key]: tableRows });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateUuid) return toast.error("Silakan pilih template terlebih dahulu.");
    if (!title.trim()) return toast.error("Judul dokumen wajib diisi.");
    if (!documentNumber.trim()) return toast.error("Nomor dokumen wajib diisi.");

    // Validate required placeholders
    for (const p of placeholders) {
      if (p.required) {
        const val = values[p.key];
        if (p.type === "TABLE") {
          if (!val || val.length === 0) {
            return toast.error(`Tabel ${p.label} wajib diisi minimal 1 baris.`);
          }
        } else if (val === undefined || val === null || String(val).trim() === "") {
          return toast.error(`Field "${p.label}" wajib diisi.`);
        }
      }
    }

    // Validate configured dynamic PDF attachments
    for (const att of userUploadAttachments) {
      if (!att.objectKey) {
        return toast.error(`File untuk "${att.label}" wajib diunggah.`);
      }
    }

    setSubmitting(true);
    const toastId = toast.loading("Mengantrekan job generate dokumen...");
    try {
      await generateDocument({
        templateId: selectedTemplateUuid,
        title,
        documentNumber,
        placeholder: values,
        attachments: userUploadAttachments.map((att) => ({
          type: "PDF",
          objectKey: att.objectKey,
        })),
      });

      toast.success("Job berhasil ditambahkan! Memulai proses rendering...", { id: toastId });
      
      // Reset form
      setDocumentNumber("");
      setTitle(selectedTemplate ? `Dokumen ${selectedTemplate.name}` : "");
      
      // Clear dynamic attachments upload state
      setUserUploadAttachments(userUploadAttachments.map(att => ({ ...att, objectKey: "" })));
      
      // Reload history & start polling
      loadHistory();
      startPolling();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Gagal mengantrekan proses.";
      toast.error(msg, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Dynamic Form Workspace */}
      <div className="lg:col-span-8 space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
              <Play className="h-6 w-6 text-blue-600 mr-2.5" />
              Generate Dokumen Baru
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Pilih template untuk membuat form input dinamis, lalu render menjadi dokumen PDF/Word.
            </p>
          </div>

          {/* Template Selection */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 uppercase">Pilih Template Dokumen</label>
            <select
              value={selectedTemplateUuid}
              onChange={(e) => setSelectedTemplateUuid(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">-- Pilih Template --</option>
              {templates.map((t) => (
                <option key={t.uuid} value={t.uuid}>
                  {t.name} (v{t.version})
                </option>
              ))}
            </select>
          </div>

          {selectedTemplateUuid && (
            <form onSubmit={handleSubmit} className="space-y-6 border-t border-slate-100 dark:border-slate-800 pt-6 animate-in fade-in duration-200">
              {/* Document Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Judul Dokumen Hasil</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
                    placeholder="E.g. Memo Penagihan PT XYZ"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nomor Dokumen</label>
                  <input
                    type="text"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
                    placeholder="E.g. 001/SP/VII/2026"
                    required
                  />
                </div>
              </div>

              {/* Dynamic Inputs */}
              <div className="space-y-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-50 dark:border-slate-800">
                  Variabel Placeholder Template
                </div>

                {loadingPlaceholders ? (
                  <div className="py-4 text-center text-xs text-slate-450 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600 mr-2" />
                    Menyusun form dinamis...
                  </div>
                ) : placeholders.length === 0 ? (
                  <div className="py-4 text-center text-xs text-amber-600">
                    Template ini tidak memiliki placeholder.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {placeholders.map((p) => {
                      if (p.type === "TABLE") {
                        // Table handles loops separately (full width)
                        return null;
                      }

                      return (
                        <div key={p.key} className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {p.label}
                            {p.required && <span className="text-rose-500 ml-0.5">*</span>}
                          </label>

                          {p.type === "BOOLEAN" ? (
                            <div className="flex items-center space-x-2 py-1.5">
                              <input
                                type="checkbox"
                                id={`check-${p.key}`}
                                checked={values[p.key] || false}
                                onChange={(e) => handleInputChange(p.key, e.target.checked)}
                                className="h-4.5 w-4.5 text-blue-655 rounded border-slate-200 dark:border-slate-800 cursor-pointer"
                              />
                              <label htmlFor={`check-${p.key}`} className="text-xs text-slate-500 cursor-pointer">
                                Ya / Setuju
                              </label>
                            </div>
                          ) : p.type === "TEXTAREA" ? (
                            <textarea
                              value={values[p.key] || ""}
                              onChange={(e) => handleInputChange(p.key, e.target.value)}
                              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-white dark:bg-slate-900 min-h-[80px]"
                              required={p.required}
                              placeholder={`Masukkan ${p.label.toLowerCase()}...`}
                            />
                          ) : p.type === "DATE" ? (
                            <input
                              type="date"
                              value={values[p.key] || ""}
                              onChange={(e) => handleInputChange(p.key, e.target.value)}
                              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
                              required={p.required}
                            />
                          ) : p.type === "TIME" ? (
                            <input
                              type="time"
                              value={values[p.key] || ""}
                              onChange={(e) => handleInputChange(p.key, e.target.value)}
                              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
                              required={p.required}
                            />
                          ) : p.type === "DATETIME" ? (
                            <input
                              type="datetime-local"
                              value={values[p.key] || ""}
                              onChange={(e) => handleInputChange(p.key, e.target.value)}
                              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
                              required={p.required}
                            />
                          ) : p.type === "CURRENCY" ? (
                            <div className="relative flex items-center">
                              <span className="absolute left-4 text-sm font-semibold text-slate-400">Rp</span>
                              <input
                                type="number"
                                value={values[p.key] ?? ""}
                                onChange={(e) => handleInputChange(p.key, e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                                required={p.required}
                                placeholder="0"
                              />
                            </div>
                          ) : p.type === "NUMBER" ? (
                            <input
                              type="number"
                              value={values[p.key] ?? ""}
                              onChange={(e) => handleInputChange(p.key, e.target.value === "" ? "" : Number(e.target.value))}
                              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
                              required={p.required}
                              placeholder="0"
                            />
                          ) : p.type === "SELECT" ? (
                            <select
                              value={values[p.key] || ""}
                              onChange={(e) => handleInputChange(p.key, e.target.value)}
                              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none bg-white dark:bg-slate-900 focus:border-blue-500"
                              required={p.required}
                            >
                              <option value="">-- Pilih {p.label} --</option>
                              {(p.options || []).map((opt: string) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : p.type === "MULTI_SELECT" ? (
                            <div className="space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/50 max-h-[120px] overflow-y-auto">
                              {(p.options || []).map((opt: string) => {
                                const currentValues = Array.isArray(values[p.key]) ? values[p.key] : [];
                                const isChecked = currentValues.includes(opt);
                                return (
                                  <label key={opt} className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const updated = e.target.checked
                                          ? [...currentValues, opt]
                                          : currentValues.filter((v: string) => v !== opt);
                                        handleInputChange(p.key, updated);
                                      }}
                                      className="h-4 w-4 text-blue-600 rounded border-slate-250 dark:border-slate-800 cursor-pointer"
                                    />
                                    <span>{opt}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : p.type === "IMAGE" ? (
                            <div className="space-y-2">
                              {values[p.key] ? (
                                <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <div className="text-xs font-mono font-bold text-slate-550 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                      IMG
                                    </div>
                                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[150px] md:max-w-[200px]" title={values[p.key]}>
                                      {values[p.key].split("/").pop()}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleInputChange(p.key, "")}
                                    className="text-[10px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                                  >
                                    Hapus
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const toastId = toast.loading("Mengunggah gambar...");
                                      try {
                                        const formData = new FormData();
                                        formData.append("file", file);
                                        const res = await api.post(API_ROUTES.storage.upload, formData, {
                                          headers: { "Content-Type": "multipart/form-data" },
                                        });
                                        const filePath = res.data.filePath || res.data.url;
                                        handleInputChange(p.key, filePath);
                                        toast.success("Gambar berhasil diunggah!", { id: toastId });
                                      } catch (err: any) {
                                        toast.error("Gagal mengunggah gambar.", { id: toastId });
                                      }
                                    }}
                                    className="hidden"
                                    id={`image-upload-${p.key}`}
                                  />
                                  <label
                                    htmlFor={`image-upload-${p.key}`}
                                    className="flex items-center justify-center w-full px-4 py-2 border border-dashed border-slate-250 dark:border-slate-800 hover:bg-slate-55 dark:hover:bg-slate-850 rounded-xl text-xs cursor-pointer font-semibold text-slate-550 dark:text-slate-400 transition"
                                  >
                                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                                    Pilih Gambar
                                  </label>
                                </div>
                              )}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={values[p.key] || ""}
                              onChange={(e) => handleInputChange(p.key, e.target.value)}
                              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
                              required={p.required}
                              placeholder={`Masukkan ${p.label.toLowerCase()}...`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Table loops (Loops are placed at the bottom, full width) */}
                {placeholders
                  .filter((p) => p.type === "TABLE")
                  .map((p) => {
                    const rows = values[p.key] || [{}];
                    const columns = p.columns && p.columns.length > 0
                      ? p.columns
                      : [
                          { key: "item", label: "Item / Keterangan" },
                          { key: "value", label: "Nilai / Kuantitas" }
                        ];

                    return (
                      <div key={p.key} className="space-y-3 border border-slate-200 dark:border-slate-850 p-4 rounded-xl bg-slate-50/20 dark:bg-slate-900/10">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                            Tabel Section: {p.label}
                          </label>
                          <button
                            type="button"
                            onClick={() => addTableRow(p.key)}
                            className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 font-bold px-2.5 py-1 rounded-md transition cursor-pointer text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
                          >
                            + Tambah Baris
                          </button>
                        </div>

                        {rows.map((row: any, rIdx: number) => (
                          <div key={rIdx} className="flex items-start space-x-2 border-b border-slate-100 dark:border-slate-800 pb-3 last:border-b-0 last:pb-0">
                            <span className="text-xs text-slate-450 font-mono mt-2.5">#{rIdx + 1}</span>
                            <div className="grid gap-3 flex-1" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
                              {columns.map((col: any) => (
                                <div key={col.key}>
                                  <input
                                    type="text"
                                    placeholder={col.label}
                                    value={row[col.key] || ""}
                                    onChange={(e) => handleTableChange(p.key, rIdx, col.key, e.target.value)}
                                    className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-850 rounded-lg text-xs"
                                  />
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeTableRow(p.key, rIdx)}
                              className="text-rose-500 hover:text-rose-700 p-1 mt-1 cursor-pointer transition"
                              disabled={rows.length <= 1}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                {/* Dynamic PDF Attachments */}
                {userUploadAttachments.length > 0 && (
                  <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-50 dark:border-slate-800">
                      Lampiran Dokumen PDF Wajib (Berdasarkan Konfigurasi Assembly)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userUploadAttachments.map((att, idx) => (
                        <div key={att.id} className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350">
                            {att.label} <span className="text-rose-500">*</span>
                          </label>

                          {att.objectKey ? (
                            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                              <div className="flex items-center space-x-2 min-w-0">
                                <div className="text-xs font-mono font-bold text-slate-550 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                  PDF
                                </div>
                                <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[150px] md:max-w-[200px]" title={att.objectKey}>
                                  {att.objectKey.split("/").pop()}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...userUploadAttachments];
                                  updated[idx].objectKey = "";
                                  setUserUploadAttachments(updated);
                                }}
                                className="text-[10px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                              >
                                Hapus
                              </button>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="file"
                                accept=".pdf"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const toastId = toast.loading("Mengunggah lampiran PDF...");
                                  try {
                                    const formData = new FormData();
                                    formData.append("file", file);
                                    const res = await api.post(API_ROUTES.storage.upload, formData, {
                                      headers: { "Content-Type": "multipart/form-data" },
                                    });
                                    const filePath = res.data.filePath || res.data.url;
                                    
                                    const updated = [...userUploadAttachments];
                                    updated[idx].objectKey = filePath;
                                    setUserUploadAttachments(updated);
                                    
                                    toast.success("Lampiran PDF berhasil diunggah!", { id: toastId });
                                  } catch (err: any) {
                                    toast.error("Gagal mengunggah PDF.", { id: toastId });
                                  }
                                }}
                                className="hidden"
                                id={`user-att-upload-${att.id}`}
                              />
                              <label
                                htmlFor={`user-att-upload-${att.id}`}
                                className="flex items-center justify-center w-full px-4 py-2 border border-dashed border-slate-250 dark:border-slate-800 hover:bg-slate-55 dark:hover:bg-slate-850 rounded-xl text-xs cursor-pointer font-semibold text-slate-550 dark:text-slate-400 transition"
                              >
                                <Upload className="h-3.5 w-3.5 mr-1.5" />
                                Pilih File PDF Lampiran
                              </label>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 transition cursor-pointer text-sm"
                >
                  {submitting ? "Memproses..." : "Render Dokumen"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Live Preview Screen */}
        {previewUrl && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Live Preview: {previewTitle}</h3>
              <button
                onClick={() => setPreviewUrl(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                Tutup Preview
              </button>
            </div>
            <div className="h-[550px] border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50">
              <PdfViewer url={previewUrl} />
            </div>
          </div>
        )}
      </div>

      {/* History and Status Polling list */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 h-fit">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-md text-slate-800 dark:text-slate-100 flex items-center">
              <RefreshCw className="h-4.5 w-4.5 text-blue-600 mr-2 animate-spin-slow" />
              Antrean & Status Render
            </h3>
            <button
              onClick={loadHistory}
              className="p-1 text-slate-450 hover:text-slate-700 cursor-pointer transition"
              title="Refresh manual"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
            {loadingHistory ? (
              <div className="text-center text-slate-500 py-6 text-xs">Memuat data antrean...</div>
            ) : jobs.length === 0 ? (
              <div className="text-center text-slate-500 py-6 text-xs">Belum ada dokumen yang di-render.</div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.uuid}
                  className="p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-150/40 dark:border-slate-850 rounded-xl space-y-2.5 shadow-2xs hover:shadow-xs transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate" title={job.title}>
                        {job.title}
                      </div>
                      <div className="text-[10px] text-slate-450 truncate font-mono mt-0.5">{job.documentNumber}</div>
                    </div>

                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase whitespace-nowrap ${
                        job.status === "GENERATED"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                          : job.status === "FAILED"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-955/20 dark:text-rose-400"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                      }`}
                    >
                      {job.status === "PROCESSING" && <Loader2 className="h-2.5 w-2.5 animate-spin mr-1 text-amber-700 dark:text-amber-400" />}
                      {job.status === "PROCESSING" ? "Rendering" : job.status === "GENERATED" ? "Sukses" : "Gagal"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500">
                    <span>v{job.template?.version || 1} • {new Date(job.generatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                    
                    {job.status === "GENERATED" && (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handlePreview(job.uuid, job.title)}
                          className="p-1 hover:text-blue-600 rounded-md transition hover:bg-blue-50/20 cursor-pointer"
                          title="Preview PDF"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownload(job.uuid, "pdf")}
                          className="p-1 hover:text-emerald-600 rounded-md transition hover:bg-emerald-50/20 cursor-pointer"
                          title="Download PDF"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownload(job.uuid, "docx")}
                          className="p-1 hover:text-indigo-650 rounded-md transition hover:bg-indigo-50/20 cursor-pointer"
                          title="Download DOCX"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {job.status === "FAILED" && job.errorMessage && (
                      <span className="text-rose-500 font-semibold max-w-[120px] truncate" title={job.errorMessage}>
                        {job.errorMessage}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 text-center">
            <Link
              href="/document-generator/history"
              className="text-xs font-bold text-blue-650 hover:text-blue-600 underline"
            >
              Lihat Seluruh Riwayat Dokumen
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

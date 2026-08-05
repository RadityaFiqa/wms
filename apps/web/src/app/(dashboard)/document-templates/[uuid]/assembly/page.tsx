"use client";

import React, { useState, useEffect } from "react";
import { useDocumentGenerator } from "@/hooks/useDocumentGenerator";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Layers,
  ArrowUp,
  ArrowDown,
  FileCheck,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";
import Link from "next/link";

export default function DocumentAssemblyPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params.uuid as string;

  const {
    getTemplateDetail,
    getAssembly,
    updateAssembly,
    getTemplates,
  } = useDocumentGenerator();

  const [template, setTemplate] = useState<any>(null);
  const [otherTemplates, setOtherTemplates] = useState<any[]>([]);
  const [assembly, setAssembly] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [tplDetail, assemblyList, tplsRes] = await Promise.all([
          getTemplateDetail(uuid),
          getAssembly(uuid),
          getTemplates({ page: 1, limit: 100, active: true }),
        ]);

        setTemplate(tplDetail);
        setAssembly(assemblyList || []);
        // Exclude current template from section templates selection
        setOtherTemplates(tplsRes.data.filter((t: any) => t.uuid !== uuid));
      } catch (err: any) {
        toast.error("Gagal memuat konfigurasi assembly.");
        router.push("/document-templates");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [uuid]);

  const handleAddComponent = (type: "TEMPLATE" | "PDF") => {
    const newComponent =
      type === "TEMPLATE"
        ? {
            type: "TEMPLATE",
            templateCode: "",
            condition: "",
            order: assembly.length + 1,
          }
        : {
            type: "PDF",
            source: "", // Will contain MinIO object key
            objectKey: "",
            position: "AFTER_DOCUMENT",
            templateCode: "", // Relative section if position is BEFORE/AFTER_SECTION
            order: assembly.length + 1,
          };
    setAssembly([...assembly, newComponent]);
  };

  const handleRemoveComponent = (index: number) => {
    const updated = assembly.filter((_, i) => i !== index).map((item, idx) => ({ ...item, order: idx + 1 }));
    setAssembly(updated);
  };

  const handleChangeComponent = (index: number, fieldOrFields: string | Record<string, any>, value?: any) => {
    setAssembly((prev) => {
      const updated = [...prev];
      if (typeof fieldOrFields === "string") {
        updated[index] = { ...updated[index], [fieldOrFields]: value };
      } else {
        updated[index] = { ...updated[index], ...fieldOrFields };
      }
      return updated;
    });
  };

  const moveComponent = (index: number, direction: "UP" | "DOWN") => {
    if (direction === "UP" && index === 0) return;
    if (direction === "DOWN" && index === assembly.length - 1) return;

    const targetIndex = direction === "UP" ? index - 1 : index + 1;
    const updated = [...assembly];
    
    // Swap items
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Fix order
    const ordered = updated.map((item, idx) => ({ ...item, order: idx + 1 }));
    setAssembly(ordered);
  };

  const handleFileUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Hanya file PDF yang didukung sebagai lampiran.");
      return;
    }

    setUploadingPdf(index);
    const toastId = toast.loading("Mengunggah file lampiran PDF...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Upload to storage API
      const res = await api.post(API_ROUTES.storage.upload, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Update assembly item
      const filePath = res.data.filePath || res.data.url;
      handleChangeComponent(index, "source", filePath);
      handleChangeComponent(index, "objectKey", filePath);

      toast.success("File PDF lampiran berhasil diunggah!", { id: toastId });
    } catch (err: any) {
      toast.error("Gagal mengunggah file PDF.", { id: toastId });
    } finally {
      setUploadingPdf(null);
    }
  };

  const handleSave = async () => {
    // Validate Assembly Schema
    for (let i = 0; i < assembly.length; i++) {
      const item = assembly[i];
      if (item.type === "TEMPLATE" && !item.templateCode) {
        toast.error(`Kategori ${i + 1}: Kode Template section wajib dipilih.`);
        return;
      }
      if (item.type === "PDF" && !item.source) {
        toast.error(`Kategori ${i + 1}: Sumber PDF lampiran wajib dikonfigurasi.`);
        return;
      }
      if (item.type === "PDF" && (item.position === "BEFORE_SECTION" || item.position === "AFTER_SECTION") && !item.templateCode) {
        toast.error(`Kategori ${i + 1}: Target Template section relative wajib dipilih.`);
        return;
      }
    }

    setSaving(true);
    const toastId = toast.loading("Menyimpan konfigurasi assembly...");
    try {
      await updateAssembly(uuid, assembly);
      toast.success("Konfigurasi Document Assembly berhasil disimpan!", { id: toastId });
      router.push("/document-templates");
    } catch (err: any) {
      const msg = err.response?.data?.message || "Gagal menyimpan konfigurasi assembly.";
      toast.error(msg, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        Memuat konfigurasi Document Assembly...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <Link
            href="/document-templates"
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
              <Layers className="h-7 w-7 text-blue-600 mr-2.5" />
              Document Assembly: {template?.name}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Susun komponen dokumen (main template, section template, lampiran PDF) beserta aturan urutan dan logika conditional.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] transition cursor-pointer text-sm"
        >
          <Save className="h-4.5 w-4.5 mr-2" />
          {saving ? "Menyimpan..." : "Simpan Konfigurasi"}
        </button>
      </div>

      {/* Main Template Card (Locked) */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-955/20 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-blue-600 uppercase tracking-wide">Main Template (Utama)</div>
              <div className="font-extrabold text-slate-850 dark:text-slate-150">{template?.name}</div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-200/50 dark:bg-slate-800 px-2 py-1 rounded-md">
            Order 0 (Locked)
          </span>
        </div>
      </div>

      {/* Assembly List */}
      <div className="space-y-4">
        {assembly.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 rounded-xl">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
            Belum ada komponen tambahan. Dokumen final hanya akan berisi main template.
          </div>
        ) : (
          assembly.map((item, index) => (
            <div
              key={index}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Component Info */}
              <div className="flex items-start md:items-center space-x-3 flex-1">
                <div className="flex flex-col space-y-1">
                  <button
                    onClick={() => moveComponent(index, "UP")}
                    disabled={index === 0}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => moveComponent(index, "DOWN")}
                    disabled={index === assembly.length - 1}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">#{index + 1}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        item.type === "TEMPLATE"
                          ? "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400"
                          : "bg-teal-50 text-teal-700 dark:bg-teal-950/20 dark:text-teal-400"
                      }`}
                    >
                      {item.type === "TEMPLATE" ? "Section Word Template" : "Lampiran PDF"}
                    </span>
                  </div>

                  {item.type === "TEMPLATE" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pilih Section Template</label>
                        <select
                          value={item.templateCode || ""}
                          onChange={(e) => handleChangeComponent(index, "templateCode", e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 focus:outline-none focus:text-slate-900 dark:focus:text-slate-100"
                        >
                          <option value="">-- Pilih Template --</option>
                          {otherTemplates.map((t) => (
                            <option key={t.uuid} value={t.code}>
                              {t.name} ({t.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Condition logic (Optional, e.g. HAS_BA == true)</label>
                        <input
                          type="text"
                          placeholder="Selalu disisipkan jika kosong"
                          value={item.condition || ""}
                          onChange={(e) => handleChangeComponent(index, "condition", e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-55 dark:bg-slate-800 focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sumber PDF</label>
                        <select
                          value={item.source === "USER_UPLOAD" ? "USER_UPLOAD" : "STATIC"}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "USER_UPLOAD") {
                              handleChangeComponent(index, { source: "USER_UPLOAD", objectKey: "USER_UPLOAD" });
                            } else {
                              handleChangeComponent(index, { source: "", objectKey: "" });
                            }
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 focus:outline-none"
                        >
                          <option value="STATIC">Statis (Unggah Sekarang)</option>
                          <option value="USER_UPLOAD">Dinamis (Unggah Saat Generate)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">File PDF Lampiran</label>
                        {item.source === "USER_UPLOAD" ? (
                          <div className="flex items-center py-1.5 text-xs text-blue-650 dark:text-blue-400 font-semibold h-[34px]">
                            Diunggah saat generate dokumen
                          </div>
                        ) : item.source ? (
                          <div className="flex items-center space-x-2 text-xs text-slate-655 dark:text-slate-350 py-1.5">
                            <span className="font-semibold truncate max-w-[120px]">{item.source.split("/").pop()}</span>
                            <button
                              onClick={() => handleChangeComponent(index, "source", "")}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer"
                            >
                              Ganti
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => handleFileUpload(index, e)}
                              className="hidden"
                              id={`file-att-${index}`}
                            />
                            <label
                              htmlFor={`file-att-${index}`}
                              className="flex items-center justify-center px-3 py-1.5 border border-slate-250 hover:bg-slate-55 text-slate-750 dark:text-slate-300 rounded-lg text-xs cursor-pointer font-semibold transition w-full"
                            >
                              <Upload className="h-3.5 w-3.5 mr-1.5" />
                              {uploadingPdf === index ? "Mengunggah..." : "Pilih PDF"}
                            </label>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Posisi Penyisipan</label>
                        <select
                          value={item.position || "AFTER_DOCUMENT"}
                          onChange={(e) => handleChangeComponent(index, "position", e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 focus:outline-none"
                        >
                          <option value="AFTER_DOCUMENT">Setelah Seluruh Dokumen</option>
                          <option value="LAST_PAGE">Halaman Terakhir</option>
                          <option value="BEFORE_SECTION">Sebelum Section Template</option>
                          <option value="AFTER_SECTION">Setelah Section Template</option>
                        </select>
                      </div>

                      {(item.position === "BEFORE_SECTION" || item.position === "AFTER_SECTION") && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Section Template</label>
                          <select
                            value={item.templateCode || ""}
                            onChange={(e) => handleChangeComponent(index, "templateCode", e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 focus:outline-none"
                          >
                            <option value="">-- Pilih Section --</option>
                            {assembly
                              .filter((a, idx) => a.type === "TEMPLATE" && idx !== index)
                              .map((a, idx) => (
                                <option key={idx} value={a.templateCode}>
                                  {a.templateCode}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Remove Component */}
              <button
                onClick={() => handleRemoveComponent(index)}
                className="p-2 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-955/20 rounded-lg cursor-pointer transition self-end md:self-auto"
                title="Hapus Komponen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Component Buttons */}
      <div className="flex justify-center space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={() => handleAddComponent("TEMPLATE")}
          className="flex items-center justify-center bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 font-bold px-4 py-2 rounded-xl hover:bg-purple-100 transition cursor-pointer text-xs shadow-xs"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Tambah Section Word
        </button>
        <button
          onClick={() => handleAddComponent("PDF")}
          className="flex items-center justify-center bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800 font-bold px-4 py-2 rounded-xl hover:bg-teal-100 transition cursor-pointer text-xs shadow-xs"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Tambah Lampiran PDF
        </button>
      </div>
    </div>
  );
}

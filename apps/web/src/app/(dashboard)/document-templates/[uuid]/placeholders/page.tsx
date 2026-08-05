"use client";

import React, { useState, useEffect } from "react";
import { useDocumentGenerator } from "@/hooks/useDocumentGenerator";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  ArrowLeft,
  Save,
  Sliders,
  AlertTriangle,
  Plus,
  Trash2,
  Check,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";

const PLACEHOLDER_TYPES = [
  { value: "TEXT", label: "Text (Satu Baris)" },
  { value: "TEXTAREA", label: "Textarea (Multi Baris)" },
  { value: "NUMBER", label: "Angka (Number)" },
  { value: "CURRENCY", label: "Mata Uang (Rupiah)" },
  { value: "DATE", label: "Tanggal" },
  { value: "TIME", label: "Jam (Waktu)" },
  { value: "DATETIME", label: "Tanggal & Waktu" },
  { value: "BOOLEAN", label: "Boolean (Ya/Tidak)" },
  { value: "SELECT", label: "Pilihan Tunggal (Dropdown Select)" },
  { value: "MULTI_SELECT", label: "Pilihan Ganda (Checklist Multi Select)" },
  { value: "IMAGE", label: "Gambar (MinIO Upload)" },
  { value: "TABLE", label: "Tabel Dinamis (Loop Section)" },
];

export default function DocumentPlaceholdersPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params.uuid as string;

  const {
    getTemplateDetail,
    getPlaceholders,
    updatePlaceholders,
  } = useDocumentGenerator();

  const [template, setTemplate] = useState<any>(null);
  const [placeholders, setPlaceholders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [tplDetail, placeholderList] = await Promise.all([
          getTemplateDetail(uuid),
          getPlaceholders(uuid),
        ]);

        setTemplate(tplDetail);
        
        // Ensure options and columns are properly structured for editing
        const normalized = (placeholderList || []).map((p: any) => ({
          key: p.key,
          label: p.label || p.key,
          type: p.type || "TEXT",
          required: p.required ?? true,
          optionsText: Array.isArray(p.options) ? p.options.join("\n") : "",
          columns: p.columns || [],
        }));

        setPlaceholders(normalized);
      } catch (err: any) {
        toast.error("Gagal memuat konfigurasi placeholder.");
        router.push("/document-templates");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [uuid]);

  const handleChangePlaceholder = (index: number, field: string, value: any) => {
    const updated = [...placeholders];
    updated[index] = { ...updated[index], [field]: value };
    setPlaceholders(updated);
  };

  // Table Columns Management
  const handleAddColumn = (pIdx: number) => {
    const updated = [...placeholders];
    const columns = [...(updated[pIdx].columns || [])];
    columns.push({ key: `col_${columns.length + 1}`, label: `Kolom ${columns.length + 1}` });
    updated[pIdx] = { ...updated[pIdx], columns };
    setPlaceholders(updated);
  };

  const handleRemoveColumn = (pIdx: number, cIdx: number) => {
    const updated = [...placeholders];
    const columns = (updated[pIdx].columns || []).filter((_: any, idx: number) => idx !== cIdx);
    updated[pIdx] = { ...updated[pIdx], columns };
    setPlaceholders(updated);
  };

  const handleChangeColumn = (pIdx: number, cIdx: number, field: string, value: string) => {
    const updated = [...placeholders];
    const columns = [...(updated[pIdx].columns || [])];
    columns[cIdx] = { ...columns[cIdx], [field]: value };
    updated[pIdx] = { ...updated[pIdx], columns };
    setPlaceholders(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    const toastId = toast.loading("Menyimpan konfigurasi placeholder...");

    try {
      // Normalize/validate placeholders payload before sending
      const payload = placeholders.map((p) => {
        const item: any = {
          key: p.key,
          label: p.label,
          type: p.type,
          required: p.required,
        };

        // If SELECT or MULTI_SELECT, split optionsText by line breaks
        if (p.type === "SELECT" || p.type === "MULTI_SELECT") {
          item.options = p.optionsText
            ? p.optionsText
                .split("\n")
                .map((o: string) => o.trim())
                .filter((o: string) => o !== "")
            : [];
        }

        // If TABLE, clean up columns schema
        if (p.type === "TABLE") {
          item.columns = (p.columns || []).map((col: any) => ({
            key: col.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""),
            label: col.label.trim(),
          })).filter((col: any) => col.key !== "" && col.label !== "");
        }

        return item;
      });

      await updatePlaceholders(uuid, payload);
      toast.success("Konfigurasi placeholder berhasil disimpan!", { id: toastId });
      router.push("/document-templates");
    } catch (err: any) {
      const msg = err.response?.data?.message || "Gagal menyimpan konfigurasi placeholder.";
      toast.error(msg, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        Memuat konfigurasi placeholders...
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
              <Sliders className="h-7 w-7 text-blue-600 mr-2.5" />
              Placeholder Variables: {template?.name}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Ubah tipe data dan konfigurasi visual untuk setiap placeholder variable yang terdeteksi pada template Word.
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

      {/* Placeholders Configuration List */}
      <div className="space-y-6">
        {placeholders.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 rounded-xl">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
            Template ini tidak mendeteksi adanya variabel placeholder. 
            Silakan unggah file template DOCX yang memiliki tag placeholder (e.g. {"{nama_surat}"}).
          </div>
        ) : (
          placeholders.map((p, pIdx) => (
            <div
              key={p.key}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4"
            >
              {/* Top row: variable name/key and controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                    Template Variable Key
                  </div>
                  <div className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                    {"{"}
                    {p.key}
                    {"}"}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {/* Required Switch */}
                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-655 cursor-pointer uppercase select-none">
                    <input
                      type="checkbox"
                      checked={p.required}
                      onChange={(e) => handleChangePlaceholder(pIdx, "required", e.target.checked)}
                      className="h-4.5 w-4.5 text-blue-650 rounded border-slate-200 dark:border-slate-800 cursor-pointer"
                    />
                    <span>Wajib Diisi (Required)</span>
                  </label>
                </div>
              </div>

              {/* Middle row: Label, type select */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase">
                    Label Input Form
                  </label>
                  <input
                    type="text"
                    value={p.label}
                    onChange={(e) => handleChangePlaceholder(pIdx, "label", e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-slate-50/30"
                    placeholder="E.g. Nama Pelanggan"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase">
                    Tipe Data / Komponen Form
                  </label>
                  <div className="relative">
                    <select
                      value={p.type}
                      onChange={(e) => handleChangePlaceholder(pIdx, "type", e.target.value)}
                      className="w-full pl-4 pr-10 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-slate-50/30 appearance-none bg-white dark:bg-slate-900"
                    >
                      {PLACEHOLDER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-3 h-4 w-4 pointer-events-none text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Conditional rendering for Options (SELECT/MULTI_SELECT) */}
              {(p.type === "SELECT" || p.type === "MULTI_SELECT") && (
                <div className="space-y-1.5 border border-slate-100 dark:border-slate-800 p-4 rounded-xl bg-slate-50/30">
                  <label className="block text-xs font-bold text-slate-655 uppercase">
                    Konfigurasi Pilihan (Options) - Satu Baris per Pilihan
                  </label>
                  <textarea
                    value={p.optionsText}
                    onChange={(e) => handleChangePlaceholder(pIdx, "optionsText", e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 min-h-[100px] font-mono"
                    placeholder="E.g.&#10;Pilihan Pertama&#10;Pilihan Kedua&#10;Pilihan Ketiga"
                  />
                  <div className="text-[10px] text-slate-450 italic mt-0.5">
                    Masukkan setiap nilai pilihan pada baris baru. Baris kosong akan diabaikan.
                  </div>
                </div>
              )}

              {/* Conditional rendering for Columns (TABLE) */}
              {p.type === "TABLE" && (
                <div className="space-y-3.5 border border-slate-100 dark:border-slate-800 p-4 rounded-xl bg-slate-50/30">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <label className="block text-xs font-bold text-slate-655 uppercase">
                      Definisi Kolom Tabel
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddColumn(pIdx)}
                      className="inline-flex items-center text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Tambah Kolom
                    </button>
                  </div>

                  {(!p.columns || p.columns.length === 0) ? (
                    <div className="text-center py-4 text-xs text-slate-500">
                      Belum ada kolom custom. Default akan merender 2 kolom: `item` dan `value`.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {(p.columns || []).map((col: any, cIdx: number) => (
                        <div key={cIdx} className="flex items-center space-x-2.5">
                          <span className="text-xs text-slate-400 font-mono">#{cIdx + 1}</span>
                          <div className="grid grid-cols-2 gap-3.5 flex-1">
                            <div>
                              <input
                                type="text"
                                placeholder="Key Kolom (e.g. qty, price - lowercase alphanumeric)"
                                value={col.key}
                                onChange={(e) => handleChangeColumn(pIdx, cIdx, "key", e.target.value)}
                                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <input
                                type="text"
                                placeholder="Label Kolom (e.g. Jumlah, Harga)"
                                value={col.label}
                                onChange={(e) => handleChangeColumn(pIdx, cIdx, "label", e.target.value)}
                                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveColumn(pIdx, cIdx)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer transition"
                            title="Hapus Kolom"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

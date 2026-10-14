"use client";

import React, { useState } from "react";
import { X, Tag, Plus, Loader2 } from "lucide-react";
import { createMasterTagihanStatus } from "@/hooks/useTagihan";

interface CreateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (status: any) => void;
}

const COLOR_OPTIONS = [
  { value: "slate", label: "Abu-abu / Neutral", class: "bg-slate-100 text-slate-700 border-slate-300" },
  { value: "blue", label: "Biru / Info", class: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "emerald", label: "Hijau / Sukses", class: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "amber", label: "Kuning / Menunggu", class: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "purple", label: "Ungu / Proses", class: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "red", label: "Merah / Batal", class: "bg-red-100 text-red-700 border-red-300" },
];

export function CreateStatusModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateStatusModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("blue");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama status wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await createMasterTagihanStatus({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        isDefault: false,
      });
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err.message || "Gagal membuat status baru.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 dark:bg-purple-950/30 text-purple-600 rounded-xl border border-purple-100 dark:border-purple-900/30">
              <Tag className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Buat Status Tagihan Baru
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tambahkan status kustom baru ke Master Status
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Nama Status <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Contoh: Menunggu Verifikasi Wilayah"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-purple-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Keterangan / Deskripsi
            </label>
            <textarea
              rows={2}
              placeholder="Keterangan singkat alur atau arti status..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
              Warna Lencana / Badge
            </label>
            <div className="grid grid-cols-2 gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                    color === c.value
                      ? "ring-2 ring-purple-500 border-purple-500"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <span className={`px-2 py-0.5 rounded text-[10px] border ${c.class}`}>
                    {c.value.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-slate-500">{c.label.split(" / ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-600/20 disabled:opacity-50 flex items-center gap-1.5 transition cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Simpan Status
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

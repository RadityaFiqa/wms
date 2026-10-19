"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  IdCard,
  X,
  Crown,
} from "lucide-react";
import type { BuruhResponse } from "@bulog-wms/schema";
import { CreateBuruhSchema } from "@bulog-wms/schema";
import { useAuthStore } from "@/store/auth";
import { useDebounce } from "@/hooks/useDebounce";
import {
  useBuruhs,
  createBuruh,
  updateBuruh,
  deleteBuruh,
  type BuruhFormValues,
} from "@/hooks/useBuruh";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const inputClass =
  "w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500";

export default function BuruhManagementPage() {
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission("create", "Buruh");
  const canUpdate = hasPermission("update", "Buruh");
  const canDelete = hasPermission("delete", "Buruh");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [isActive, setIsActive] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BuruhResponse | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { buruhsData, isLoading } = useBuruhs({
    search: debouncedSearch || undefined,
    isActive: isActive || undefined,
    page,
    limit,
  });
  const { buruhsData: mandorData } = useBuruhs({ isMandor: "true", limit: 1 });
  const currentMandor = mandorData?.data?.[0] ?? null;

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (buruh: BuruhResponse) => {
    setEditing(buruh);
    setModalOpen(true);
  };

  const handleDelete = async (buruh: BuruhResponse) => {
    if (!confirm(`Hapus buruh ${buruh.name}?`)) return;
    try {
      await deleteBuruh(buruh.uuid);
      toast.success(`Buruh ${buruh.name} berhasil dihapus.`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal menghapus buruh.");
    }
  };

  const rows = buruhsData?.data ?? [];
  const pagination = buruhsData?.pagination;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
            Manajemen Buruh
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Data buruh gudang dan foto KTP untuk pembuatan tanda terima upah.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] transition"
          >
            <UserPlus className="h-5 w-5 mr-2" />
            Tambah Buruh
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Cari Nama / NIK
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari buruh..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Status
          </label>
          <select
            value={isActive}
            onChange={(e) => {
              setIsActive(e.target.value as "" | "true" | "false");
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">Semua Status</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Foto KTP</th>
                <th className="px-6 py-4">Nama & NIK</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-10 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48 mb-2" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-full w-16" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-20 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">
                    Belum ada data buruh.
                  </td>
                </tr>
              ) : (
                rows.map((b) => (
                  <tr key={b.uuid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4">
                      {b.ktpPhotoUrl ? (
                        <button
                          type="button"
                          onClick={() => setPreviewUrl(b.ktpPhotoUrl)}
                          title="Lihat foto KTP"
                          className="block"
                        >
                          <img
                            src={b.ktpPhotoUrl}
                            alt={`KTP ${b.name}`}
                            className="h-10 w-16 object-cover rounded border border-slate-200 dark:border-slate-700"
                          />
                        </button>
                      ) : (
                        <span className="flex items-center text-xs text-slate-400">
                          <ImageOff className="h-4 w-4 mr-1" /> Belum ada
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        {b.name}
                        {b.isMandor && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400">
                            <Crown className="h-3 w-3 mr-1" />
                            Mandor
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center">
                        <IdCard className="h-3.5 w-3.5 mr-1" />
                        {b.nik || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          b.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400"
                            : "bg-red-50 text-red-700 border border-red-100 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400"
                        }`}
                      >
                        {b.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {canUpdate && (
                          <button
                            onClick={() => openEdit(b)}
                            title="Edit Buruh"
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(b)}
                            title="Hapus Buruh"
                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 && (
          <div className="bg-slate-50 dark:bg-slate-800/40 px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500 font-semibold">
              Menampilkan {rows.length} dari {pagination.total} buruh
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </button>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {page} / {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition"
              >
                <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </button>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <BuruhFormModal
          buruh={editing}
          currentMandor={currentMandor}
          onClose={() => setModalOpen(false)}
        />
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            onClick={() => setPreviewUrl(null)}
            title="Tutup"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={previewUrl}
            alt="Foto KTP"
            className="max-h-[85vh] max-w-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function BuruhFormModal({
  buruh,
  currentMandor,
  onClose,
}: {
  buruh: BuruhResponse | null;
  currentMandor: BuruhResponse | null;
  onClose: () => void;
}) {
  const isEdit = !!buruh;
  const [name, setName] = useState(buruh?.name ?? "");
  const [nik, setNik] = useState(buruh?.nik ?? "");
  const [isActive, setIsActive] = useState(buruh?.isActive ?? true);
  const [isMandor, setIsMandor] = useState(buruh?.isMandor ?? false);
  const replacedMandor =
    isMandor && currentMandor && currentMandor.uuid !== buruh?.uuid ? currentMandor : null;
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!photo) {
      setLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const shownPhoto = localPreview ?? (removePhoto ? null : buruh?.ktpPhotoUrl ?? null);

  const handlePhotoChange = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      toast.error("Foto KTP harus berformat JPG, PNG, atau WEBP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Ukuran foto KTP maksimal 5 MB.");
      return;
    }
    setPhoto(file);
    setRemovePhoto(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = CreateBuruhSchema.safeParse({ name, nik, isActive, isMandor });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        fieldErrors[String(err.path[0])] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    if (
      replacedMandor &&
      !confirm(`${replacedMandor.name} saat ini adalah mandor. Gantikan dengan ${name.trim()}?`)
    ) {
      return;
    }

    const values: BuruhFormValues = {
      name: name.trim(),
      nik: nik.trim(),
      isActive,
      isMandor,
      ktpPhoto: photo,
      removeKtpPhoto: removePhoto,
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateBuruh(buruh.uuid, values);
        toast.success("Data buruh berhasil diperbarui.");
      } else {
        await createBuruh(values);
        toast.success("Buruh baru berhasil ditambahkan.");
      }
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal menyimpan data buruh.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 animate-zoom-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {isEdit ? "Edit Data Buruh" : "Tambah Buruh Baru"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Lengkap
            </label>
            <input
              type="text"
              placeholder="Sesuai KTP"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              NIK <span className="font-normal text-slate-400">(opsional)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={16}
              placeholder="16 digit NIK"
              value={nik}
              onChange={(e) => setNik(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
            {errors.nik && <p className="text-xs text-red-500 mt-1">{errors.nik}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Foto KTP
            </label>
            {shownPhoto ? (
              <div className="relative inline-block">
                <img
                  src={shownPhoto}
                  alt="Pratinjau KTP"
                  className="h-32 rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null);
                    setRemovePhoto(!!buruh?.ktpPhotoUrl);
                  }}
                  title="Hapus foto"
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            <input
              type="file"
              accept={ACCEPTED_PHOTO_TYPES.join(",")}
              onChange={(e) => {
                handlePhotoChange(e.target.files?.[0]);
                e.target.value = "";
              }}
              className="mt-2 block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100"
            />
            <p className="text-xs text-slate-400 mt-1">JPG, PNG, atau WEBP. Maksimal 5 MB.</p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => {
                  setIsActive(e.target.checked);
                  // An inactive buruh cannot remain mandor
                  if (!e.target.checked) setIsMandor(false);
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              Aktif
            </label>
            <label
              className={`flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 ${
                !isActive ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={isMandor}
                disabled={!isActive}
                onChange={(e) => setIsMandor(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Mandor
            </label>
          </div>
          {replacedMandor && (
            <p className="text-xs text-amber-600 dark:text-amber-400 -mt-2">
              Hanya boleh ada 1 mandor. {replacedMandor.name} akan digantikan sebagai mandor.
            </p>
          )}

          <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg text-sm font-bold shadow-lg hover:shadow-blue-500/10 transition"
            >
              {submitting ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Buruh"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

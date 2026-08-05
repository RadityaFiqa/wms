"use client";

import React, { useState, useEffect } from "react";
import { useDocumentGenerator } from "@/hooks/useDocumentGenerator";
import { toast } from "sonner";
import {
  FileText,
  Search,
  Upload,
  Plus,
  Edit2,
  Trash2,
  Settings2,
  Check,
  X,
  FileDown,
  RefreshCw,
  FolderOpen,
  Sliders,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";

export default function DocumentTemplatesPage() {
  const { hasPermission } = useAuthStore();
  const {
    categories,
    categoriesLoading,
    getTemplates,
    createTemplate,
    updateTemplate,
    createNewTemplateVersion,
    deleteTemplate,
  } = useDocumentGenerator();

  // Templates list state
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1 });

  // Filters State
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isVersionOpen, setIsVersionOpen] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    code: "",
    name: "",
    description: "",
    categoryId: "",
    file: null as File | null,
  });

  const [editForm, setEditForm] = useState({
    uuid: "",
    name: "",
    description: "",
    isActive: true,
  });

  const [versionForm, setVersionForm] = useState({
    uuid: "",
    name: "",
    file: null as File | null,
  });

  const [submitting, setSubmitting] = useState(false);

  // Load templates
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await getTemplates({
        page,
        limit: 10,
        search: search || undefined,
        categoryId: categoryId || undefined,
      });
      setTemplates(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      toast.error("Gagal memuat template dokumen.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [search, categoryId, page]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.code.trim()) return toast.error("Kode template wajib diisi.");
    if (!createForm.name.trim()) return toast.error("Nama template wajib diisi.");
    if (!createForm.categoryId) return toast.error("Kategori wajib dipilih.");
    if (!createForm.file) return toast.error("File template DOCX wajib diunggah.");

    setSubmitting(true);
    const toastId = toast.loading("Mengunggah template...");
    try {
      const data = new FormData();
      data.append("code", createForm.code.toUpperCase());
      data.append("name", createForm.name);
      data.append("description", createForm.description);
      data.append("categoryId", createForm.categoryId);
      data.append("file", createForm.file);

      await createTemplate(data);
      toast.success("Template berhasil dibuat!", { id: toastId });
      setIsCreateOpen(false);
      setCreateForm({ code: "", name: "", description: "", categoryId: "", file: null });
      loadTemplates();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Gagal membuat template.";
      toast.error(msg, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) return toast.error("Nama template wajib diisi.");

    setSubmitting(true);
    const toastId = toast.loading("Memperbarui template...");
    try {
      await updateTemplate(editForm.uuid, {
        name: editForm.name,
        description: editForm.description,
        isActive: editForm.isActive,
      });
      toast.success("Template berhasil diperbarui!", { id: toastId });
      setIsEditOpen(false);
      loadTemplates();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Gagal memperbarui template.";
      toast.error(msg, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVersionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionForm.file) return toast.error("File baru wajib dipilih.");

    setSubmitting(true);
    const toastId = toast.loading("Mengunggah versi baru...");
    try {
      const data = new FormData();
      data.append("file", versionForm.file);

      await createNewTemplateVersion(versionForm.uuid, data);
      toast.success("Versi baru berhasil diunggah!", { id: toastId });
      setIsVersionOpen(false);
      setVersionForm({ uuid: "", name: "", file: null });
      loadTemplates();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Gagal mengunggah versi baru.";
      toast.error(msg, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (uuid: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus template "${name}"?`)) return;
    try {
      await deleteTemplate(uuid);
      toast.success("Template berhasil dihapus.");
      loadTemplates();
    } catch (err: any) {
      toast.error("Gagal menghapus template.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
            <FileText className="h-8 w-8 text-blue-600 mr-3" />
            Template Dokumen
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Kelola template Microsoft Word (.docx) beserta variabel placeholder dan assembly dokumen.
          </p>
        </div>

        {hasPermission("create", "DocumentTemplate") && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] transition cursor-pointer text-sm"
          >
            <Plus className="h-4.5 w-4.5 mr-2" />
            Upload Template Baru
          </button>
        )}
      </div>

      {/* Filters Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Cari kode atau nama..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          </div>

          <div>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Semua Kategori</option>
              {categories?.map((cat: any) => (
                <option key={cat.uuid} value={cat.uuid}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            Memuat data template...
          </div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            Tidak ada data template. Silakan tambahkan template baru.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4">Kode / Nama</th>
                  <th className="px-6 py-4">Kategori</th>
                  <th className="px-6 py-4">Versi</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Pembuat</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {templates.map((tpl: any) => (
                  <tr key={tpl.uuid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-850 dark:text-slate-150">
                        {tpl.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-450 mt-0.5 font-mono">
                        {tpl.code}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-650 dark:text-slate-350">
                      {tpl.category?.name || "-"}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      v{tpl.version}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          tpl.isActive
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-955/20 dark:text-rose-400"
                        }`}
                      >
                        {tpl.isActive ? "Aktif" : "Non-Aktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs">
                      <div>{tpl.creator?.name || "-"}</div>
                      <div className="text-[10px] mt-0.5">
                        {new Date(tpl.createdAt).toLocaleDateString("id-ID")}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                      {hasPermission("update", "DocumentTemplate") && (
                        <>
                          <button
                            onClick={() => {
                              setEditForm({
                                uuid: tpl.uuid,
                                name: tpl.name,
                                description: tpl.description || "",
                                isActive: tpl.isActive,
                              });
                              setIsEditOpen(true);
                            }}
                            className="inline-flex items-center justify-center p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg cursor-pointer transition"
                            title="Edit Info"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => {
                              setVersionForm({
                                uuid: tpl.uuid,
                                name: tpl.name,
                                file: null,
                              });
                              setIsVersionOpen(true);
                            }}
                            className="inline-flex items-center justify-center p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg cursor-pointer transition"
                            title="Upload Versi Baru"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>

                          <Link
                            href={`/document-templates/${tpl.uuid}/placeholders`}
                            className="inline-flex items-center justify-center p-2 text-slate-500 hover:text-blue-650 hover:bg-blue-50 dark:hover:bg-blue-955/20 rounded-lg cursor-pointer transition"
                            title="Configure Placeholders"
                          >
                            <Sliders className="h-4 w-4" />
                          </Link>

                          <Link
                            href={`/document-templates/${tpl.uuid}/assembly`}
                            className="inline-flex items-center justify-center p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-955/20 rounded-lg cursor-pointer transition"
                            title="Configure Assembly"
                          >
                            <Settings2 className="h-4 w-4" />
                          </Link>
                        </>
                      )}

                      {hasPermission("delete", "DocumentTemplate") && (
                        <button
                          onClick={() => handleDelete(tpl.uuid, tpl.name)}
                          className="inline-flex items-center justify-center p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-955/20 rounded-lg cursor-pointer transition"
                          title="Hapus"
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

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center">
                <Upload className="h-5 w-5 text-blue-600 mr-2" />
                Upload Template DOCX
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kode Template (Unique)</label>
                <input
                  type="text"
                  placeholder="E.g. SURAT_JALAN, SURAT_TUGAS"
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Template</label>
                <input
                  type="text"
                  placeholder="E.g. Surat Jalan Pengiriman"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kategori Dokumen</label>
                  <select
                    value={createForm.categoryId}
                    onChange={(e) => setCreateForm({ ...createForm, categoryId: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">Pilih Kategori</option>
                    {categories?.map((cat: any) => (
                      <option key={cat.uuid} value={cat.uuid}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">File Microsoft Word (.docx)</label>
                  <input
                    type="file"
                    accept=".docx"
                    onChange={(e) => setCreateForm({ ...createForm, file: e.target.files?.[0] || null })}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer file:cursor-pointer"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deskripsi</label>
                <textarea
                  placeholder="Deskripsi singkat template..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 min-h-[80px]"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition cursor-pointer"
                >
                  {submitting ? "Mengunggah..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center">
                <Edit2 className="h-5 w-5 text-blue-600 mr-2" />
                Edit Metadata Template
              </h3>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Template</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deskripsi</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 min-h-[80px]"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="h-4.5 w-4.5 text-blue-600 border-slate-200 dark:border-slate-800 rounded-md focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-slate-700 dark:text-slate-350 cursor-pointer">
                  Aktifkan Template (Bisa digunakan untuk generate dokumen)
                </label>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition cursor-pointer"
                >
                  {submitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VERSION MODAL */}
      {isVersionOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center">
                <RefreshCw className="h-5 w-5 text-emerald-600 mr-2 animate-spin-slow" />
                Upload Versi Baru Template
              </h3>
              <button onClick={() => setIsVersionOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleVersionSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl text-xs text-slate-600 dark:text-slate-400">
                Mengunggah file template Word baru untuk <span className="font-bold text-slate-800 dark:text-slate-200">{versionForm.name}</span>. 
                Sistem akan membaca ulang dan mendeteksi placeholder baru serta menaikkan nomor versi dokumen.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">File Microsoft Word Baru (.docx)</label>
                <input
                  type="file"
                  accept=".docx"
                  onChange={(e) => setVersionForm({ ...versionForm, file: e.target.files?.[0] || null })}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-55 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer file:cursor-pointer"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsVersionOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition cursor-pointer"
                >
                  {submitting ? "Mengunggah..." : "Upload Versi Baru"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

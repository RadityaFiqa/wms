"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWarehouse } from "@/hooks/useWarehouse";
import { useAuthStore } from "@/store/auth";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import {
  Warehouse,
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  MapPin,
  Layers,
  Activity,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";

export default function WarehouseManagementPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Route guard: only Super Admin can access this page
  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/");
      toast.error("Anda tidak memiliki akses ke halaman Manajemen Gudang.");
    }
  }, [user, router]);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  // Fetch paginated warehouses
  const {
    warehousesData,
    isLoading,
    refresh,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
  } = useWarehouse({
    search: debouncedSearch || undefined,
    page,
    limit,
  });

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);

  // Form Fields
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState<number>(0);
  const [type, setType] = useState("");
  const [odooReference, setOdooReference] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const openCreateModal = () => {
    setEditingWarehouse(null);
    setCode("");
    setName("");
    setLocation("");
    setAddress("");
    setCapacity(0);
    setType("");
    setOdooReference("");
    setIsActive(true);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (wh: any) => {
    setEditingWarehouse(wh);
    setCode(wh.code);
    setName(wh.name);
    setLocation(wh.location);
    setAddress(wh.address || "");
    setCapacity(wh.capacity);
    setType(wh.type || "");
    setOdooReference(wh.odooReference || "");
    setIsActive(wh.isActive);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!code.trim()) errors.code = "Kode gudang wajib diisi";
    else if (code.trim().length < 2) errors.code = "Kode minimal 2 karakter";

    if (!name.trim()) errors.name = "Nama gudang wajib diisi";
    else if (name.trim().length < 3) errors.name = "Nama minimal 3 karakter";

    if (!location.trim()) errors.location = "Lokasi (Kota/Daerah) wajib diisi";

    if (isNaN(capacity) || capacity < 0) {
      errors.capacity = "Kapasitas harus berupa angka non-negatif";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    const toastId = toast.loading(
      editingWarehouse
        ? "Memperbarui data gudang..."
        : "Membuat gudang baru...",
    );

    const payload = {
      code: code.trim(),
      name: name.trim(),
      location: location.trim(),
      address: address.trim() || null,
      capacity: Number(capacity),
      type: type.trim() || null,
      odooReference: odooReference.trim() || null,
      isActive,
    };

    try {
      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse.uuid, payload);
        toast.success("Gudang berhasil diperbarui!", { id: toastId });
      } else {
        await createWarehouse(payload);
        toast.success("Gudang berhasil ditambahkan!", { id: toastId });
      }
      setIsModalOpen(false);
      refresh();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Gagal menyimpan data gudang.";
      toast.error(msg, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (wh: any) => {
    const actionText = wh.isActive ? "menonaktifkan" : "mengaktifkan";
    const confirmAction = confirm(
      `Apakah Anda yakin ingin ${actionText} gudang ${wh.name}?`,
    );
    if (!confirmAction) return;

    const toastId = toast.loading(`Sedang ${actionText} gudang...`);
    try {
      await updateWarehouse(wh.uuid, {
        code: wh.code,
        name: wh.name,
        location: wh.location,
        capacity: wh.capacity,
        address: wh.address,
        type: wh.type,
        odooReference: wh.odooReference,
        isActive: !wh.isActive,
      });
      toast.success(
        `Gudang berhasil ${wh.isActive ? "dinonaktifkan" : "diaktifkan"}!`,
        { id: toastId },
      );
      refresh();
    } catch (err: any) {
      const msg =
        err.response?.data?.message || "Gagal mengubah status gudang.";
      toast.error(msg, { id: toastId });
    }
  };

  // Stats summaries (calculated locally or fallbacks)
  const items = warehousesData?.data || [];
  const meta = warehousesData?.meta || { total: 0, totalPages: 1 };

  // Quick stats calculations for visual cards
  const totalCount = meta.total || items.length;
  const activeCount = items.filter((w: any) => w.isActive).length;
  const totalCapacity = items.reduce(
    (sum: number, w: any) => sum + w.capacity,
    0,
  );

  if (user?.role !== "SUPER_ADMIN") {
    return null; // Don't render anything while redirecting
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
            <Warehouse className="h-8 w-8 text-blue-600 mr-3" />
            Manajemen Gudang
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Kelola, tambah, perbarui, dan kontrol status aktif setiap unit
            gudang BULOG.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] transition cursor-pointer text-sm"
        >
          <Plus className="h-5 w-5 mr-2" />
          Tambah Gudang
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600 border border-blue-100/40 dark:border-blue-900/30">
            <Warehouse className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Total Gudang
            </span>
            <strong className="text-2xl font-black text-slate-850 dark:text-slate-100">
              {totalCount}
            </strong>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 border border-emerald-100/40 dark:border-emerald-900/30">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Gudang Aktif
            </span>
            <strong className="text-2xl font-black text-slate-850 dark:text-slate-100">
              {activeCount}
            </strong>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl text-purple-600 border border-purple-100/40 dark:border-purple-900/30">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Kapasitas Terpantau
            </span>
            <strong className="text-2xl font-black text-slate-850 dark:text-slate-100">
              {totalCapacity.toLocaleString("id-ID")} Tons
            </strong>
          </div>
        </div>
      </div>

      {/* Search & Filter section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kode gudang, nama, atau lokasi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 transition"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 w-[12%]">Kode</th>
                <th className="px-6 py-4 w-[25%]">Nama Gudang</th>
                <th className="px-6 py-4 w-[15%]">Tipe</th>
                <th className="px-6 py-4 w-[20%]">Lokasi & Alamat</th>
                <th className="px-6 py-4 text-right w-[13%]">Kapasitas</th>
                <th className="px-6 py-4 text-center w-[15%]">Odoo Ref</th>
                <th className="px-6 py-4 text-center w-[12%]">Status</th>
                <th className="px-6 py-4 text-center w-[15%]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {isLoading ? (
                Array.from({ length: limit }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-14"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-44"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-36"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12 ml-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20 mx-auto"></div>
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-16 text-center text-slate-400 dark:text-slate-500 font-semibold"
                  >
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Warehouse className="h-12 w-12 text-slate-300 dark:text-slate-700" />
                      <span>Tidak ada data gudang ditemukan.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((wh: any) => (
                  <tr
                    key={wh.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-slate-850 dark:text-slate-200">
                      {wh.code}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">
                      {wh.name}
                    </td>
                    <td className="px-6 py-4">
                      {wh.type ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/20 text-indigo-750 dark:text-indigo-400 font-semibold border border-indigo-100 dark:border-indigo-900/30">
                          {wh.type}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-650">
                          -
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 space-y-0.5">
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        {wh.location}
                      </div>
                      <div
                        className="text-[10px] text-slate-450 dark:text-slate-450 truncate max-w-[200px]"
                        title={wh.address || ""}
                      >
                        {wh.address || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-850 dark:text-slate-100">
                      {wh.capacity.toLocaleString("id-ID")}
                      <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 ml-1">
                        Tons
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-semibold text-slate-600 dark:text-slate-400">
                      {wh.odooReference || "-"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {wh.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                          <CheckCircle className="h-3 w-3 mr-1 shrink-0" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-455 border border-rose-100 dark:border-rose-900/30">
                          <XCircle className="h-3 w-3 mr-1 shrink-0" />
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => openEditModal(wh)}
                          className="p-1.5 border border-slate-205 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-lg transition cursor-pointer"
                          title="Edit Gudang"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(wh)}
                          className={`p-1.5 border rounded-lg transition cursor-pointer ${
                            wh.isActive
                              ? "border-rose-200 bg-rose-50/20 hover:bg-rose-50 text-rose-600 dark:border-rose-900/40 dark:hover:bg-rose-950/20"
                              : "border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50 text-emerald-600 dark:border-emerald-900/40 dark:hover:bg-emerald-950/20"
                          }`}
                          title={
                            wh.isActive
                              ? "Nonaktifkan Gudang"
                              : "Aktifkan Gudang"
                          }
                        >
                          {wh.isActive ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {meta.totalPages > 1 && (
          <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Menampilkan {items.length} dari {totalCount} gudang
            </span>

            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(Math.max(1, page - 1))}
                className="p-1.5 border border-slate-205 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4 text-slate-605" />
              </button>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350">
                {page} / {meta.totalPages || 1}
              </span>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 border border-slate-205 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4 text-slate-605" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity"
            onClick={() => !isSaving && setIsModalOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col z-10 animate-scale-in border border-slate-105 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-slate-850 dark:text-slate-100">
                  {editingWarehouse ? "Edit Data Gudang" : "Tambah Gudang Baru"}
                </h3>
                <p className="text-xs text-slate-450 dark:text-slate-400 font-medium mt-0.5">
                  Isi informasi detail spesifikasi unit gudang di bawah ini.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isSaving && setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-605 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto text-xs font-semibold text-slate-700 dark:text-slate-300">
                {/* Warehouse Code */}
                <div className="space-y-1">
                  <label className="block uppercase tracking-wider text-[10px] text-slate-450 dark:text-slate-500 font-bold">
                    Kode Gudang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!!editingWarehouse} // Code is typically immutable once created
                    placeholder="Contoh: JKT-01"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500 dark:focus:bg-slate-850 disabled:bg-slate-100 dark:disabled:bg-slate-800/40 disabled:text-slate-500 disabled:cursor-not-allowed transition font-bold"
                  />
                  {formErrors.code && (
                    <p className="text-rose-500 text-[10px] font-bold mt-1">
                      {formErrors.code}
                    </p>
                  )}
                </div>

                {/* Warehouse Name */}
                <div className="space-y-1">
                  <label className="block uppercase tracking-wider text-[10px] text-slate-450 dark:text-slate-500 font-bold">
                    Nama Gudang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Jakarta Central Warehouse"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500 dark:focus:bg-slate-850 transition"
                  />
                  {formErrors.name && (
                    <p className="text-rose-500 text-[10px] font-bold mt-1">
                      {formErrors.name}
                    </p>
                  )}
                </div>

                {/* Warehouse Location (City/Area) */}
                <div className="space-y-1">
                  <label className="block uppercase tracking-wider text-[10px] text-slate-450 dark:text-slate-500 font-bold">
                    Kota / Wilayah <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Jakarta Timur"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500 dark:focus:bg-slate-850 transition"
                  />
                  {formErrors.location && (
                    <p className="text-rose-500 text-[10px] font-bold mt-1">
                      {formErrors.location}
                    </p>
                  )}
                </div>

                {/* Capacity */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block uppercase tracking-wider text-[10px] text-slate-450 dark:text-slate-500 font-bold">
                      Kapasitas Maksimal (Tons){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      value={capacity === 0 ? "" : capacity}
                      onChange={(e) =>
                        setCapacity(parseFloat(e.target.value) || 0)
                      }
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500 dark:focus:bg-slate-850 transition"
                    />
                    {formErrors.capacity && (
                      <p className="text-rose-500 text-[10px] font-bold mt-1">
                        {formErrors.capacity}
                      </p>
                    )}
                  </div>

                  {/* Type */}
                  <div className="space-y-1">
                    <label className="block uppercase tracking-wider text-[10px] text-slate-450 dark:text-slate-500 font-bold">
                      Tipe Gudang
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: CENTRAL, COLD, OUTLET"
                      value={type}
                      onChange={(e) => setType(e.target.value.toUpperCase())}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500 dark:focus:bg-slate-850 transition"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1">
                  <label className="block uppercase tracking-wider text-[10px] text-slate-450 dark:text-slate-500 font-bold">
                    Alamat Lengkap
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: Kawasan Industri Pulogadung, Jakarta Timur"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500 dark:focus:bg-slate-850 transition font-medium"
                  />
                </div>

                {/* Odoo Account / ERP Reference */}
                <div className="space-y-1">
                  <label className="block uppercase tracking-wider text-[10px] text-slate-450 dark:text-slate-500 font-bold">
                    Referensi Odoo / ERP (Kode Warehouse)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: WH-JKT"
                    value={odooReference}
                    onChange={(e) => setOdooReference(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-blue-500 dark:focus:bg-slate-850 transition"
                  />
                </div>

                {/* Status Toggle (Only for Edit) */}
                {editingWarehouse && (
                  <div className="flex items-center space-x-3 pt-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label
                      htmlFor="isActive"
                      className="text-xs font-bold text-slate-805 dark:text-slate-200 cursor-pointer"
                    >
                      Gudang Aktif (Dapat diakses untuk transaksi operasional)
                    </label>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => !isSaving && setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-xs transition disabled:opacity-40 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow-md transition disabled:opacity-40 cursor-pointer"
                >
                  {isSaving ? "Menyimpan..." : "Simpan Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

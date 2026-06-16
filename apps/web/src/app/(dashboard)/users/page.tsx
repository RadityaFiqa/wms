"use client";

import React, { useState } from "react";
import useSWR, { mutate } from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateUserSchema, UpdateUserSchema } from "@bulog-wms/schema";
import type { CreateUserInput, UpdateUserInput } from "@bulog-wms/schema";
import { useUser } from "@/hooks/useUser";
import { useRole } from "@/hooks/useRole";
import { useWarehouse } from "@/hooks/useWarehouse";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  Edit2,
  Trash2,
  RefreshCw,
  Power,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Warehouse,
  ShieldCheck,
} from "lucide-react";

export default function UserManagementPage() {
  const { user } = useAuthStore();
  // Query state
  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState("");
  const [isActive, setIsActive] = useState("");
  const [page, setPage] = useState(1);
  const limit = 5;

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Modular Hooks
  const { roles } = useRole();
  const { warehouses } = useWarehouse();
  const {
    usersData,
    isLoading: usersLoading,
    createUser,
    updateUser,
    toggleStatus,
    resetPassword,
  } = useUser({
    search,
    roleId,
    isActive,
    page,
    limit,
  });

  // Create User Form
  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    reset: resetCreate,
    formState: { errors: createErrors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(CreateUserSchema),
  });

  // Edit User Form
  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    setValue: setEditValue,
    formState: { errors: editErrors },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(UpdateUserSchema),
  });

  const onCreateUser = async (data: CreateUserInput) => {
    try {
      await createUser({
        ...data,
        roleId: Number(data.roleId),
        warehouseId: data.warehouseId ? Number(data.warehouseId) : null,
      });
      toast.success(
        "User baru berhasil ditambahkan! Password sementara dikirim ke email.",
      );
      setIsCreateOpen(false);
      resetCreate();
    } catch (error: any) {
      const msg = error.response?.data?.message || "Gagal menambahkan user.";
      toast.error(msg);
    }
  };

  const onEditUser = async (data: UpdateUserInput) => {
    try {
      await updateUser(editingUser.uuid, {
        ...data,
        roleId: Number(data.roleId),
        warehouseId: data.warehouseId ? Number(data.warehouseId) : null,
      });
      toast.success("Data user berhasil diperbarui.");
      setIsEditOpen(false);
    } catch (error: any) {
      const msg = error.response?.data?.message || "Gagal memperbarui user.";
      toast.error(msg);
    }
  };

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setEditValue("name", user.name);
    setEditValue("email", user.email);
    setEditValue("roleId", user.roleId);
    setEditValue("warehouseId", user.warehouseId || null);
    setEditValue("isActive", user.isActive);
    setIsEditOpen(true);
  };

  const toggleUserStatus = async (user: any) => {
    const action = user.isActive ? "deactivate" : "activate";
    const confirmMsg = user.isActive
      ? `Apakah Anda yakin ingin menonaktifkan user ${user.name}?`
      : `Apakah Anda yakin ingin mengaktifkan kembali user ${user.name}?`;

    if (!confirm(confirmMsg)) return;

    try {
      await toggleStatus(user.uuid, action);
      toast.success(
        `User ${user.name} berhasil ${user.isActive ? "dinonaktifkan" : "diaktifkan"}.`,
      );
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Gagal mengubah status user.",
      );
    }
  };

  const handleResetPassword = async (user: any) => {
    if (
      !confirm(
        `Apakah Anda yakin ingin mereset password user ${user.name}? Password baru yang aman akan dihasilkan secara acak dan dikirimkan ke email mereka.`,
      )
    ) {
      return;
    }

    try {
      await resetPassword(user.uuid);
      toast.success(
        `Password user ${user.name} berhasil direset dan dikirimkan.`,
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal mereset password.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            Manajemen User
          </h1>
          <p className="text-slate-500 mt-1">
            Daftar pengguna aplikasi WMS, alokasi gudang, dan peran akses
            mereka.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] transition"
        >
          <UserPlus className="h-5 w-5 mr-2" />
          Tambah User Baru
        </button>
      </div>

      {/* Filters Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Cari Nama/Email
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari user..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Filter Peran (Role)
          </label>
          <select
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="">Semua Role</option>
            {roles
              ?.filter(
                (r: any) =>
                  user?.role === "SUPER_ADMIN" || r.name !== "SUPER_ADMIN",
              )
              .map((role: any) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Filter Status
          </label>
          <select
            value={isActive}
            onChange={(e) => {
              setIsActive(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="">Semua Status</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Nama & Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Gudang</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {usersLoading ? (
                // Skeletons
                Array.from({ length: limit }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 rounded w-48 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-36"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 rounded w-32"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 bg-slate-200 rounded-full w-16"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-8 bg-slate-200 rounded w-32 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : usersData?.data?.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-400 font-medium"
                  >
                    Tidak ada data user ditemukan.
                  </td>
                </tr>
              ) : (
                usersData?.data?.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{u.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {u.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center text-slate-700 font-semibold">
                        <ShieldCheck className="h-4 w-4 mr-1.5 text-indigo-500" />
                        {u.role.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center text-slate-600">
                        <Warehouse className="h-4 w-4 mr-1.5 text-blue-500" />
                        {u.warehouse?.name || "Semua Gudang (Super)"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-red-50 text-red-700 border border-red-100"
                        }`}
                      >
                        {u.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          title="Edit User"
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(u)}
                          title="Reset Password"
                          className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleUserStatus(u)}
                          title={u.isActive ? "Deaktivasi" : "Aktivasi"}
                          className={`p-2 rounded-lg transition ${
                            u.isActive
                              ? "text-slate-500 hover:text-red-600 hover:bg-red-50"
                              : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {usersData?.meta && (
          <div className="bg-slate-50 px-4 sm:px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500 font-semibold text-center sm:text-left">
              Menampilkan {usersData.data.length} dari {usersData.meta.total}{" "}
              user
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <span className="text-sm font-bold text-slate-700">
                {page} / {usersData.meta.totalPages}
              </span>
              <button
                disabled={page >= usersData.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition"
              >
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- CREATE USER MODAL --- */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                Tambah User Baru
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition"
              >
                &times;
              </button>
            </div>
            <form
              onSubmit={handleCreateSubmit(onCreateUser)}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama"
                  {...registerCreate("name")}
                  className="w-full border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                {createErrors.name && (
                  <p className="text-xs text-red-500 mt-1">
                    {createErrors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="nama@bulog.co.id"
                  {...registerCreate("email")}
                  className="w-full border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                {createErrors.email && (
                  <p className="text-xs text-red-500 mt-1">
                    {createErrors.email.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Role
                  </label>
                  <select
                    {...registerCreate("roleId", { valueAsNumber: true })}
                    className="w-full border border-slate-200 bg-white text-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Pilih Role</option>
                    {roles
                      ?.filter(
                        (r: any) =>
                          user?.role === "SUPER_ADMIN" ||
                          r.name !== "SUPER_ADMIN",
                      )
                      .map((role: any) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                  </select>
                  {createErrors.roleId && (
                    <p className="text-xs text-red-500 mt-1">
                      {createErrors.roleId.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Gudang
                  </label>
                  <select
                    {...registerCreate("warehouseId", {
                      setValueAs: (v) => (v === "" ? null : Number(v)),
                    })}
                    className="w-full border border-slate-200 bg-white text-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {user?.role === "SUPER_ADMIN" ? (
                      <option value="">Semua Gudang (Super)</option>
                    ) : (
                      <option value="">Pilih Gudang</option>
                    )}
                    {warehouses?.map((wh: any) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg hover:shadow-blue-500/10 transition"
                >
                  Simpan User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT USER MODAL --- */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                Edit Data User
              </h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition"
              >
                &times;
              </button>
            </div>
            <form
              onSubmit={handleEditSubmit(onEditUser)}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama"
                  {...registerEdit("name")}
                  className="w-full border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                {editErrors.name && (
                  <p className="text-xs text-red-500 mt-1">
                    {editErrors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="nama@bulog.co.id"
                  {...registerEdit("email")}
                  className="w-full border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                {editErrors.email && (
                  <p className="text-xs text-red-500 mt-1">
                    {editErrors.email.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Role
                  </label>
                  <select
                    {...registerEdit("roleId", { valueAsNumber: true })}
                    className="w-full border border-slate-200 bg-white text-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Pilih Role</option>
                    {roles
                      ?.filter(
                        (r: any) =>
                          user?.role === "SUPER_ADMIN" ||
                          r.name !== "SUPER_ADMIN",
                      )
                      .map((role: any) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                  </select>
                  {editErrors.roleId && (
                    <p className="text-xs text-red-500 mt-1">
                      {editErrors.roleId.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Gudang
                  </label>
                  <select
                    {...registerEdit("warehouseId", {
                      setValueAs: (v) =>
                        v === "" || v === "null" || v === null
                          ? null
                          : Number(v),
                    })}
                    className="w-full border border-slate-200 bg-white text-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {user?.role === "SUPER_ADMIN" ? (
                      <option value="null">Semua Gudang (Super)</option>
                    ) : (
                      <option value="">Pilih Gudang</option>
                    )}
                    {warehouses?.map((wh: any) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg hover:shadow-blue-500/10 transition"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

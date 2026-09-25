"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateOdooAccountSchema } from "@bulog-wms/schema";
import { useOdooAccount } from "@/hooks/useOdooAccount";
import { useErpSyncStatus } from "@/hooks/useErpDocuments";
import { useAuthStore } from "@/store/auth";
import { useWarehouse } from "@/hooks/useWarehouse";
import { toast } from "sonner";
import {
  Settings,
  RefreshCw,
  Power,
  Warehouse,
  Globe,
  User,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Save,
  Clock,
  Database,
  ArrowDownUp,
  FileSpreadsheet,
  Boxes,
  FileCheck,
} from "lucide-react";

interface CredentialCardProps {
  typeTitle: string;
  typeSubtitle: string;
  badgeText: string;
  badgeColor: string;
  icon: React.ReactNode;
  isNonCommodity: boolean;
  config: any;
  activeWarehouseId: number;
  onSave: (payload: any, existingUuid?: string) => Promise<void>;
  onTestConnection: (uuid: string) => Promise<any>;
  onRefreshSession: (uuid: string) => Promise<any>;
  onToggleStatus: (uuid: string, action: "activate" | "deactivate") => Promise<any>;
  onForceSync: () => Promise<any>;
  isSyncingExternal?: boolean;
}

function OdooCredentialCard({
  typeTitle,
  typeSubtitle,
  badgeText,
  badgeColor,
  icon,
  isNonCommodity,
  config,
  activeWarehouseId,
  onSave,
  onTestConnection,
  onRefreshSession,
  onToggleStatus,
  onForceSync,
  isSyncingExternal = false,
}: CredentialCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(UpdateOdooAccountSchema),
    defaultValues: {
      warehouseId: activeWarehouseId,
      baseUrl: "",
      username: "",
      password: "",
      isActive: true,
      isNonCommodity,
    },
  });

  useEffect(() => {
    if (config && activeWarehouseId) {
      setValue("warehouseId", activeWarehouseId);
      setValue("baseUrl", config.baseUrl || "");
      setValue("username", config.username || "");
      setValue("password", "");
      setValue("isActive", config.isActive ?? true);
      setValue("isNonCommodity", isNonCommodity);
    } else if (activeWarehouseId) {
      reset({
        warehouseId: activeWarehouseId,
        baseUrl: "",
        username: "",
        password: "",
        isActive: true,
        isNonCommodity,
      });
    }
  }, [config, activeWarehouseId, isNonCommodity, setValue, reset]);

  const handleFormSubmit = async (formData: any) => {
    if (!config && (!formData.password || formData.password.length < 4)) {
      toast.error(
        `Password Odoo minimal 4 karakter wajib diisi untuk konfigurasi ${badgeText}.`,
      );
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(`Menyimpan konfigurasi ${badgeText}...`);
    try {
      const payload: any = {
        warehouseId: activeWarehouseId,
        baseUrl: formData.baseUrl,
        username: formData.username,
        isNonCommodity,
        isActive: config ? config.isActive : true,
      };
      if (formData.password) {
        payload.password = formData.password;
      }

      await onSave(payload, config?.uuid);
      toast.success(`Konfigurasi ${badgeText} berhasil disimpan.`, {
        id: toastId,
      });
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || `Gagal menyimpan konfigurasi ${badgeText}.`,
        { id: toastId },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!config) return;
    setIsTesting(true);
    const toastId = toast.loading(`Menguji koneksi akun ${badgeText}...`);
    try {
      const res = await onTestConnection(config.uuid);
      if (res?.success) {
        toast.success(`Koneksi ${badgeText} Berhasil! Session ID telah diperbarui.`, {
          id: toastId,
        });
      } else {
        toast.error(`Koneksi ${badgeText} Gagal.`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || `Koneksi Odoo ${badgeText} Gagal.`,
        { id: toastId },
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleRefresh = async () => {
    if (!config) return;
    setIsRefreshing(true);
    const toastId = toast.loading(`Menyegarkan sesi ${badgeText}...`);
    try {
      await onRefreshSession(config.uuid);
      toast.success(`Sesi Odoo ${badgeText} berhasil disegarkan.`, {
        id: toastId,
      });
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || `Gagal menyegarkan sesi ${badgeText}.`,
        { id: toastId },
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggle = async () => {
    if (!config) return;
    const action = config.isActive ? "deactivate" : "activate";
    const toastId = toast.loading(
      config.isActive
        ? `Menonaktifkan konfigurasi ${badgeText}...`
        : `Mengaktifkan konfigurasi ${badgeText}...`,
    );
    try {
      await onToggleStatus(config.uuid, action);
      toast.success(
        `Konfigurasi ${badgeText} berhasil ${
          config.isActive ? "dinonaktifkan" : "diaktifkan"
        }.`,
        { id: toastId },
      );
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Gagal mengubah status aktif.",
        { id: toastId },
      );
    }
  };

  const handleSync = async () => {
    if (!config) return;
    setIsSyncing(true);
    const toastId = toast.loading(
      `Memulai sinkronisasi paksa ${badgeText}...`,
    );
    try {
      const res = await onForceSync();
      if (res?.message?.includes("already in progress")) {
        toast.info(`Sinkronisasi ${badgeText} sedang berlangsung.`, {
          id: toastId,
        });
      } else {
        toast.success(
          `Sinkronisasi ${badgeText} berhasil dipicu di latar belakang.`,
          { id: toastId },
        );
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || `Gagal memicu sinkronisasi ${badgeText}.`,
        { id: toastId },
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const getSessionBadge = () => {
    if (!config) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
          Belum Dikonfigurasi
        </span>
      );
    }

    if (!config.isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          Nonaktif
        </span>
      );
    }

    if (!config.sessionId) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 animate-pulse">
          <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
          Belum Login
        </span>
      );
    }

    const isExpired =
      config.sessionExpiredAt &&
      new Date(config.sessionExpiredAt) <= new Date();
    if (isExpired) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40">
          <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
          Sesi Kedaluwarsa
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
        <CheckCircle2 className="h-3 w-3 mr-1 shrink-0" />
        Sesi Aktif
      </span>
    );
  };

  const isSyncActive = isSyncing || isSyncingExternal;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between overflow-hidden">
      {/* Card Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-900/40">
              {icon}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {typeTitle}
                </h2>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${badgeColor}`}
                >
                  {badgeText}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {typeSubtitle}
              </p>
            </div>
          </div>
          <div>{getSessionBadge()}</div>
        </div>
      </div>

      <div className="p-6 space-y-6 flex-1">
        {/* Session Details & Action Buttons if configured */}
        {config && (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200/70 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Penyegaran Sesi Terakhir
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5 block">
                  {config.lastRefreshAt
                    ? new Date(config.lastRefreshAt).toLocaleString("id-ID")
                    : "-"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Kedaluwarsa Sesi
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5 block">
                  {config.sessionExpiredAt
                    ? new Date(config.sessionExpiredAt).toLocaleString("id-ID")
                    : "-"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Status Integrasi:
              </span>
              <button
                type="button"
                onClick={handleToggle}
                className={`flex items-center text-xs font-bold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                  config.isActive
                    ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100/70 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400"
                }`}
              >
                <Power className="h-3.5 w-3.5 mr-1.5" />
                {config.isActive ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>

            {config.isActive && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting || isRefreshing}
                  className="flex-1 flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 text-slate-700 dark:text-slate-300 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  <Activity
                    className={`h-3.5 w-3.5 mr-1.5 text-blue-500 ${
                      isTesting ? "animate-pulse" : ""
                    }`}
                  />
                  Test Koneksi
                </button>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isTesting || isRefreshing}
                  className="flex-1 flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 text-slate-700 dark:text-slate-300 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 mr-1.5 text-indigo-500 ${
                      isRefreshing ? "animate-spin" : ""
                    }`}
                  />
                  Refresh Token
                </button>
              </div>
            )}
          </div>
        )}

        {/* Credential Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Odoo Base URL
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="https://beras.bulog.co.id"
                {...register("baseUrl")}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 transition placeholder:text-slate-400"
              />
            </div>
            {errors.baseUrl && (
              <p className="text-xs text-red-500 mt-1">
                {errors.baseUrl.message as string}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Username Odoo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Username"
                  {...register("username")}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 transition placeholder:text-slate-400"
                />
              </div>
              {errors.username && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.username.message as string}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex justify-between">
                <span>Password Odoo</span>
                {config && (
                  <span className="text-[9px] text-slate-400 font-normal">
                    (Kosongkan jika tetap)
                  </span>
                )}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={config ? "••••••••" : "Password baru"}
                  {...register("password")}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 transition placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                >
                  {showPassword ? (
                    <EyeOff className="h-4.5 w-4.5" />
                  ) : (
                    <Eye className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.password.message as string}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-bold px-5 py-2.5 rounded-xl shadow-sm active:scale-[0.98] transition text-xs cursor-pointer min-h-[38px]"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {config ? "Perbarui Kredensial" : "Simpan Kredensial Baru"}
            </button>
          </div>
        </form>

        {/* Sync Info and Force Sync Section */}
        {config && config.isActive && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center">
                <Database className="h-4 w-4 mr-1.5 text-blue-600" />
                Informasi & Status Sinkronisasi
              </span>
            </div>

            {!isNonCommodity ? (
              /* Commodity Sync Stats */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Documents Sync */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center text-[11px]">
                      <ArrowDownUp className="h-3.5 w-3.5 mr-1 text-blue-500" />
                      Dokumen ERP Masuk/Keluar
                    </span>
                    {config.lastSyncDocumentsStatus === "SUCCESS" ? (
                      <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/40">
                        Sukses
                      </span>
                    ) : config.lastSyncDocumentsStatus === "FAILED" ? (
                      <span
                        className="text-[9px] font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-900/40"
                        title={config.lastSyncDocumentsError || ""}
                      >
                        Gagal
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        Belum Sync
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Terakhir:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {config.lastSyncDocumentsAt
                        ? new Date(config.lastSyncDocumentsAt).toLocaleString(
                            "id-ID",
                          )
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Total Synced:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {config.lastSyncDocumentsCount ?? 0} dokumen
                    </span>
                  </div>
                </div>

                {/* Inventory Sync */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center text-[11px]">
                      <Boxes className="h-3.5 w-3.5 mr-1 text-indigo-500" />
                      Persediaan Stok
                    </span>
                    {config.lastSyncInventoryStatus === "SUCCESS" ? (
                      <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/40">
                        Sukses
                      </span>
                    ) : config.lastSyncInventoryStatus === "FAILED" ? (
                      <span
                        className="text-[9px] font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-900/40"
                        title={config.lastSyncInventoryError || ""}
                      >
                        Gagal
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        Belum Sync
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Terakhir:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {config.lastSyncInventoryAt
                        ? new Date(config.lastSyncInventoryAt).toLocaleString(
                            "id-ID",
                          )
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Total Synced:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {config.lastSyncInventoryCount ?? 0} quants
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Non-Commodity Sync Stats */
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center">
                    <FileCheck className="h-4 w-4 mr-1.5 text-purple-600" />
                    Purchase Order Non Commodity
                  </span>
                  {config.lastSyncDocumentsStatus === "SUCCESS" ? (
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-900/40">
                      Sukses
                    </span>
                  ) : config.lastSyncDocumentsStatus === "FAILED" ? (
                    <span
                      className="text-[10px] font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-md border border-red-100 dark:border-red-900/40"
                      title={config.lastSyncDocumentsError || ""}
                    >
                      Gagal
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      Belum Sync
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Waktu Sync Terakhir
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {config.lastSyncDocumentsAt
                        ? new Date(config.lastSyncDocumentsAt).toLocaleString(
                            "id-ID",
                          )
                        : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Total Dokumen Tersimpan
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {config.lastSyncDocumentsCount ?? 0} PO (Offset: {config.lastDocumentsOffset ?? 0})
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Dedicated Force Sync Button */}
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncActive}
              className={`w-full flex items-center justify-center font-bold px-4 py-2.5 rounded-xl shadow-sm active:scale-[0.98] transition cursor-pointer text-xs min-h-[42px] text-white ${
                isNonCommodity
                  ? "bg-purple-600 hover:bg-purple-500 disabled:bg-purple-400 shadow-purple-600/10"
                  : "bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 shadow-blue-600/10"
              }`}
            >
              {isSyncActive ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sedang Sinkronisasi {badgeText}...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Force Sync {badgeText}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OdooConfigPage() {
  const { activeWarehouse } = useAuthStore();
  const { warehouses, isLoading: warehousesLoading } = useWarehouse();
  const currentWarehouse = warehouses?.find(
    (w: any) => w.uuid === activeWarehouse?.uuid,
  );
  const activeWarehouseId = currentWarehouse?.id || 0;

  const {
    commodityConfig,
    nonCommodityConfig,
    isLoading: configLoading,
    createConfig,
    updateConfig,
    toggleStatus,
    testConnection,
    refreshSession,
    syncAll,
    syncNonCommodity,
    refresh,
  } = useOdooAccount();

  const { syncStatus, refreshStatus } = useErpSyncStatus();

  const handleSaveCredential = async (payload: any, existingUuid?: string) => {
    if (existingUuid) {
      await updateConfig(existingUuid, payload);
    } else {
      await createConfig(payload);
    }
    refresh();
  };

  if (!activeWarehouse) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
            <Settings className="h-8 w-8 text-blue-600 mr-3" />
            Integrasi ERP Odoo
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Konfigurasi dan kelola kredensial akun Odoo ERP yang terhubung ke
            Gudang Bulog.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center shadow-sm space-y-4">
          <Warehouse className="h-12 w-12 text-slate-350 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Gudang Aktif Belum Dipilih
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Silakan pilih gudang aktif terlebih dahulu di panel navigasi atas
            untuk mengelola konfigurasi integrasi ERP Odoo.
          </p>
        </div>
      </div>
    );
  }

  if (configLoading || warehousesLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <svg
          className="animate-spin h-8 w-8 text-blue-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    );
  }

  const isCommoditySyncRunning =
    syncStatus?.status === "RUNNING" || syncStatus?.status === "PENDING";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
          <Settings className="h-8 w-8 text-blue-600 mr-3" />
          Integrasi ERP Odoo
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Kelola multi-kredensial akun Odoo ERP untuk komoditas dan non-komoditas
          yang terhubung dengan gudang{" "}
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            {activeWarehouse.name}
          </span>
          .
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 p-4 rounded-xl text-sm text-blue-800 dark:text-blue-300 leading-relaxed shadow-sm">
        💡 <strong>Info Multi-Kredensial</strong>: Kredensial akun Odoo dipisahkan
        antara <strong>Komoditas (Operasional Gudang)</strong> dan{" "}
        <strong>Non Komoditas (Finance & Purchase Order)</strong>. Sesi token
        diperbarui otomatis secara berkala sebelum masa berlaku sesi kedaluwarsa.
      </div>

      {/* Two Credential Cards Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Card 1: Credential Commodity */}
        <OdooCredentialCard
          typeTitle="Kredensial Commodity"
          typeSubtitle="Operasional Gudang, Dokumen ERP (PO/SO) & Stok Komoditas"
          badgeText="Commodity"
          badgeColor="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400"
          icon={<Warehouse className="h-6 w-6" />}
          isNonCommodity={false}
          config={commodityConfig}
          activeWarehouseId={activeWarehouseId}
          onSave={handleSaveCredential}
          onTestConnection={testConnection}
          onRefreshSession={refreshSession}
          onToggleStatus={toggleStatus}
          onForceSync={syncAll}
          isSyncingExternal={isCommoditySyncRunning}
        />

        {/* Card 2: Credential Non Commodity */}
        <OdooCredentialCard
          typeTitle="Kredensial Non Commodity"
          typeSubtitle="Finance Management, Dokumen PO & Penagihan Non Komoditas"
          badgeText="Non Commodity"
          badgeColor="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-400"
          icon={<FileSpreadsheet className="h-6 w-6" />}
          isNonCommodity={true}
          config={nonCommodityConfig}
          activeWarehouseId={activeWarehouseId}
          onSave={handleSaveCredential}
          onTestConnection={testConnection}
          onRefreshSession={refreshSession}
          onToggleStatus={toggleStatus}
          onForceSync={syncNonCommodity}
        />
      </div>
    </div>
  );
}

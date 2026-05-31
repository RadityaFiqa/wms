'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UpdateOdooAccountSchema } from '@bulog-wms/schema';
import { useOdooAccount } from '@/hooks/useOdooAccount';
import { useAuthStore } from '@/store/auth';
import { useWarehouse } from '@/hooks/useWarehouse';
import { toast } from 'sonner';
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
} from 'lucide-react';

export default function OdooConfigPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { activeWarehouse } = useAuthStore();
  const { warehouses, isLoading: warehousesLoading } = useWarehouse();
  const currentWarehouse = warehouses?.find((w: any) => w.uuid === activeWarehouse?.uuid);
  const activeWarehouseId = currentWarehouse?.id || 0;

  const {
    config: activeConfig,
    isLoading: configLoading,
    createConfig,
    updateConfig,
    toggleStatus,
    testConnection: triggerTestConnection,
    refreshSession,
  } = useOdooAccount();

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
      baseUrl: '',
      username: '',
      password: '',
      isActive: true,
    },
  });

  // Populate form when configuration loads or active warehouse changes
  useEffect(() => {
    if (activeConfig && activeWarehouseId) {
      setValue('warehouseId', activeWarehouseId);
      setValue('baseUrl', activeConfig.baseUrl);
      setValue('username', activeConfig.username);
      setValue('password', ''); // default password empty on edit
      setValue('isActive', activeConfig.isActive);
    } else if (activeWarehouseId) {
      reset({
        warehouseId: activeWarehouseId,
        baseUrl: '',
        username: '',
        password: '',
        isActive: true,
      });
    }
  }, [activeConfig, activeWarehouseId, setValue, reset]);

  const onSubmit = async (data: any) => {
    if (!activeWarehouse) {
      toast.error('Gudang aktif tidak terdeteksi.');
      return;
    }

    // Password validation for new config (required)
    if (!activeConfig && (!data.password || data.password.length < 4)) {
      toast.error('Kredensial Password Odoo minimal 4 karakter wajib diisi untuk konfigurasi baru.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Menyimpan konfigurasi ERP Odoo...');
    try {
      if (activeConfig) {
        const payload = {
          warehouseId: activeWarehouseId,
          baseUrl: data.baseUrl,
          username: data.username,
          password: data.password || null,
          isActive: activeConfig.isActive,
        };
        await updateConfig(activeConfig.uuid, payload);
        toast.success('Konfigurasi ERP Odoo berhasil diperbarui.', { id: toastId });
      } else {
        const payload = {
          warehouseId: activeWarehouseId,
          baseUrl: data.baseUrl,
          username: data.username,
          password: data.password,
        };
        await createConfig(payload);
        toast.success('Konfigurasi ERP Odoo berhasil disimpan.', { id: toastId });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal menyimpan konfigurasi.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!activeConfig) return;
    setIsTesting(true);
    const toastId = toast.loading('Menguji koneksi ke ERP Odoo...');
    try {
      const response = await triggerTestConnection(activeConfig.uuid);
      if (response?.success) {
        toast.success('Koneksi Odoo Berhasil! Session ID telah diperbarui.', { id: toastId });
      } else {
        toast.error('Koneksi Gagal.', { id: toastId });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Koneksi Odoo Gagal.', { id: toastId });
    } finally {
      setIsTesting(false);
    }
  };

  const handleManualRefresh = async () => {
    if (!activeConfig) return;
    setIsRefreshing(true);
    const toastId = toast.loading('Menyegarkan sesi Odoo...');
    try {
      await refreshSession(activeConfig.uuid);
      toast.success('Sesi Odoo berhasil disegarkan secara manual.', { id: toastId });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal menyegarkan sesi Odoo.', { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleActive = async () => {
    if (!activeConfig) return;
    const action = activeConfig.isActive ? 'deactivate' : 'activate';
    const toastId = toast.loading(
      activeConfig.isActive ? 'Menonaktifkan konfigurasi...' : 'Mengaktifkan konfigurasi...'
    );
    try {
      await toggleStatus(activeConfig.uuid, action);
      toast.success(
        `Konfigurasi Odoo berhasil ${activeConfig.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`,
        { id: toastId }
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal mengubah status aktif.', { id: toastId });
    }
  };

  const getSessionStatusBadge = () => {
    if (!activeConfig) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
          Belum Dikonfigurasi
        </span>
      );
    }

    if (!activeConfig.isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          Nonaktif
        </span>
      );
    }

    if (!activeConfig.sessionId) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
          <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
          Belum Login
        </span>
      );
    }

    const isExpired =
      activeConfig.sessionExpiredAt && new Date(activeConfig.sessionExpiredAt) <= new Date();
    if (isExpired) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
          Sesi Kedaluwarsa
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3 mr-1 shrink-0" />
        Sesi Aktif
      </span>
    );
  };

  if (!activeWarehouse) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center">
            <Settings className="h-8 w-8 text-blue-600 mr-3" />
            Integrasi ERP Odoo
          </h1>
          <p className="text-slate-500 mt-1">
            Konfigurasi dan kelola kredensial akun Odoo ERP yang terhubung ke Gudang Bulog.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm space-y-4">
          <Warehouse className="h-12 w-12 text-slate-350 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800">Gudang Aktif Belum Dipilih</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Silakan pilih gudang aktif terlebih dahulu di panel navigasi atas untuk mengelola konfigurasi integrasi ERP Odoo.
          </p>
        </div>
      </div>
    );
  }

  if (configLoading || warehousesLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center">
          <Settings className="h-8 w-8 text-blue-600 mr-3 animate-spin-slow" />
          Integrasi ERP Odoo
        </h1>
        <p className="text-slate-500 mt-1">
          Konfigurasi dan kelola kredensial akun Odoo ERP yang terhubung ke Gudang aktif Anda.
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-xl text-sm text-blue-800 leading-relaxed shadow-sm">
        💡 <strong>Info Sistem</strong>: Sesi Odoo otomatis dijaga agar tetap aktif. Sistem menjalankan background scheduler harian untuk menyegarkan token sebelum kedaluwarsa (Masa berlaku sesi Odoo adalah 7 hari).
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Connection Status Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100">
            <div className="h-20 w-20 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <Warehouse className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">{activeWarehouse.name}</h3>
            <div className="mt-2.5">
              {getSessionStatusBadge()}
            </div>
          </div>

          {activeConfig && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Penyegaran Sesi Terakhir</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {activeConfig.lastRefreshAt
                      ? new Date(activeConfig.lastRefreshAt).toLocaleString('id-ID')
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kedaluwarsa Sesi</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {activeConfig.sessionExpiredAt
                      ? new Date(activeConfig.sessionExpiredAt).toLocaleString('id-ID')
                      : '-'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeConfig && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Integrasi</span>
                <button
                  onClick={handleToggleActive}
                  className={`flex items-center text-xs font-bold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                    activeConfig.isActive
                      ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100/70'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
                  }`}
                >
                  <Power className="h-3.5 w-3.5 mr-1.5" />
                  {activeConfig.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>

              {activeConfig.isActive && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting || isRefreshing}
                    className="flex-1 flex items-center justify-center border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer"
                  >
                    <Activity className={`h-3.5 w-3.5 mr-1.5 text-blue-500 ${isTesting ? 'animate-pulse' : ''}`} />
                    Test Koneksi
                  </button>
                  <button
                    onClick={handleManualRefresh}
                    disabled={isTesting || isRefreshing}
                    className="flex-1 flex items-center justify-center border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-indigo-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh Token
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Configuration Form Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4 mb-6">
            <Lock className="h-6 w-6 text-slate-400" />
            <h3 className="text-lg font-bold text-slate-800">
              {activeConfig ? 'Kredensial Akun Odoo' : 'Hubungkan ERP Odoo Baru'}
            </h3>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="baseUrl" className="block text-sm font-semibold text-slate-700 mb-2">
                Odoo Base URL
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-400" />
                <input
                  id="baseUrl"
                  type="text"
                  placeholder="https://beras.bulog.co.id"
                  {...register('baseUrl')}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition duration-200 placeholder:text-slate-400 text-sm"
                />
              </div>
              {errors.baseUrl && (
                <p className="text-xs text-red-500 mt-1">{errors.baseUrl.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-slate-700 mb-2">
                  Username Odoo
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    id="username"
                    type="text"
                    placeholder="Masukkan username"
                    {...register('username')}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition duration-200 placeholder:text-slate-400 text-sm"
                  />
                </div>
                {errors.username && (
                  <p className="text-xs text-red-500 mt-1">{errors.username.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2 flex justify-between">
                  <span>Password Odoo</span>
                  {activeConfig && (
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      (Kosongkan jika tetap)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={
                      activeConfig ? '••••••••' : 'Masukkan password baru'
                    }
                    {...register('password')}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg pl-10 pr-12 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition duration-200 placeholder:text-slate-400 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-lg shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] transition duration-200 text-sm cursor-pointer"
              >
                {isSaving ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    <Save className="h-4.5 w-4.5 mr-2" />
                    Simpan Konfigurasi
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

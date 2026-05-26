'use client';

import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateOdooAccountSchema, UpdateOdooAccountSchema } from '@bulog-wms/schema';
import type { CreateOdooAccountInput, UpdateOdooAccountInput } from '@bulog-wms/schema';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import {
  Search,
  Settings,
  Edit2,
  Trash2,
  RefreshCw,
  Power,
  ChevronLeft,
  ChevronRight,
  Warehouse,
  Globe,
  User,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react';

const fetcher = (url: string) => api.get(url).then((res) => res.data);

export default function OdooConfigPage() {
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [testingUuid, setTestingUuid] = useState<string | null>(null);
  const [refreshingUuid, setRefreshingUuid] = useState<string | null>(null);
  const [testingRaw, setTestingRaw] = useState(false);

  // SWR fetches
  const { data: configs, isLoading: configsLoading } = useSWR('/odoo-accounts', fetcher);
  const { data: warehouses } = useSWR('/warehouses', fetcher);

  // Create Form
  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    reset: resetCreate,
    getValues: getCreateValues,
    formState: { errors: createErrors },
  } = useForm<CreateOdooAccountInput>({
    resolver: zodResolver(CreateOdooAccountSchema),
  });

  // Edit Form
  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    setValue: setEditValue,
    formState: { errors: editErrors },
  } = useForm<UpdateOdooAccountInput>({
    resolver: zodResolver(UpdateOdooAccountSchema),
  });

  const onCreateConfig = async (data: CreateOdooAccountInput) => {
    try {
      await api.post('/odoo-accounts', data);
      toast.success('Konfigurasi Odoo berhasil ditambahkan.');
      setIsCreateOpen(false);
      resetCreate();
      mutate('/odoo-accounts');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal menyimpan konfigurasi.');
    }
  };

  const onEditConfig = async (data: UpdateOdooAccountInput) => {
    try {
      // Clean password: if empty string, send undefined/null to not update it
      const payload = {
        ...data,
        password: data.password || null,
      };
      await api.put(`/odoo-accounts/${editingConfig.uuid}`, payload);
      toast.success('Konfigurasi Odoo berhasil diperbarui.');
      setIsEditOpen(false);
      mutate('/odoo-accounts');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal memperbarui konfigurasi.');
    }
  };

  const handleOpenEdit = (config: any) => {
    setEditingConfig(config);
    setEditValue('warehouseId', config.warehouseId);
    setEditValue('baseUrl', config.baseUrl);
    setEditValue('username', config.username);
    setEditValue('password', '');
    setEditValue('isActive', config.isActive);
    setIsEditOpen(true);
  };

  const handleDelete = async (config: any) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus konfigurasi Odoo untuk gudang ${config.warehouse.name}?`)) {
      return;
    }

    try {
      await api.delete(`/odoo-accounts/${config.uuid}`);
      toast.success('Konfigurasi Odoo berhasil dihapus.');
      mutate('/odoo-accounts');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal menghapus konfigurasi.');
    }
  };

  const toggleStatus = async (config: any) => {
    const action = config.isActive ? 'deactivate' : 'activate';
    try {
      await api.post(`/odoo-accounts/${config.uuid}/${action}`);
      toast.success(`Konfigurasi Odoo berhasil ${config.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`);
      mutate('/odoo-accounts');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal merubah status aktif.');
    }
  };

  const testConnection = async (uuid: string) => {
    setTestingUuid(uuid);
    try {
      const response = await api.post(`/odoo-accounts/${uuid}/test-connection`);
      if (response.data?.success) {
        toast.success('Koneksi Odoo Berhasil! Session ID telah diperbarui.');
      } else {
        toast.error('Koneksi Gagal.');
      }
      mutate('/odoo-accounts');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Koneksi Odoo Gagal.');
    } finally {
      setTestingUuid(null);
    }
  };

  const testConnectionRaw = async () => {
    const vals = getCreateValues();
    if (!vals.baseUrl || !vals.username || !vals.password) {
      toast.warning('Isi URL, Username, dan Password terlebih dahulu untuk menguji koneksi.');
      return;
    }
    setTestingRaw(true);
    try {
      const response = await api.post('/odoo-accounts/test-connection-raw', {
        baseUrl: vals.baseUrl,
        username: vals.username,
        password: vals.password,
      });
      if (response.data?.success) {
        toast.success('Koneksi Odoo Valid! Kredensial Anda benar.');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Uji koneksi kredensial gagal.');
    } finally {
      setTestingRaw(false);
    }
  };

  const manualRefresh = async (uuid: string) => {
    setRefreshingUuid(uuid);
    try {
      await api.post(`/odoo-accounts/${uuid}/refresh`);
      toast.success('Sesi Odoo berhasil disegarkan secara manual.');
      mutate('/odoo-accounts');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal menyegarkan sesi Odoo.');
    } finally {
      setRefreshingUuid(null);
    }
  };

  const getSessionStatusBadge = (config: any) => {
    if (!config.isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          Nonaktif
        </span>
      );
    }

    if (!config.sessionId) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
          Belum Login
        </span>
      );
    }

    const isExpired = config.sessionExpiredAt && new Date(config.sessionExpiredAt) <= new Date();
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

  // Filtered list
  const filteredConfigs = configs?.filter((config: any) => {
    const q = search.toLowerCase();
    return (
      config.warehouse.name.toLowerCase().includes(q) ||
      config.username.toLowerCase().includes(q) ||
      config.baseUrl.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center">
            <Settings className="h-8 w-8 text-blue-600 mr-3" />
            Integrasi ERP Odoo
          </h1>
          <p className="text-slate-500 mt-1">
            Konfigurasi dan kelola kredensial akun Odoo ERP yang terhubung ke masing-masing Gudang Bulog.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] transition"
        >
          <Warehouse className="h-5 w-5 mr-2" />
          Tambah Akun Odoo
        </button>
      </div>

      {/* Info Alert Box */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-xl text-sm text-blue-800 leading-relaxed shadow-sm">
        💡 <strong>Info Sistem</strong>: Sesi Odoo otomatis dijaga agar tetap aktif. Sistem menjalankan background cron scheduler harian untuk menyegarkan token sebelum kedaluwarsa (Odoo Session Max-Age 7 Hari).
      </div>

      {/* Search Input */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cari Akun Odoo</label>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama gudang, username, URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-850 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Gudang WMS</th>
                <th className="px-6 py-4">Odoo ERP URL & Akun</th>
                <th className="px-6 py-4">Status Sesi</th>
                <th className="px-6 py-4">Refresh Terakhir</th>
                <th className="px-6 py-4">Kedaluwarsa Sesi</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {configsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-5">
                      <div className="h-4 bg-slate-200 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredConfigs?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                    Tidak ada konfigurasi akun Odoo ERP yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredConfigs?.map((config: any) => (
                  <tr key={config.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">
                      <span className="flex items-center font-bold text-slate-800">
                        <Warehouse className="h-4 w-4 mr-2 text-blue-500 shrink-0" />
                        {config.warehouse.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-slate-700 font-medium">
                        <Globe className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" />
                        {config.baseUrl}
                      </div>
                      <div className="flex items-center text-xs text-slate-500 mt-1">
                        <User className="h-3 w-3 mr-1 text-slate-400 shrink-0" />
                        Username: {config.username}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getSessionStatusBadge(config)}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {config.lastRefreshAt 
                        ? new Date(config.lastRefreshAt).toLocaleString('id-ID')
                        : '-'
                      }
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {config.sessionExpiredAt 
                        ? new Date(config.sessionExpiredAt).toLocaleString('id-ID')
                        : '-'
                      }
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {config.isActive && (
                          <>
                            <button
                              onClick={() => testConnection(config.uuid)}
                              disabled={testingUuid !== null}
                              title="Uji Koneksi ERP"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-40"
                            >
                              <Activity className={`h-4 w-4 ${testingUuid === config.uuid ? 'animate-pulse' : ''}`} />
                            </button>
                            <button
                              onClick={() => manualRefresh(config.uuid)}
                              disabled={refreshingUuid !== null}
                              title="Segarkan Sesi Manual"
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition disabled:opacity-40"
                            >
                              <RefreshCw className={`h-4 w-4 ${refreshingUuid === config.uuid ? 'animate-spin' : ''}`} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleOpenEdit(config)}
                          title="Edit Akun"
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleStatus(config)}
                          title={config.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          className={`p-2 rounded-lg transition ${
                            config.isActive
                              ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                              : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(config)}
                          title="Hapus Konfigurasi"
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- CREATE CONFIG MODAL --- */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Tambah Konfigurasi Akun Odoo</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition text-lg"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateSubmit(onCreateConfig)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Gudang WMS</label>
                <select
                  {...registerCreate('warehouseId', { valueAsNumber: true })}
                  className="w-full border border-slate-200 bg-white text-slate-805 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Pilih Gudang</option>
                  {warehouses?.map((wh: any) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
                {createErrors.warehouseId && (
                  <p className="text-xs text-red-500 mt-1">{createErrors.warehouseId.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Odoo Base URL</label>
                <input
                  type="text"
                  placeholder="https://beras.bulog.co.id"
                  {...registerCreate('baseUrl')}
                  className="w-full border border-slate-200 text-slate-805 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                {createErrors.baseUrl && (
                  <p className="text-xs text-red-500 mt-1">{createErrors.baseUrl.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Username Odoo</label>
                  <input
                    type="text"
                    placeholder="Masukkan username"
                    {...registerCreate('username')}
                    className="w-full border border-slate-200 text-slate-805 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                  {createErrors.username && (
                    <p className="text-xs text-red-500 mt-1">{createErrors.username.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Password Odoo</label>
                  <input
                    type="password"
                    placeholder="Masukkan password"
                    {...registerCreate('password')}
                    className="w-full border border-slate-200 text-slate-805 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                  {createErrors.password && (
                    <p className="text-xs text-red-500 mt-1">{createErrors.password.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={testConnectionRaw}
                  disabled={testingRaw}
                  className="px-4 py-2 border border-blue-200 hover:bg-blue-50 text-blue-600 rounded-lg text-sm font-bold transition flex items-center"
                >
                  {testingRaw && (
                    <svg className="animate-spin h-4 w-4 mr-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  Uji Kredensial
                </button>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg text-sm transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg hover:shadow-blue-500/10 transition"
                  >
                    Simpan Akun
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT CONFIG MODAL --- */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Edit Konfigurasi Akun Odoo</h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-650 p-1.5 rounded-lg hover:bg-slate-50 transition text-lg"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleEditSubmit(onEditConfig)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Gudang WMS</label>
                <select
                  {...registerEdit('warehouseId', { valueAsNumber: true })}
                  className="w-full border border-slate-200 bg-white text-slate-805 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  {warehouses?.map((wh: any) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
                {editErrors.warehouseId && (
                  <p className="text-xs text-red-500 mt-1">{editErrors.warehouseId.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Odoo Base URL</label>
                <input
                  type="text"
                  placeholder="https://beras.bulog.co.id"
                  {...registerEdit('baseUrl')}
                  className="w-full border border-slate-200 text-slate-805 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                {editErrors.baseUrl && (
                  <p className="text-xs text-red-500 mt-1">{editErrors.baseUrl.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Username Odoo</label>
                  <input
                    type="text"
                    placeholder="Masukkan username"
                    {...registerEdit('username')}
                    className="w-full border border-slate-200 text-slate-805 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                  {editErrors.username && (
                    <p className="text-xs text-red-500 mt-1">{editErrors.username.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Password Odoo</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">(Kosongkan jika tetap)</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Masukkan password baru"
                    {...registerEdit('password')}
                    className="w-full border border-slate-200 text-slate-805 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                  {editErrors.password && (
                    <p className="text-xs text-red-500 mt-1">{editErrors.password.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg text-sm transition"
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

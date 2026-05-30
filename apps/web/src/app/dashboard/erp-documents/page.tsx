'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useErpDocuments, useErpSyncStatus } from '@/hooks/useErpDocuments';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Layers,
  Settings2,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';

export default function ErpDocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const { activeWarehouse, user, hasPermission } = useAuthStore();

  // 1. Read URL query parameters for filters
  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 10;
  const search = searchParams.get('search') || '';
  const type = (searchParams.get('type') || '') as 'IN' | 'OUT' | '';
  const state = searchParams.get('state') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';

  // Local state for search input (to debounce)
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 400);

  const [isSyncing, setIsSyncing] = useState(false);

  // Sync debounced search to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  }, [debouncedSearch]);

  // Sync initial URL search param to searchInput
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const { syncStatus, refreshStatus } = useErpSyncStatus();
  const [lastHandledStatus, setLastHandledStatus] = useState<string | null>(null);

  // Fetch ERP documents using SWR hook
  const { documentsData, isLoading, refresh, syncErpDocuments, forceSyncErpDocument } = useErpDocuments({
    search: search || undefined,
    page,
    limit,
    type: type || undefined,
    state: state || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const isSyncActive = isSyncing || syncStatus?.status === 'RUNNING' || syncStatus?.status === 'PENDING';

  useEffect(() => {
    if (!syncStatus) return;

    const currentStatus = syncStatus.status;
    if (lastHandledStatus === 'RUNNING' || lastHandledStatus === 'PENDING') {
      if (currentStatus === 'SUCCESS') {
        toast.success('Sinkronisasi dokumen ERP dari Odoo selesai!');
        refresh(); // Refresh list of documents
      } else if (currentStatus === 'FAILED') {
        toast.error('Gagal mensinkronisasi dokumen ERP dari Odoo.');
      }
    }
    setLastHandledStatus(currentStatus);
  }, [syncStatus?.status, syncStatus?.processedDocuments]);

  const handleSync = async () => {
    if (!activeWarehouse) {
      toast.error('Silakan pilih gudang aktif terlebih dahulu.');
      return;
    }

    setIsSyncing(true);
    const toastId = toast.loading('Memulai sinkronisasi dokumen ERP dari Odoo...');
    try {
      const res = await syncErpDocuments();
      if (res.message === 'Sync already in progress') {
        toast.info('Sinkronisasi dokumen ERP sedang berjalan.', { id: toastId });
      } else {
        toast.success('Proses sinkronisasi telah dimulai di latar belakang.', { id: toastId });
      }
      refreshStatus();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Gagal memulai sinkronisasi dari Odoo.';
      toast.error(msg, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const updateQueryParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1'); // reset page to 1
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  };

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Belum pernah sync';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit yang lalu`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hari yang lalu`;
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'done':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-455';
      case 'assigned':
        return 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-455';
      case 'confirmed':
        return 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-455';
      case 'waiting':
        return 'bg-amber-50 border-amber-205 text-amber-750 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-455';
      case 'cancel':
        return 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-455';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400';
    }
  };

  const getStatusText = (state: string) => {
    switch (state) {
      case 'done': return 'Done';
      case 'assigned': return 'Ready / Assigned';
      case 'confirmed': return 'Confirmed';
      case 'waiting': return 'Waiting Another';
      case 'cancel': return 'Canceled';
      case 'draft': return 'Draft';
      default: return state;
    }
  };

  // Summaries default values
  const summary = documentsData?.summary || {
    totalDocuments: 0,
    totalIncoming: 0,
    totalOutgoing: 0,
    lastSyncTime: null,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
            <FileText className="h-8 w-8 text-blue-600 mr-3" />
            Dokumen ERP (PO/SO)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Snapshot dokumen purchase order (PO) & sales order (SO) dari Odoo untuk gudang:{' '}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {activeWarehouse?.name || 'Belum Dipilih'}
            </span>
          </p>
        </div>
        {hasPermission('update', 'Inventory') && (
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSync}
              disabled={isSyncActive}
              className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] transition cursor-pointer text-sm min-h-[44px]"
            >
              {isSyncActive ? (
                <span className="flex flex-col items-start leading-tight text-left">
                  <span className="text-xs font-semibold flex items-center">
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Syncing...
                  </span>
                  <span className="text-[10px] font-medium opacity-80 pl-5">
                    {syncStatus?.processedDocuments || 0} / {syncStatus?.totalDocuments || 0} documents
                  </span>
                </span>
              ) : (
                <span className="flex items-center">
                  <RefreshCw className="h-4.5 w-4.5 mr-2" />
                  Sync ERP Documents
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Sync Status Header Info */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700 shadow-xs">
            <Clock className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pembaruan Terakhir</div>
            <div className="text-sm font-semibold text-slate-805 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
              <span
                title={syncStatus?.lastSyncAt || summary.lastSyncTime ? new Date(syncStatus?.lastSyncAt || summary.lastSyncTime!).toLocaleString('id-ID') : 'Tidak tersedia'}
                className="cursor-help border-b border-dashed border-slate-350"
              >
                {formatRelativeTime(syncStatus?.lastSyncAt || summary.lastSyncTime)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center">
          {syncStatus?.status === 'RUNNING' || syncStatus?.status === 'PENDING' ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 border border-blue-105 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400">
              <Clock className="h-4 w-4 mr-1.5 text-blue-500 animate-spin" />
              Proses Sinkronisasi Sedang Berjalan...
            </span>
          ) : syncStatus?.lastSyncAt || summary.lastSyncTime ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50/70 border border-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-500" />
              Sinkron Terkoneksi
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
              Belum Ada Data Lokal
            </span>
          )}
        </div>
      </div>

      {/* Summary Statistics Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Documents */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600 border border-blue-100/40 dark:border-blue-900/30">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Dokumen</span>
            <strong className="text-2xl font-black text-slate-800 dark:text-slate-105">{summary.totalDocuments.toLocaleString('id-ID')}</strong>
          </div>
        </div>

        {/* Incoming PO */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 border border-emerald-100/40 dark:border-emerald-900/30">
            <ArrowDownLeft className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dokumen Masuk (PO)</span>
            <strong className="text-2xl font-black text-slate-800 dark:text-slate-105">{summary.totalIncoming.toLocaleString('id-ID')}</strong>
          </div>
        </div>

        {/* Outgoing SO */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl text-purple-600 border border-purple-100/40 dark:border-purple-900/30">
            <ArrowUpRight className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dokumen Keluar (SO)</span>
            <strong className="text-2xl font-black text-slate-800 dark:text-slate-105">{summary.totalOutgoing.toLocaleString('id-ID')}</strong>
          </div>
        </div>
      </div>

      {/* Filter and Queries Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center text-sm font-bold text-slate-700 dark:text-slate-350 border-b border-slate-100 dark:border-slate-800 pb-2">
          <Settings2 className="h-4.5 w-4.5 mr-2 text-blue-500" />
          Filter & Pencarian Dokumen
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Input */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Cari Nomor Dokumen
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Contoh: WH/IN/0001..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 transition"
              />
            </div>
          </div>

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Tipe Dokumen
            </label>
            <select
              value={type}
              onChange={(e) => updateQueryParam('type', e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-805 dark:text-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 cursor-pointer"
            >
              <option value="">SEMUA TIPE</option>
              <option value="IN">INCOMING (PO)</option>
              <option value="OUT">OUTGOING (SO)</option>
            </select>
          </div>

          {/* State Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Status Dokumen
            </label>
            <select
              value={state}
              onChange={(e) => updateQueryParam('state', e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-805 dark:text-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 cursor-pointer"
            >
              <option value="">SEMUA STATUS</option>
              <option value="draft">DRAFT</option>
              <option value="waiting">WAITING</option>
              <option value="confirmed">CONFIRMED</option>
              <option value="assigned">READY / ASSIGNED</option>
              <option value="done">DONE / COMPLETED</option>
              <option value="cancel">CANCELED</option>
            </select>
          </div>
        </div>

        {/* Row 2 Filters: Date Range & Page Limit */}
        <div className="flex flex-col md:flex-row gap-4 items-end pt-2">
          {/* Start Date */}
          <div className="w-full md:w-auto flex-1">
            <label className="block text-xs font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Tanggal Awal
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-405 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => updateQueryParam('startDate', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-505 focus:bg-white cursor-pointer"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="w-full md:w-auto flex-1">
            <label className="block text-xs font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Tanggal Akhir
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-405 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => updateQueryParam('endDate', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-505 focus:bg-white cursor-pointer"
              />
            </div>
          </div>

          {/* Limits */}
          <div className="w-full md:w-36">
            <label className="block text-xs font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Baris
            </label>
            <select
              value={limit}
              onChange={(e) => updateQueryParam('limit', e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* ERP Documents Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full text-left border-collapse table-layout-fixed min-w-[1000px]">
            <thead className="bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4 w-[16%]">No. Dokumen</th>
                <th className="px-6 py-4 text-center w-[10%]">Tipe</th>
                <th className="px-6 py-4 text-center w-[12%]">Status</th>
                <th className="px-6 py-4 w-[18%]">Mitra / Partner</th>
                <th className="px-6 py-4 w-[14%]">Ref PO/SO</th>
                <th className="px-6 py-4 text-right w-[10%]">Total Qty</th>
                <th className="px-6 py-4 text-center w-[10%]">Tgl Jadwal</th>
                <th className="px-6 py-4 text-center w-[10%]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {isLoading ? (
                Array.from({ length: limit }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28"></div></td>
                    <td className="px-6 py-4 text-center"><div className="h-4.5 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div></td>
                    <td className="px-6 py-4 text-center"><div className="h-4.5 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12 ml-auto"></div></td>
                    <td className="px-6 py-4 text-center"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto"></div></td>
                    <td className="px-6 py-4 text-center"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12 mx-auto"></div></td>
                  </tr>
                ))
              ) : !documentsData?.data || documentsData.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-slate-400 dark:text-slate-500 font-semibold">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <FolderOpen className="h-12 w-12 text-slate-300 dark:text-slate-700" />
                      <span>Tidak ada data dokumen ERP ditemukan. Silakan klik "Sync ERP Documents".</span>
                    </div>
                  </td>
                </tr>
              ) : (
                documentsData.data.map((doc: any) => (
                  <ErpDocumentRow
                    key={doc.id}
                    doc={doc}
                    getStatusColor={getStatusColor}
                    getStatusText={getStatusText}
                    onForceSync={forceSyncErpDocument}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {documentsData?.meta && (
          <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Menampilkan {documentsData.data.length} dari {documentsData.meta.total} dokumen ERP
            </span>

            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                className="p-1.5 border border-slate-205 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4 text-slate-605" />
              </button>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350">
                {page} / {documentsData.meta.totalPages || 1}
              </span>
              <button
                disabled={page >= documentsData.meta.totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="p-1.5 border border-slate-205 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4 text-slate-605" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ErpDocumentRowProps {
  doc: any;
  getStatusColor: (state: string) => string;
  getStatusText: (state: string) => string;
  onForceSync: (uuid: string) => Promise<any>;
}

function ErpDocumentRow({ doc, getStatusColor, getStatusText, onForceSync }: ErpDocumentRowProps) {
  const { user } = useAuthStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleForceSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSyncing(true);
    const toastId = toast.loading(`Mensinkronkan paksa dokumen ${doc.documentNumber}...`);
    try {
      await onForceSync(doc.uuid);
      toast.success(`Berhasil sinkronisasi dokumen ${doc.documentNumber}!`, { id: toastId });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Gagal sinkronisasi paksa dokumen.';
      toast.error(msg, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const formattedDate = doc.scheduledDate
    ? new Date(doc.scheduledDate).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '-';

  return (
    <>
      <tr
        onClick={() => setIsExpanded(!isExpanded)}
        className={`hover:bg-slate-50/70 dark:hover:bg-slate-850/50 border-b border-slate-100 dark:border-slate-800 transition cursor-pointer select-none ${
          isExpanded ? 'bg-slate-50/30 dark:bg-slate-900/60' : ''
        }`}
      >
        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
          <div className="flex items-center space-x-2">
            <div className="p-0.5 rounded hover:bg-slate-200/80 dark:hover:bg-slate-750 transition">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-550 shrink-0" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 text-slate-550 shrink-0" />
              )}
            </div>
            <span className="font-mono select-all truncate">{doc.documentNumber}</span>
          </div>
        </td>
        <td className="px-6 py-4 text-center">
          {doc.pickingTypeCode === 'incoming' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-[10px] uppercase">
              IN (PO)
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-50 border border-purple-100 text-purple-700 font-bold text-[10px] uppercase">
              OUT (SO)
            </span>
          )}
        </td>
        <td className="px-6 py-4 text-center">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded border text-[10px] font-bold ${getStatusColor(doc.state)}`}>
            {getStatusText(doc.state)}
          </span>
        </td>
        <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={doc.partnerName || ''}>
          {doc.partnerName || '-'}
        </td>
        <td className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 truncate font-mono">
          {doc.purchaseName || doc.origin || '-'}
        </td>
        <td className="px-6 py-4 text-right font-bold text-slate-800 dark:text-slate-200">
          {doc.totalQuantity.toLocaleString('id-ID')}
          <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 ml-1">
            ({doc.totalItems} item)
          </span>
        </td>
        <td className="px-6 py-4 text-center font-medium text-slate-605 dark:text-slate-400">
          {formattedDate}
        </td>
        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center space-x-2">
            <Link
              href={`/dashboard/erp-documents/${doc.uuid}`}
              className="inline-flex items-center px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg border border-slate-200 dark:border-slate-700 transition"
            >
              Detail
            </Link>
            {user?.role === 'SUPER_ADMIN' && (
              <button
                onClick={handleForceSync}
                disabled={isSyncing}
                className="inline-flex items-center justify-center p-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-105 hover:border-blue-300 text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition shadow-sm cursor-pointer"
                title="Force Sync dari Odoo"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded Row showing line items list */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="bg-slate-50/40 dark:bg-slate-900/30 px-10 py-5 border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                <span>Rincian Barang Muatan ({doc.documentNumber})</span>
              </div>

              {!doc.items || doc.items.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-2">
                  Tidak ada barang muatan yang tercatat di dalam dokumen ini.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        <th className="px-5 py-3 w-[45%]">Nama Produk</th>
                        <th className="px-5 py-3 w-[20%]">Analytic Account</th>
                        <th className="px-5 py-3 text-right w-[11%]">Qty</th>
                        <th className="px-5 py-3 text-right w-[12%]">Product Qty</th>
                        <th className="px-5 py-3 text-center w-[12%]">UOM</th>
                        <th className="px-5 py-3 text-right w-[12%]">Qty Sekunder</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                      {doc.items.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition">
                          <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200">
                            {item.productName}
                          </td>
                          <td className="px-5 py-3 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                            {item.analyticAccountName || '-'}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                            {item.quantity.toLocaleString('id-ID')}
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-slate-500 dark:text-slate-400">
                            {item.productQty.toLocaleString('id-ID')}
                          </td>
                          <td className="px-5 py-3 text-center font-bold text-blue-600 dark:text-blue-400 uppercase">
                            {item.uom}
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-slate-600 dark:text-slate-400">
                            {item.secondaryQuantity !== null && item.secondaryQuantity !== undefined ? (
                              <>
                                {item.secondaryQuantity.toLocaleString('id-ID')}
                                <span className="text-[10px] text-slate-400 ml-1 font-normal uppercase">
                                  {item.secondaryUom || 'Unit'}
                                </span>
                              </>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

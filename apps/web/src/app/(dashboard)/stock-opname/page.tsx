'use client';

import React, { useState } from 'react';
import { useStockOpname } from '@/hooks/useStockOpname';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  Clipboard,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  FileText,
  Download,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';


export default function StockOpnameListPage() {
  const router = useRouter();
  const { activeWarehouse } = useAuthStore();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [isCreating, setIsCreating] = useState(false);

  const { stockOpnameData, isLoading, refresh, createStockOpname } = useStockOpname({
    search,
    status,
    startDate,
    endDate,
    page,
    limit,
  });

  const handleCreate = async () => {
    if (!activeWarehouse) {
      toast.error('Silakan pilih gudang aktif terlebih dahulu.');
      return;
    }

    setIsCreating(true);
    const toastId = toast.loading('Membuat sesi Stock Opname baru & mengambil snapshot stok...');
    try {
      const res = await createStockOpname('Sesi Opname ' + activeWarehouse.name);
      toast.success('Sesi Stock Opname berhasil dibuat!', { id: toastId });
      router.push(`/stock-opname/${res.uuid}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Gagal membuat Stock Opname.', { id: toastId });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Clipboard className="h-8 w-8 text-blue-600 shrink-0" />
            Stock Opname
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Kelola dan catat audit perhitungan stok fisik gudang untuk gudang:{' '}
            <span className="font-semibold text-blue-600">
              {activeWarehouse?.name || 'Belum Dipilih'}
            </span>
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] transition cursor-pointer text-sm shrink-0"
        >
          <Plus className="h-4.5 w-4.5 mr-2" />
          Mulai Opname Baru
        </button>
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-700 dark:text-slate-350">
          <Filter className="h-4.5 w-4.5 text-slate-550" />
          <span>Filter Pencarian</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search by Number */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No. Opname..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* Status */}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="DRAFT">Draf (Draft)</option>
            <option value="COMPLETED">Selesai (Completed)</option>
          </select>

          {/* Start Date */}
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              placeholder="Mulai Tanggal"
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              placeholder="Hingga Tanggal"
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* List Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-layout-fixed">
            <thead className="bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4 w-[20%] font-mono">No. Opname</th>
                <th className="px-6 py-4 w-[15%]">Gudang</th>
                <th className="px-6 py-4 w-[18%]">Tanggal Dibuat</th>
                <th className="px-6 py-4 w-[12%] text-center">Produk</th>
                <th className="px-6 py-4 w-[13%] text-right font-semibold text-amber-700 dark:text-amber-400">Selisih Var</th>
                <th className="px-6 py-4 w-[10%] text-center">Status</th>
                <th className="px-6 py-4 w-[12%] text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {isLoading ? (
                Array.from({ length: limit }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-24"></div></td>
                    <td className="px-6 py-4 text-center"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-8 mx-auto"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-12 ml-auto"></div></td>
                    <td className="px-6 py-4 text-center"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-12 mx-auto"></div></td>
                    <td className="px-6 py-4 text-center"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-16 mx-auto"></div></td>
                  </tr>
                ))
              ) : !stockOpnameData || stockOpnameData.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400 font-medium">
                    Tidak ada sesi Stock Opname ditemukan. Silakan klik tombol Mulai Opname Baru.
                  </td>
                </tr>
              ) : (
                stockOpnameData.items.map((op: any) => (
                  <tr key={op.uuid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800/80 transition text-slate-700 dark:text-slate-350">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-slate-200">
                      {op.opnameNumber}
                    </td>
                    <td className="px-6 py-4 truncate">
                      {activeWarehouse?.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      <div>{new Date(op.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Oleh: {op.createdBy}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700">
                        {op.totalProducts} item
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-extrabold ${
                      op.totalVariance < 0
                        ? 'text-red-600 dark:text-red-400'
                        : op.totalVariance > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}>
                      {op.status === 'COMPLETED' ? (
                        <span>{op.totalVariance > 0 ? `+${op.totalVariance}` : op.totalVariance}</span>
                      ) : (
                        <span className="text-slate-400 font-normal italic text-xs">Counting...</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {op.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-900/30">
                          Selesai
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-150 dark:border-amber-900/30">
                          Draf Counting
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {op.status === 'DRAFT' ? (
                          <button
                            onClick={() => router.push(`/stock-opname/${op.uuid}`)}
                            title="Lanjutkan Isi Counting"
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 rounded-lg transition cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => router.push(`/stock-opname/${op.uuid}`)}
                            title="Tinjau Detail"
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
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

        {/* Pagination footer */}
        {stockOpnameData?.totalPages > 1 && (
          <div className="bg-slate-50 dark:bg-slate-850/80 px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500 font-semibold text-center sm:text-left">
              Menampilkan {stockOpnameData.items.length} dari {stockOpnameData.total} data opname
            </span>

            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <span className="text-sm font-bold text-slate-700">
                {page} / {stockOpnameData.totalPages}
              </span>
              <button
                disabled={page >= stockOpnameData.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useInventory, useInventoryDetail, useInventorySyncStatus } from '@/hooks/useInventory';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
  Tag,
  Layers,
  Box,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCheck,
} from 'lucide-react';

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [isSyncing, setIsSyncing] = useState(false);

  const { activeWarehouse } = useAuthStore();
  
  // Custom hook for paginated stock data and PDF generation
  const { inventoryData, isLoading, refresh, syncInventory, exportPdf } = useInventory({
    search: debouncedSearch,
    page,
    limit,
  });

  // Sync status hook
  const { statusData, refreshStatus } = useInventorySyncStatus();

  const handleSync = async () => {
    if (!activeWarehouse) {
      toast.error('Silakan pilih gudang aktif terlebih dahulu.');
      return;
    }

    setIsSyncing(true);
    const toastId = toast.loading('Mensinkronisasi data persediaan dari ERP Odoo...');
    try {
      const res = await syncInventory();
      toast.success(`Sinkronisasi sukses! Berhasil sinkron ${res.syncedCount} baris stok.`, { id: toastId });
      refresh();
      // Auto refresh the sync status after completion
      refreshStatus();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Gagal sinkronisasi data dari Odoo.';
      toast.error(msg, { id: toastId });
      refreshStatus();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportPdf = async () => {
    if (!activeWarehouse) {
      toast.error('Gudang aktif tidak terdeteksi.');
      return;
    }

    const toastId = toast.loading('Membuat berkas laporan PDF...');
    try {
      await exportPdf(debouncedSearch);
      toast.success('Laporan PDF berhasil diunduh.', { id: toastId });
    } catch (e: any) {
      toast.error('Gagal mengekspor laporan ke PDF.', { id: toastId });
    }
  };

  // Safe localized relative time formatting helper
  const getRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Belum pernah sinkron';
    const date = new Date(dateStr);
    const diffMs = new Date().getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit yang lalu`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Destructure summary from SWR data
  const summary = inventoryData?.summary || {
    totalProducts: 0,
    totalLocations: 0,
    totalQuantity: 0,
    totalReserved: 0,
    totalAvailable: 0,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Status Persediaan</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Data stok barang termutakhir yang disinkronisasi dari ERP Odoo untuk gudang:{' '}
            <span className="font-semibold text-blue-600">
              {activeWarehouse?.name || 'Belum Dipilih'}
            </span>
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportPdf}
            className="flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm"
          >
            <FileText className="h-4.5 w-4.5 mr-2 text-slate-500" />
            Cetak PDF
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] transition cursor-pointer text-sm"
          >
            <RefreshCw className={`h-4.5 w-4.5 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sinkronisasi...' : 'Sinkronisasi Odoo'}
          </button>
        </div>
      </div>

      {/* Last Sync Information & Status Header Card */}
      {statusData && (statusData.lastSyncAt || statusData.lastSyncStatus) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white rounded-lg border border-slate-200/60 shadow-xs">
              <Clock className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-450 uppercase tracking-wider">Sinkronisasi Terakhir</div>
              <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                {getRelativeTime(statusData.lastSyncAt)}
                {statusData.lastSyncBy && (
                  <span className="text-xs font-normal text-slate-500 flex items-center">
                    <UserCheck className="h-3.5 w-3.5 ml-1 mr-0.5 text-slate-400" />
                    oleh {statusData.lastSyncBy}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {statusData.lastSyncCount !== null && (
              <div className="text-right hidden md:block">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item Disinkronkan</div>
                <div className="text-xs font-bold text-slate-700 mt-0.5">{statusData.lastSyncCount} data quants</div>
              </div>
            )}

            <div className="flex items-center">
              {statusData.lastSyncStatus === 'SUCCESS' ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-500" />
                  Sync Sukses
                </span>
              ) : statusData.lastSyncStatus === 'FAILED' ? (
                <div className="relative group">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100 cursor-help">
                    <AlertTriangle className="h-4 w-4 mr-1.5 text-red-500" />
                    Sync Gagal
                  </span>
                  {statusData.lastSyncError && (
                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-72 bg-slate-900 text-white text-[11px] p-2.5 rounded-lg shadow-xl z-20 font-medium">
                      Detail error: {statusData.lastSyncError}
                      <div className="absolute top-full right-6 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                    </div>
                  )}
                </div>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                  Belum Pernah Sync
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards / Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Products */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600 border border-blue-100/40">
            <Layers className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jenis Produk</span>
            <strong className="text-lg font-black text-slate-800">{summary.totalProducts.toLocaleString('id-ID')}</strong>
          </div>
        </div>

        {/* Total Locations */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="p-2.5 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100/40">
            <MapPin className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Area Lokasi</span>
            <strong className="text-lg font-black text-slate-800">{summary.totalLocations.toLocaleString('id-ID')}</strong>
          </div>
        </div>

        {/* Total Quantity */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="p-2.5 bg-slate-50 rounded-lg text-slate-600 border border-slate-200/50">
            <Box className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kuantitas Stok</span>
            <strong className="text-lg font-black text-slate-800">{summary.totalQuantity.toLocaleString('id-ID')}</strong>
          </div>
        </div>

        {/* Total Reserved */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="p-2.5 bg-amber-50 rounded-lg text-amber-650 border border-amber-100/40">
            <Tag className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stok Dipesan</span>
            <strong className="text-lg font-black text-amber-600">{summary.totalReserved.toLocaleString('id-ID')}</strong>
          </div>
        </div>

        {/* Total Available */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center space-x-3.5 col-span-2 md:col-span-1">
          <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100/40">
            <CheckCircle2 className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stok Tersedia</span>
            <strong className="text-lg font-black text-emerald-600">{summary.totalAvailable.toLocaleString('id-ID')}</strong>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Cari SKU / Nama Produk
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari SKU atau nama produk..."
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
            Baris per Halaman
          </label>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer transition min-w-[80px]"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Inventory Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full text-left border-collapse table-layout-fixed">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200 z-10">
              <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4 w-[20%]">SKU</th>
                <th className="px-6 py-4 w-[35%]">Nama Produk</th>
                <th className="px-6 py-4 text-center w-[10%]">UOM</th>
                <th className="px-6 py-4 text-right w-[12%]">Total Quantity</th>
                <th className="px-6 py-4 text-right w-[13%]">Total Available</th>
                <th className="px-6 py-4 text-center w-[10%]">Total Locations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                Array.from({ length: limit }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 rounded w-48"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 rounded w-8 mx-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 rounded w-12 mx-auto"></div>
                    </td>
                  </tr>
                ))
              ) : inventoryData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Box className="h-10 w-10 text-slate-300" />
                      <span>Tidak ada data persediaan ditemukan. Silakan klik tombol Sinkronisasi Odoo.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                inventoryData?.data?.map((inv: any) => (
                  <ProductRow key={inv.id} product={inv} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {inventoryData?.meta && (
          <div className="bg-slate-50 px-4 sm:px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500 font-semibold text-center sm:text-left">
              Menampilkan {inventoryData.data.length} dari {inventoryData.meta.total} produk
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
                {page} / {inventoryData.meta.totalPages || 1}
              </span>
              <button
                disabled={page >= inventoryData.meta.totalPages}
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

/**
 * Product Row with expand functionality.
 */
interface ProductRowProps {
  product: {
    id: number;
    uuid: string;
    sku: string;
    name: string;
    uom: string;
    totalQuantity: number;
    totalAvailable: number;
    locationCount: number;
  };
}

function ProductRow({ product }: ProductRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <tr
        onClick={() => setIsExpanded(!isExpanded)}
        className={`hover:bg-slate-50/70 border-b border-slate-100 transition cursor-pointer select-none ${
          isExpanded ? 'bg-slate-50/40' : ''
        }`}
      >
        <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
          <div className="p-0.5 rounded-md hover:bg-slate-200/80 transition">
            {isExpanded ? (
              <ChevronDown className="h-4.5 w-4.5 text-slate-500 shrink-0" />
            ) : (
              <ChevronRight className="h-4.5 w-4.5 text-slate-500 shrink-0" />
            )}
          </div>
          <span className="select-all block truncate font-mono text-xs text-slate-900 dark:text-slate-100">{product.sku}</span>
        </td>
        <td className="px-6 py-4 font-bold text-slate-800">
          {product.name}
        </td>
        <td className="px-6 py-4 text-center">
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-xs border border-blue-100/50">
            {product.uom}
          </span>
        </td>
        <td className="px-6 py-4 text-right font-black text-slate-700">
          {product.totalQuantity.toLocaleString('id-ID')}
        </td>
        <td className="px-6 py-4 text-right font-black text-emerald-600 bg-emerald-50/5">
          {product.totalAvailable.toLocaleString('id-ID')}
        </td>
        <td className="px-6 py-4 text-center">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200/50">
            <MapPin className="h-3 w-3 mr-1 text-slate-400" />
            {product.locationCount}
          </span>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} className="bg-slate-50/50 px-8 py-5 border-b border-slate-200">
            <ProductDetailSection productUuid={product.uuid} />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Section that fetches and shows detail location/quants levels for expanded product.
 */
function ProductDetailSection({ productUuid }: { productUuid: string }) {
  const { detailData, isLoading, error } = useInventoryDetail(productUuid);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 space-x-2.5">
        <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-xs font-semibold text-slate-500">Memuat rincian lokasi dan tumpukan...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-500 font-bold py-4 bg-red-50 px-4 rounded-lg border border-red-150">
        Gagal memuat rincian: {error.response?.data?.message || error.message}
      </div>
    );
  }

  if (!detailData || detailData.locations.length === 0) {
    return (
      <div className="text-xs text-slate-400 font-semibold py-4 text-center">
        Tidak ada data lokasi atau tumpukan stok aktif untuk produk ini.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {detailData.locations.map((loc: any) => {
        let totalQty = 0;
        let totalReserved = 0;
        let totalAvailable = 0;

        for (const q of loc.quants) {
          totalQty += q.quantity;
          totalReserved += q.reservedQuantity;
          totalAvailable += q.availableQuantity;
        }

        return (
          <div key={loc.location_id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            {/* Location Level Header */}
            <div className="bg-slate-100/70 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 gap-2">
              <div className="flex items-center space-x-2">
                <MapPin className="h-4.5 w-4.5 text-blue-500 shrink-0" />
                <span className="font-bold text-slate-700 text-xs">{loc.location_display_name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-slate-500">
                <span>
                  Total Qty: <strong className="text-slate-800">{totalQty.toLocaleString('id-ID')}</strong>
                </span>
                <span>
                  Reserved: <strong className="text-amber-600">{totalReserved.toLocaleString('id-ID')}</strong>
                </span>
                <span>
                  Available: <strong className="text-emerald-600">{totalAvailable.toLocaleString('id-ID')}</strong>
                </span>
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100/40">
                  {loc.quants.length} Tumpukan
                </span>
              </div>
            </div>

            {/* Nested Quants Level Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/30 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-2.5">Lot / Batch</th>
                    <th className="px-5 py-2.5 text-right">Quantity</th>
                    <th className="px-5 py-2.5 text-right">Reserved Quantity</th>
                    <th className="px-5 py-2.5 text-right font-bold text-emerald-600 bg-emerald-50/5">Available Quantity</th>
                    <th className="px-5 py-2.5 text-right">Secondary Unit Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loc.quants.map((q: any) => (
                    <tr key={q.id} className="hover:bg-slate-50/20 transition bg-white">
                      <td className="px-5 py-3">
                        {/* ACCESSIBILITY & CONTRAST FIX FOR LOT BADGE */}
                        {q.lotName && q.lotName !== '-' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-xs">
                            <Tag className="h-3 w-3 mr-1 text-slate-500 dark:text-slate-400 shrink-0" />
                            {q.lotName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200 italic">
                            Tanpa Lot
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-700">
                        {q.quantity.toLocaleString('id-ID')} <span className="text-slate-400 font-normal text-[10px] ml-0.5">{detailData.product.uom}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-amber-600">
                        {q.reservedQuantity.toLocaleString('id-ID')} <span className="text-slate-400 font-normal text-[10px] ml-0.5">{detailData.product.uom}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-emerald-650 bg-emerald-50/5">
                        {q.availableQuantity.toLocaleString('id-ID')} <span className="text-slate-400 font-normal text-[10px] ml-0.5">{detailData.product.uom}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-600">
                        {q.secondaryUnitQty > 0 ? (
                          <span>
                            {q.secondaryUnitQty.toLocaleString('id-ID')}{' '}
                            <span className="text-slate-400 font-normal text-[10px] ml-0.5">L/KG</span>
                          </span>
                        ) : (
                          <span className="text-slate-350">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

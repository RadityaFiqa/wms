'use client';

import React, { useState, useEffect } from 'react';
import { useReports, useReportDetail } from '@/hooks/useReports';
import { useProducts } from '@/hooks/useInventory';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import {
  BarChart3,
  Calendar,
  FileText,
  Download,
  Search,
  Filter,
  ArrowRightLeft,
  X,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

export default function ReportsPage() {
  const { activeWarehouse } = useAuthStore();

  // Default date range: last 7 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const YYYY = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const DD = String(d.getDate()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const YYYY = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const DD = String(d.getDate()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD}`;
  });

  const [productId, setProductId] = useState('');
  const [category, setCategory] = useState('');
  const [selectedDrillDown, setSelectedDrillDown] = useState<{
    date: string;
    productUuid: string;
    productName: string;
    productSku: string;
    type: 'INCOMING' | 'OUTGOING';
  } | null>(null);

  // Fetch list of products for the dropdown filter
  const { products } = useProducts();

  const { reportData, isLoading, exportPdf, exportCsv } = useReports({
    startDate,
    endDate,
    productId,
    category,
  });

  const handleExportPdf = async () => {
    const toastId = toast.loading('Membuat laporan PDF...');
    try {
      await exportPdf();
      toast.success('Laporan PDF berhasil diunduh.', { id: toastId });
    } catch (e) {
      toast.error('Gagal mengekspor laporan PDF.', { id: toastId });
    }
  };

  const handleExportCsv = async () => {
    const toastId = toast.loading('Mengekspor berkas Excel...');
    try {
      await exportCsv();
      toast.success('Berkas Excel (.csv) berhasil diunduh.', { id: toastId });
    } catch (e) {
      toast.error('Gagal mengekspor berkas Excel.', { id: toastId });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-blue-600 shrink-0" />
            Laporan Mutasi Persediaan
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Pantau pergerakan saldo awal, stok masuk, keluar, dan saldo akhir harian produk untuk gudang:{' '}
            <span className="font-semibold text-blue-600">
              {activeWarehouse?.name || 'Belum Dipilih'}
            </span>
          </p>
        </div>
        
        {/* Export buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportCsv}
            disabled={isLoading || reportData.length === 0}
            className="flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm disabled:opacity-50"
          >
            <Download className="h-4.5 w-4.5 mr-2 text-slate-500" />
            Ekspor Excel
          </button>
          
          <button
            onClick={handleExportPdf}
            disabled={isLoading || reportData.length === 0}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/10 transition cursor-pointer text-sm disabled:opacity-50"
          >
            <FileText className="h-4.5 w-4.5 mr-2" />
            Unduh PDF
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-700 dark:text-slate-350">
          <Filter className="h-4.5 w-4.5 text-slate-500" />
          <span>Atur Kriteria Laporan</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Start Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hingga Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* Product selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filter Produk</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
            >
              <option value="">Semua Produk</option>
              {products.map((p: any) => (
                <option key={p.uuid} value={p.uuid}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kategori</label>
            <input
              type="text"
              placeholder="Ketik Kategori (misal: Beras)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-layout-fixed">
            <thead className="bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4 w-[15%]">Tanggal</th>
                <th className="px-6 py-4 w-[35%]">Produk</th>
                <th className="px-6 py-4 text-right w-[12%]">Opening Stock</th>
                <th className="px-6 py-4 text-right w-[13%]">Incoming (Masuk)</th>
                <th className="px-6 py-4 text-right w-[13%]">Outgoing (Keluar)</th>
                <th className="px-6 py-4 text-right w-[12%]">Closing Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-48"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-12 ml-auto"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-12 ml-auto"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-12 ml-auto"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-12 ml-auto"></div></td>
                  </tr>
                ))
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-medium">
                    Tidak ada data mutasi persediaan untuk periode dan kriteria ini.
                  </td>
                </tr>
              ) : (
                reportData.map((row: any, idx: number) => {
                  const hasIncoming = row.incoming > 0;
                  const hasOutgoing = row.outgoing > 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800/80 transition text-slate-700 dark:text-slate-350">
                      <td className="px-6 py-4 text-slate-500 font-medium text-xs">
                        {new Date(row.date).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-200">
                        <div>{row.product.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{row.product.sku} | Kategori: {row.product.category}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-650 dark:text-slate-400">
                        {row.openingStock.toLocaleString('id-ID')} <span className="text-slate-400 text-xs font-normal ml-0.5">{row.product.uom}</span>
                      </td>
                      <td
                        onClick={() => {
                          if (hasIncoming) {
                            setSelectedDrillDown({
                              date: row.date,
                              productUuid: row.product.uuid,
                              productName: row.product.name,
                              productSku: row.product.sku,
                              type: 'INCOMING',
                            });
                          }
                        }}
                        className={`px-6 py-4 text-right font-extrabold ${
                          hasIncoming
                            ? 'text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer'
                            : 'text-slate-400 dark:text-slate-600'
                        }`}
                      >
                        {hasIncoming ? (
                          <span className="flex items-center justify-end gap-1.5">
                            +{row.incoming.toLocaleString('id-ID')}
                            <TrendingUp className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td
                        onClick={() => {
                          if (hasOutgoing) {
                            setSelectedDrillDown({
                              date: row.date,
                              productUuid: row.product.uuid,
                              productName: row.product.name,
                              productSku: row.product.sku,
                              type: 'OUTGOING',
                            });
                          }
                        }}
                        className={`px-6 py-4 text-right font-extrabold ${
                          hasOutgoing
                            ? 'text-red-600 dark:text-red-400 hover:underline cursor-pointer'
                            : 'text-slate-400 dark:text-slate-600'
                        }`}
                      >
                        {hasOutgoing ? (
                          <span className="flex items-center justify-end gap-1.5">
                            -{row.outgoing.toLocaleString('id-ID')}
                            <TrendingDown className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-800 dark:text-slate-200">
                        {row.closingStock.toLocaleString('id-ID')} <span className="text-slate-400 text-xs font-normal ml-0.5">{row.product.uom}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill Down Modal */}
      {selectedDrillDown && (
        <DrillDownModal
          drill={selectedDrillDown}
          onClose={() => setSelectedDrillDown(null)}
        />
      )}
    </div>
  );
}

interface DrillDownModalProps {
  drill: {
    date: string;
    productUuid: string;
    productName: string;
    productSku: string;
    type: 'INCOMING' | 'OUTGOING';
  };
  onClose: () => void;
}

function DrillDownModal({ drill, onClose }: DrillDownModalProps) {
  const { detailData, isLoading, error } = useReportDetail(drill.date, drill.productUuid);

  const transactions = detailData ? (drill.type === 'INCOMING' ? detailData.incoming : detailData.outgoing) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl relative animate-scale-up space-y-6">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-slate-500"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Detail Mutasi {drill.type === 'INCOMING' ? 'Stok Masuk' : 'Stok Keluar'}
          </span>
          <h2 className="text-lg md:text-xl font-black text-slate-850 dark:text-slate-200 mt-2 leading-snug">
            {drill.productName}
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            SKU: {drill.productSku}  |  Tanggal: {new Date(drill.date).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* List Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <svg className="animate-spin h-7 w-7 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-xs font-semibold text-slate-500">Memuat mutasi pendukung...</span>
          </div>
        ) : error ? (
          <div className="text-red-500 text-xs font-bold py-4 text-center">Gagal memuat rincian transaksi.</div>
        ) : transactions.length === 0 ? (
          <div className="text-slate-400 text-xs py-8 text-center italic">Tidak ada transaksi pendukung yang tercatat.</div>
        ) : (
          <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
            {transactions.map((tx: any, index: number) => (
              <div
                key={index}
                className="bg-slate-50/70 dark:bg-slate-800/20 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-slate-850 dark:text-slate-200">
                      {tx.documentNumber}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      tx.type === 'ERP_DOCUMENT'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-100/30'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100/30'
                    }`}>
                      {tx.type === 'ERP_DOCUMENT' ? 'Dokumen ERP Odoo' : 'Truk Gerbang (Gate)'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-450">
                    Mitra/Supir: <strong className="font-bold text-slate-700 dark:text-slate-350">{tx.partnerName}</strong>
                  </div>
                </div>

                <div className="flex items-baseline justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-400">
                    {new Date(tx.scheduledDate).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={`font-extrabold text-sm ${
                    drill.type === 'INCOMING' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-650'
                  }`}>
                    {drill.type === 'INCOMING' ? '+' : '-'}{tx.quantity.toLocaleString('id-ID')} {detailData.product.uom}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

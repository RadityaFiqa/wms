'use client';

import React, { useState } from 'react';
import { useReconciliation, useReconciliationDetail } from '@/hooks/useReconciliation';
import { useAuthStore } from '@/store/auth';
import { Scale, MapPin, ClipboardList, Info, X, ExternalLink, Calendar, User, ArrowRightLeft } from 'lucide-react';

export default function ReconciliationPage() {
  const { activeWarehouse } = useAuthStore();
  const { reconciliationData, isLoading, refresh } = useReconciliation();
  const [selectedProductUuid, setSelectedProductUuid] = useState<string | null>(null);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Scale className="h-8 w-8 text-blue-600 shrink-0" />
            Rekonsiliasi Stok ERP
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Pantau perbedaan kuantitas stok antara sistem ERP Odoo dengan muatan fisik gerbang untuk gudang:{' '}
            <span className="font-semibold text-blue-600">
              {activeWarehouse?.name || 'Belum Dipilih'}
            </span>
          </p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-5 flex items-start gap-4 shadow-xs">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div className="text-xs sm:text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          <p className="font-bold mb-1">Cara Perhitungan (Formula) Rekonsiliasi:</p>
          <p className="font-mono bg-blue-100/50 dark:bg-blue-900/20 px-2 py-1 rounded inline-block text-[11px] sm:text-xs">
            Expected Stock = ERP Stock - Pending Gate Operation Quantity
          </p>
          <p className="mt-2 text-slate-500 dark:text-slate-400 text-xs">
            * Pending Gate Operation Quantity adalah total kargo masuk (IN) atau keluar (OUT) di pintu gerbang yang <strong>belum</strong> ditautkan ke referensi Purchase Order (PO), Sales Order (SO), atau dokumen picking ERP Odoo.
          </p>
        </div>
      </div>

      {/* Main Grid: List Table & Side Detail Panel */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Table Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex-1 w-full">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-layout-fixed">
              <thead className="bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800">
                <tr className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4 w-[35%]">Produk</th>
                  <th className="px-6 py-4 text-right w-[20%]">ERP Stock</th>
                  <th className="px-6 py-4 text-right w-[25%]">Pending Gate Operation</th>
                  <th className="px-6 py-4 text-right w-[20%]">Expected Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-48"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-16 ml-auto"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-16 ml-auto"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-250 dark:bg-slate-800 rounded w-16 ml-auto"></div></td>
                    </tr>
                  ))
                ) : reconciliationData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-slate-400 font-medium">
                      Tidak ada data rekonsiliasi yang tersedia.
                    </td>
                  </tr>
                ) : (
                  reconciliationData.map((row: any) => {
                    const isSelected = selectedProductUuid === row.product.uuid;
                    return (
                      <tr
                        key={row.product.uuid}
                        onClick={() => setSelectedProductUuid(row.product.uuid)}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 transition cursor-pointer select-none ${
                          isSelected ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''
                        }`}
                      >
                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                          <div>{row.product.name}</div>
                          <div className="text-slate-400 font-mono text-[10px] mt-0.5">{row.product.sku}</div>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-700 dark:text-slate-300">
                          {row.erpStock.toLocaleString('id-ID')} <span className="text-slate-400 text-xs font-normal ml-0.5">{row.product.uom}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {row.pendingGateQty !== 0 ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                              row.pendingGateQty > 0
                                ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30'
                                : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30'
                            }`}>
                              {row.pendingGateQty > 0 ? `+${row.pendingGateQty.toLocaleString('id-ID')}` : row.pendingGateQty.toLocaleString('id-ID')} {row.product.uom}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-blue-600 dark:text-blue-400">
                          {row.expectedStock.toLocaleString('id-ID')} <span className="text-slate-400 text-xs font-normal ml-0.5">{row.product.uom}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Panel: Product Detail Drill Down */}
        {selectedProductUuid && (
          <DetailDrawer
            productUuid={selectedProductUuid}
            onClose={() => setSelectedProductUuid(null)}
          />
        )}
      </div>
    </div>
  );
}

interface DetailDrawerProps {
  productUuid: string;
  onClose: () => void;
}

function DetailDrawer({ productUuid, onClose }: DetailDrawerProps) {
  const { detailData, isLoading, error } = useReconciliationDetail(productUuid);

  return (
    <div className="w-full lg:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md p-5 space-y-6 shrink-0 relative lg:sticky lg:top-24">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-slate-500"
      >
        <X className="h-4.5 w-4.5" />
      </button>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs font-semibold text-slate-500">Memuat rincian drill down...</span>
        </div>
      ) : error ? (
        <div className="text-red-500 text-xs font-bold py-4">Gagal memuat rincian.</div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div>
            <span className="inline-block bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/30">
              Drill-down Rekonsiliasi
            </span>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-200 mt-2 leading-snug">
              {detailData.product.name}
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{detailData.product.sku}</p>
          </div>

          {/* Core breakdown cards */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-850/50 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/80">
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Stok ERP</span>
              <strong className="text-base font-black text-slate-700 dark:text-slate-350">{detailData.erpStock.toLocaleString('id-ID')}</strong>
            </div>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Expected Stock</span>
              <strong className="text-base font-black text-blue-600 dark:text-blue-400">{detailData.expectedStock.toLocaleString('id-ID')}</strong>
            </div>
          </div>

          {/* Section 1: ERP Stock breakdown per Location */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
              Rincian Lokasi (ERP Source)
            </h3>
            {detailData.erpStockSource.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Tidak ada lokasi quants aktif di ERP.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {detailData.erpStockSource.map((loc: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-slate-50/50 dark:bg-slate-800/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="font-bold text-slate-750 dark:text-slate-300">{loc.locationName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Lot: {loc.lotName}</div>
                    </div>
                    <div className="font-bold text-slate-700 dark:text-slate-400 text-right">
                      {loc.quantity.toLocaleString('id-ID')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Gate Operations Contributing to calculation */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <ArrowRightLeft className="h-4 w-4 text-amber-500 shrink-0" />
              Kontributor Truk Gerbang
            </h3>
            {detailData.pendingGateOperations.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Tidak ada truk gerbang unassigned.</p>
            ) : (
              <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
                {detailData.pendingGateOperations.map((op: any) => (
                  <div
                    key={op.uuid}
                    className="bg-slate-50/60 dark:bg-slate-800/20 border border-slate-200/80 dark:border-slate-800 p-3 rounded-xl flex flex-col space-y-2 relative"
                  >
                    {/* Header: opNumber and date */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-mono text-xs font-black text-slate-800 dark:text-slate-200">
                          {op.opNumber}
                        </div>
                        <div className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3 shrink-0" />
                          {new Date(op.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        op.cardType === 'IN'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                      }`}>
                        {op.cardType === 'IN' ? 'Cargo Masuk' : 'Cargo Keluar'}
                      </span>
                    </div>

                    {/* Driver detail */}
                    <div className="text-[11px] text-slate-500 dark:text-slate-450 flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{op.driverName} ({op.licensePlate})</span>
                    </div>

                    {/* Quantity */}
                    <div className="flex justify-between items-center text-xs font-bold pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-400">Qty Belum Reconciled:</span>
                      <span className={op.cardType === 'IN' ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}>
                        {op.cardType === 'IN' ? '-' : '+'}{op.quantity.toLocaleString('id-ID')} {detailData.product.uom}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

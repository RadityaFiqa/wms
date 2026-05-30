'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useErpDocumentDetail } from '@/hooks/useErpDocuments';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  Boxes,
  FileText,
  Clock,
  Info,
  ChevronDown,
  ChevronUp,
  Terminal,
  RefreshCw,
} from 'lucide-react';

export default function ErpDocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuthStore();

  const [isRawPayloadOpen, setIsRawPayloadOpen] = useState(false);

  const { documentDetail, isLoading, error, forceSyncDetail } = useErpDocumentDetail(id);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleForceSync = async () => {
    setIsSyncing(true);
    const toastId = toast.loading(`Mensinkronkan paksa dokumen ${documentDetail?.documentNumber || ''}...`);
    try {
      await forceSyncDetail();
      toast.success(`Berhasil sinkronisasi dokumen ${documentDetail?.documentNumber || ''}!`, { id: toastId });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Gagal sinkronisasi paksa dokumen.';
      toast.error(msg, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (error || !documentDetail) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center shadow-sm space-y-4 max-w-lg mx-auto">
        <Info className="h-12 w-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Detail Tidak Ditemukan</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Data dokumen ERP tidak ditemukan atau Anda tidak memiliki akses ke dokumen ini.
        </p>
        <button
          type="button"
          onClick={() => router.push('/dashboard/erp-documents')}
          className="border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 font-bold px-4 py-2 rounded-lg text-sm transition"
        >
          Kembali ke Daftar
        </button>
      </div>
    );
  }

  const getStatusStyle = (state: string) => {
    switch (state) {
      case 'done':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400';
      case 'assigned':
        return 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400';
      case 'confirmed':
        return 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400';
      case 'waiting':
        return 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400';
      case 'cancel':
        return 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400';
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => router.push('/dashboard/erp-documents')}
            className="p-2 rounded-lg border border-slate-205 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-605 dark:text-slate-350 transition cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-105 tracking-tight flex items-center">
              <FileText className="h-6 w-6 text-blue-600 mr-2 shrink-0" />
              Detail Dokumen ERP
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-mono">
              {documentDetail.documentNumber}
            </p>
          </div>
        </div>
        {user?.role === 'SUPER_ADMIN' && (
          <button
            type="button"
            onClick={handleForceSync}
            disabled={isSyncing}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-bold px-4 py-2 rounded-xl shadow-md hover:shadow-blue-500/10 active:scale-[0.98] transition cursor-pointer text-xs min-h-[38px]"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Force Sync
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Card 1: Informasi Dokumen (md:col-span-2) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4 md:col-span-2 self-stretch">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center">
            <Info className="h-5 w-5 mr-2 text-blue-600 shrink-0" />
            Informasi Dokumen
          </h3>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Nomor Dokumen</span>
                <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200 mt-1 block">
                  {documentDetail.documentNumber}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Tipe Gerbang</span>
                <span className="mt-1 block">
                  {documentDetail.pickingTypeCode === 'incoming' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-[10px] uppercase">
                      IN (PO)
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-50 border border-purple-100 text-purple-700 font-bold text-[10px] uppercase">
                      OUT (SO)
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Status</span>
                <span className="mt-1 block">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded border text-[10px] font-bold ${getStatusStyle(documentDetail.state)}`}>
                    {getStatusText(documentDetail.state)}
                  </span>
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Mitra / Partner</span>
                <span className="text-sm font-bold text-slate-850 dark:text-slate-350 mt-1 block truncate">
                  {documentDetail.partnerName || '-'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Referensi Purchase</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 block font-mono">
                  {documentDetail.purchaseName || '-'}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Dokumen Asal (Origin)</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 block font-mono">
                  {documentDetail.origin || '-'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Tanggal Dijadwalkan</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 block flex items-center">
                  <Calendar className="h-4 w-4 mr-1.5 text-slate-400" />
                  {documentDetail.scheduledDate ? new Date(documentDetail.scheduledDate).toLocaleString('id-ID') : '-'}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Tanggal Selesai</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 block flex items-center">
                  <Clock className="h-4 w-4 mr-1.5 text-slate-400" />
                  {documentDetail.dateDone ? new Date(documentDetail.dateDone).toLocaleString('id-ID') : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Lokasi & Transportasi (md:col-span-2) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4 md:col-span-2 self-stretch">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-105 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-blue-600 shrink-0" />
            Detail Lokasi & Transportasi
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Lokasi Asal (Source)</span>
              <span className="text-sm font-semibold text-slate-850 dark:text-slate-250 mt-1 block flex items-center">
                <MapPin className="h-4 w-4 mr-1.5 text-slate-400 shrink-0" />
                {documentDetail.sourceLocationName || '-'}
              </span>
            </div>

            <div>
              <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Lokasi Tujuan (Destination)</span>
              <span className="text-sm font-semibold text-slate-850 dark:text-slate-250 mt-1 block flex items-center">
                <MapPin className="h-4 w-4 mr-1.5 text-slate-400 shrink-0" />
                {documentDetail.destinationLocationName || '-'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <div>
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Driver</span>
                <span className="text-sm font-bold text-slate-850 dark:text-slate-250 mt-1 block flex items-center">
                  <User className="h-4 w-4 mr-1.5 text-slate-405" />
                  {documentDetail.driver || '-'}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Plat Nomor</span>
                <span className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 mt-1 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 border border-slate-200 dark:border-slate-700 rounded-md inline-block">
                  {documentDetail.plateNumber || '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Daftar Barang (md:col-span-4 / Full Width) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4 md:col-span-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center">
            <Boxes className="h-5 w-5 mr-2 text-indigo-505 shrink-0" />
            Daftar Barang (Line Items)
          </h3>

          {!documentDetail.items || documentDetail.items.length === 0 ? (
            <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-sm italic">
              Tidak ada rincian barang muatan dalam dokumen ini.
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-3 w-[40%]">Nama Produk</th>
                    <th className="px-5 py-3 w-[20%]">Analytic Account</th>
                    <th className="px-5 py-3 text-right w-[11%]">Qty</th>
                    <th className="px-5 py-3 text-right w-[11%]">Product Qty</th>
                    <th className="px-5 py-3 text-center w-[9%]">UOM</th>
                    <th className="px-5 py-3 text-right w-[9%]">Qty Sekunder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                  {documentDetail.items.map((item: any, index: number) => (
                    <tr key={`${index}-${item?.uuid}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/35 transition">
                      <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-150">
                        {item.productName}
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400 font-mono">
                        {item.analyticAccountName || '-'}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-850 dark:text-slate-100">
                        {item.quantity.toLocaleString('id-ID')}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-505 dark:text-slate-405">
                        {item.productQty.toLocaleString('id-ID')}
                      </td>
                      <td className="px-5 py-3 text-center font-bold text-blue-600 dark:text-blue-400 uppercase">
                        {item.uom}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-600 dark:text-slate-400">
                        {item.secondaryQuantity !== null && item.secondaryQuantity !== undefined ? (
                          <>
                            {item.secondaryQuantity.toLocaleString('id-ID')}
                            <span className="text-[10px] text-slate-400 ml-1 uppercase font-normal">{item.secondaryUom || 'Unit'}</span>
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

        {/* Card 4: ERP Raw Payload Collapsible (md:col-span-4) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden md:col-span-4">
          <button
            type="button"
            onClick={() => setIsRawPayloadOpen(!isRawPayloadOpen)}
            className="w-full px-6 py-4 flex items-center justify-between text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer select-none border-b border-transparent data-[open=true]:border-slate-150 dark:data-[open=true]:border-slate-800"
            data-open={isRawPayloadOpen}
          >
            <div className="flex items-center space-x-2">
              <Terminal className="h-4.5 w-4.5 text-slate-500" />
              <span>ERP Raw Payload</span>
            </div>
            {isRawPayloadOpen ? (
              <ChevronUp className="h-4.5 w-4.5 text-slate-450" />
            ) : (
              <ChevronDown className="h-4.5 w-4.5 text-slate-450" />
            )}
          </button>

          {isRawPayloadOpen && (
            <div className="p-6 bg-slate-950 text-slate-200 font-mono text-[10px] overflow-x-auto max-h-[350px] leading-relaxed select-all">
              <pre>{JSON.stringify(documentDetail.rawPayload, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

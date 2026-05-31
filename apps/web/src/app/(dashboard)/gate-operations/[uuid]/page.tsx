'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useGateOperationDetail } from '@/hooks/useGate';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import {
  Truck,
  ArrowLeft,
  Calendar,
  User,
  Power,
  FileText,
  Boxes,
  Clock,
  ExternalLink,
  ShieldCheck,
  XCircle,
  CheckCircle2,
  Lock,
  Image as ImageIcon,
} from 'lucide-react';

export default function GateOperationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params.uuid as string;

  const [selectedZoomImage, setSelectedZoomImage] = useState<string | null>(null);

  const { gateOperation, isLoading, error } = useGateOperationDetail(uuid);
  const { hasPermission } = useAuthStore();

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <div className="flex items-center text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
            <Clock className="h-4 w-4 mr-1.5 shrink-0 animate-pulse" />
            Menunggu Verifikasi
          </div>
        );
      case 'PARTIAL':
        return (
          <div className="flex items-center text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
            <Clock className="h-4 w-4 mr-1.5 shrink-0" />
            Verifikasi Sebagian (Partial)
          </div>
        );
      case 'COMPLETED':
        return (
          <div className="flex items-center text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="h-4 w-4 mr-1.5 shrink-0" />
            Verifikasi Selesai (Completed)
          </div>
        );
      case 'CANCELED':
        return (
          <div className="flex items-center text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
            <XCircle className="h-4 w-4 mr-1.5 shrink-0" />
            Dibatalkan (Canceled)
          </div>
        );
      default:
        return (
          <div className="flex items-center text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold">
            {status}
          </div>
        );
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

  if (error || !gateOperation) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm space-y-4 max-w-lg mx-auto">
        <XCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">Detail Tidak Ditemukan</h3>
        <p className="text-sm text-slate-500">
          Data gate operation dengan UUID tersebut tidak valid atau tidak dapat diakses.
        </p>
        <button
          onClick={() => router.push('/gate-operations')}
          className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-lg text-sm transition"
        >
          Kembali ke List
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/gate-operations')}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center">
              Detail Log Gerbang
            </h1>
            <p className="text-slate-500 text-xs mt-0.5 font-mono">
              ID: {gateOperation.opNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusDisplay(gateOperation.status)}
          
          {(gateOperation.status === 'PENDING' || gateOperation.status === 'PARTIAL') && hasPermission('create', 'GateVerification') && (
            <Link
              href={`/gate-verification/${gateOperation.uuid}`}
              className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-md hover:shadow-blue-500/10 active:scale-[0.98] transition cursor-pointer"
            >
              <ShieldCheck className="h-4.5 w-4.5 mr-1.5" />
              Verifikasi Sekarang
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Foto Bukti Fisik Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 md:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
            <ImageIcon className="h-5 w-5 mr-2 text-blue-600 shrink-0" />
            Foto Bukti Fisik
          </h3>

          {gateOperation.attachments && gateOperation.attachments.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {gateOperation.attachments.map((attach: any, idx: number) => (
                <div key={idx} className="space-y-2 group cursor-pointer" onClick={() => setSelectedZoomImage(attach.url)}>
                  <div className="w-full h-[150px] bg-slate-100 border border-slate-200 rounded-lg overflow-hidden relative group-hover:opacity-90 transition">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attach.url}
                      alt={`Foto Bukti ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-[10px] text-center font-bold text-slate-505 hover:text-blue-600 transition flex items-center justify-center">
                    <span>Buka Preview {idx + 1}</span>
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[150px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 text-center p-4">
              <ImageIcon className="h-10 w-10 text-slate-300 mb-2" />
              <span className="text-xs">Tidak ada foto kendaraan terlampir.</span>
            </div>
          )}
        </div>

        {/* Informasi Umum Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5 md:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
            <Truck className="h-5 w-5 mr-2 text-blue-600 shrink-0" />
            Informasi Umum
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-xs">
            <div>
              <p className="font-bold text-slate-400 uppercase tracking-wider">No Gate</p>
              <p className="text-sm font-semibold text-slate-800 mt-1 font-mono">{gateOperation.opNumber}</p>
            </div>

            <div>
              <p className="font-bold text-slate-400 uppercase tracking-wider">Tipe (IN/OUT)</p>
              <p className="text-sm font-bold text-slate-800 mt-1">
                {gateOperation.cardType === 'IN' ? '📥 MASUK (GATE IN)' : '📤 KELUAR (GATE OUT)'}
              </p>
            </div>

            <div>
              <p className="font-bold text-slate-400 uppercase tracking-wider">Plat Nomor</p>
              <p className="text-sm font-mono font-bold text-slate-900 mt-1 bg-slate-50 px-2 py-0.5 border border-slate-200 rounded-md inline-block">
                {gateOperation.licensePlate}
              </p>
            </div>

            <div>
              <p className="font-bold text-slate-400 uppercase tracking-wider">Driver</p>
              <p className="text-sm font-bold text-slate-800 mt-1 flex items-center">
                <User className="h-4 w-4 text-slate-400 mr-1.5" />
                {gateOperation.driverName}
              </p>
            </div>

            <div>
              <p className="font-bold text-slate-400 uppercase tracking-wider">Waktu Pencatatan (Created At)</p>
              <p className="text-sm font-semibold text-slate-700 mt-1 flex items-center">
                <Calendar className="h-4 w-4 text-slate-400 mr-1.5" />
                {new Date(gateOperation.createdAt).toLocaleString('id-ID', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>

            <div>
              <p className="font-bold text-slate-400 uppercase tracking-wider">Reporter</p>
              <p className="text-sm font-semibold text-slate-700 mt-1">
                {gateOperation.createdByUser?.name} ({gateOperation.createdByUser?.email})
              </p>
            </div>
          </div>

          {(gateOperation.poReferences?.length > 0 || gateOperation.soReferences?.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              {gateOperation.poReferences?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Purchase Orders (PO)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {gateOperation.poReferences.map((po: string, index: number) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-150 font-mono">
                        {po}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {gateOperation.soReferences?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Sales Orders (SO)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {gateOperation.soReferences.map((so: string, index: number) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-purple-50 text-purple-700 border border-purple-150 font-mono">
                        {so}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Keterangan</p>
            <p className="text-sm text-slate-600 mt-1.5 bg-slate-50 border border-slate-100 rounded-lg p-3 italic">
              {gateOperation.notes || 'Tidak ada catatan.'}
            </p>
          </div>
        </div>
      </div>

      {/* Barang Muatan Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
          <Boxes className="h-5 w-5 mr-2 text-indigo-500 shrink-0" />
          Barang Muatan
        </h3>

        {!gateOperation.products || gateOperation.products.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-sm">
            Kendaraan dicatat tidak membawa barang muatan.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-4 py-3">Produk</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {gateOperation.products.map((p: any) => (
                  <tr key={p.uuid} className="hover:bg-slate-50/20 transition">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <div>{p.product.name}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">SKU: {p.product.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {p.quantity} {p.product.uom || 'Unit'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hasil Verifikasi Card */}
      {gateOperation.verification && (() => {
        const getBorderColorClass = (status: string) => {
          switch (status) {
            case 'PENDING': return 'border-l-4 border-l-amber-500';
            case 'PARTIAL': return 'border-l-4 border-l-blue-500';
            case 'COMPLETED': return 'border-l-4 border-l-emerald-500';
            case 'CANCELED': return 'border-l-4 border-l-red-500';
            default: return 'border-l-4 border-l-slate-400';
          }
        };

        return (
          <div className={`bg-white border border-slate-250 rounded-xl p-6 shadow-sm space-y-5 ${getBorderColorClass(gateOperation.verification.status)}`}>
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
              <ShieldCheck className="h-5 w-5 mr-2 text-emerald-500 shrink-0" />
              Hasil Verifikasi
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
              <div>
                <p className="font-bold text-slate-400 uppercase tracking-wider">Status Verifikasi</p>
                <p className="text-sm font-extrabold mt-1.5 text-slate-850 flex items-center">
                  {gateOperation.verification.status === 'PENDING' && (
                    <span className="text-amber-700 bg-amber-50 border border-amber-250 px-2 py-0.5 rounded">
                      Pending
                    </span>
                  )}
                  {gateOperation.verification.status === 'PARTIAL' && (
                    <span className="text-blue-700 bg-blue-50 border border-blue-250 px-2 py-0.5 rounded">
                      Partial
                    </span>
                  )}
                  {gateOperation.verification.status === 'COMPLETED' && (
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-250 px-2 py-0.5 rounded">
                      Completed
                    </span>
                  )}
                  {gateOperation.verification.status === 'CANCELED' && (
                    <span className="text-red-700 bg-red-50 border border-red-250 px-2 py-0.5 rounded">
                      Canceled
                    </span>
                  )}
                </p>
              </div>

              <div>
                <p className="font-bold text-slate-400 uppercase tracking-wider">Verifikator</p>
                <p className="text-sm font-semibold text-slate-800 mt-1.5">
                  {gateOperation.verification.verifiedBy?.name}
                </p>
              </div>

              <div>
                <p className="font-bold text-slate-400 uppercase tracking-wider">Waktu Verifikasi</p>
                <p className="text-sm font-semibold text-slate-700 mt-1.5">
                  {gateOperation.verification.status === 'COMPLETED'
                    ? new Date(gateOperation.verification.verifiedAt).toLocaleString('id-ID')
                    : '-'
                  }
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Catatan Verifikasi</p>
              <p className="text-sm text-slate-600 mt-1.5 p-3 bg-slate-50 rounded-lg border border-slate-100 italic leading-relaxed">
                {gateOperation.verification.notes || 'Tidak ada catatan.'}
              </p>
            </div>

            {gateOperation.verification.attachments && gateOperation.verification.attachments.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Dokumen Pendukung</p>
                <div className="space-y-1.5">
                  {gateOperation.verification.attachments.map((attach: any, index: number) => (
                    <a
                      key={index}
                      href={attach.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-xs text-blue-600 hover:underline font-semibold"
                    >
                      📄 {attach.fileName}
                      <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {selectedZoomImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setSelectedZoomImage(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-xl border border-white/10 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={selectedZoomImage} 
              alt="Zoomed Preview" 
              className="max-w-full max-h-[80vh] object-contain"
            />
            <button 
              type="button"
              onClick={() => setSelectedZoomImage(null)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white p-2 rounded-full border border-white/20 transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

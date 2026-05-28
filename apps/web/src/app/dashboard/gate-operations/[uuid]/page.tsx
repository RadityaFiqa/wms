'use client';

import React from 'react';
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
      case 'VERIFIED':
        return (
          <div className="flex items-center text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="h-4 w-4 mr-1.5 shrink-0" />
            Lolos Verifikasi (Verified)
          </div>
        );
      case 'REJECTED':
        return (
          <div className="flex items-center text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
            <XCircle className="h-4 w-4 mr-1.5 shrink-0" />
            Ditolak (Rejected)
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
          onClick={() => router.push('/dashboard/gate-operations')}
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
            onClick={() => router.push('/dashboard/gate-operations')}
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
          
          {gateOperation.status === 'PENDING' && hasPermission('create', 'GateVerification') && (
            <Link
              href={`/dashboard/gate-verification/${gateOperation.uuid}`}
              className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-md hover:shadow-blue-500/10 active:scale-[0.98] transition cursor-pointer"
            >
              <ShieldCheck className="h-4.5 w-4.5 mr-1.5" />
              Verifikasi Sekarang
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column - General Info & Products */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Data Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
              <Truck className="h-5 w-5 mr-2 text-blue-600 shrink-0" />
              Informasi Umum
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipe Kartu / Gerbang</p>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  {gateOperation.cardType === 'IN' ? '📥 MASUK (GATE IN)' : '📤 KELUAR (GATE OUT)'}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Plat Nomor Kendaraan</p>
                <p className="text-sm font-mono font-bold text-slate-900 mt-1 bg-slate-50 px-2 py-0.5 border border-slate-200 rounded-md inline-block">
                  {gateOperation.licensePlate}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nama Driver</p>
                <p className="text-sm font-bold text-slate-800 mt-1 flex items-center">
                  <User className="h-4 w-4 text-slate-400 mr-1.5" />
                  {gateOperation.driverName}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Waktu Pencatatan</p>
                <p className="text-sm font-semibold text-slate-700 mt-1 flex items-center">
                  <Calendar className="h-4 w-4 text-slate-400 mr-1.5" />
                  {new Date(gateOperation.createdAt).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Petugas Satpam (Pencatat)</p>
                <p className="text-sm font-semibold text-slate-700 mt-1">
                  {gateOperation.createdByUser?.name} ({gateOperation.createdByUser?.email})
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Catatan Satpam</p>
              <p className="text-sm text-slate-600 mt-1.5 bg-slate-50 border border-slate-100 rounded-lg p-3 italic">
                {gateOperation.notes || 'Tidak ada catatan.'}
              </p>
            </div>
          </div>

          {/* Products List Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
              <Boxes className="h-5 w-5 mr-2 text-indigo-500 shrink-0" />
              Barang Logistik (Data Satpam)
            </h3>

            {!gateOperation.products || gateOperation.products.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">
                Kendaraan dicatat tidak membawa barang logistik.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      <th className="px-4 py-3">Nama Produk</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3 text-right">Kuantitas</th>
                      <th className="px-4 py-3">UOM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {gateOperation.products.map((p: any) => (
                      <tr key={p.uuid} className="hover:bg-slate-50/20 transition">
                        <td className="px-4 py-3 font-semibold text-slate-800">{p.product.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.product.sku}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{p.quantity}</td>
                        <td className="px-4 py-3 text-slate-500">{p.product.uom || 'Unit'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Photo & Verification Status */}
        <div className="space-y-6">
          {/* Photo Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-slate-400 shrink-0" />
              Foto Bukti Fisik
            </h3>

            {gateOperation.vehiclePhoto?.url ? (
              <div className="space-y-3">
                <div className="w-full h-[220px] bg-slate-100 border border-slate-200 rounded-lg overflow-hidden relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gateOperation.vehiclePhoto.url}
                    alt="Foto Bukti Kendaraan"
                    className="w-full h-full object-cover"
                  />
                </div>
                <a
                  href={gateOperation.vehiclePhoto.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center text-xs font-bold text-blue-600 hover:text-blue-500 transition py-1.5 border border-blue-200 rounded-lg bg-blue-50/20 hover:bg-blue-50/50 cursor-pointer"
                >
                  Buka Gambar Asli
                  <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </a>
              </div>
            ) : (
              <div className="h-[220px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 text-center p-4">
                <ImageIcon className="h-10 w-10 text-slate-300 mb-2" />
                <span className="text-xs">Tidak ada foto kendaraan terlampir.</span>
              </div>
            )}
          </div>

          {/* Verification Audit Summary Card */}
          {gateOperation.verification && (
            <div className="bg-white border border-slate-250 rounded-xl p-6 shadow-sm space-y-5 border-l-4 border-l-emerald-500">
              <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center">
                <ShieldCheck className="h-5 w-5 mr-2 text-emerald-500 shrink-0" />
                Hasil Audit Verifikasi
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider">Status</p>
                  <p className="text-sm font-extrabold mt-1 text-slate-800 flex items-center">
                    {gateOperation.verification.status === 'VERIFIED' ? (
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-250 px-2 py-0.5 rounded">
                        Lolos Audit (VERIFIED)
                      </span>
                    ) : (
                      <span className="text-red-700 bg-red-50 border border-red-250 px-2 py-0.5 rounded">
                        Ditolak Audit (REJECTED)
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider">Auditor / Verifikator</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {gateOperation.verification.verifiedBy?.name}
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider">Waktu Audit</p>
                  <p className="text-sm font-semibold text-slate-700 mt-1">
                    {new Date(gateOperation.verification.verifiedAt).toLocaleString('id-ID')}
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider">Catatan Auditor</p>
                  <p className="text-sm text-slate-600 mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100 italic leading-relaxed">
                    {gateOperation.verification.notes || 'Tidak ada catatan.'}
                  </p>
                </div>

                {gateOperation.verification.attachment?.url && (
                  <div>
                    <p className="font-bold text-slate-400 uppercase tracking-wider mb-2">Lampiran Bukti Audit</p>
                    <a
                      href={gateOperation.verification.attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-xs text-blue-600 hover:underline font-semibold"
                    >
                      📄 {gateOperation.verification.attachment.fileName}
                      <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

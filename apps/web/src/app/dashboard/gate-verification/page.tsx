'use client';

import React, { useState } from 'react';
import { useGateOperations } from '@/hooks/useGate';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import {
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  Eye,
  Info,
  Clock,
} from 'lucide-react';

export default function GateVerificationListPage() {
  const [search, setSearch] = useState('');
  const [cardType, setCardType] = useState('');
  const [page, setPage] = useState(1);

  const { activeWarehouse } = useAuthStore();
  // Fetch gate operations with status PENDING for verification queue
  const { data, isLoading, error } = useGateOperations({
    search,
    cardType: cardType || undefined,
    status: 'PENDING',
    page,
    limit: 10,
  });

  const getCardTypeBadge = (type: string) => {
    return type === 'IN' ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-150">
        📥 GATE IN
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-150">
        📤 GATE OUT
      </span>
    );
  };

  if (!activeWarehouse) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm space-y-4">
        <ShieldCheck className="h-12 w-12 text-slate-350 mx-auto animate-pulse" />
        <h3 className="text-lg font-bold text-slate-800">Gudang Aktif Belum Dipilih</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Silakan pilih gudang aktif terlebih dahulu di panel navigasi atas untuk melihat antrean verifikasi gerbang.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center">
          <ShieldCheck className="h-8 w-8 text-blue-605 mr-3 shrink-0" />
          Verifikasi Gate (Audit Queue)
        </h1>
        <p className="text-slate-500 mt-1">
          Lakukan audit dan verifikasi logistik untuk kendaraan masuk/keluar di {activeWarehouse.name}.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Nomor GO, Driver, Plat Nomor di Antrean..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition duration-200 text-sm"
            />
          </div>

          <div className="flex items-center space-x-2 border border-slate-200 rounded-lg px-3 bg-slate-50">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={cardType}
              onChange={(e) => {
                setCardType(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-none text-sm text-slate-600 focus:outline-none py-1.5 cursor-pointer font-medium"
            >
              <option value="">Semua Tipe Kartu</option>
              <option value="IN">Gate In</option>
              <option value="OUT">Gate Out</option>
            </select>
          </div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">
            <Info className="h-8 w-8 mx-auto mb-2" />
            Gagal mengambil data antrean verifikasi gerbang.
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Clock className="h-12 w-12 mx-auto text-slate-350 mb-4 animate-bounce" />
            <p className="text-base font-semibold text-slate-700">Antrean Verifikasi Kosong</p>
            <p className="text-sm text-slate-400 mt-1">Seluruh data operasi gerbang telah diverifikasi dan diaudit.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                    <th className="px-6 py-4">No. Operasi</th>
                    <th className="px-6 py-4">Waktu</th>
                    <th className="px-6 py-4">Tipe Kartu</th>
                    <th className="px-6 py-4">Driver</th>
                    <th className="px-6 py-4">Plat Nomor</th>
                    <th className="px-6 py-4">Membawa Barang</th>
                    <th className="px-6 py-4">Pencatat</th>
                    <th className="px-6 py-4 text-center">Aksi Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {data.items.map((item: any) => (
                    <tr key={item.uuid} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 font-bold text-slate-900 tracking-tight">
                        {item.opNumber}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1.5 text-slate-500 text-xs">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {new Date(item.createdAt).toLocaleString('id-ID', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getCardTypeBadge(item.cardType)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {item.driverName}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-xs text-slate-900">
                        {item.licensePlate}
                      </td>
                      <td className="px-6 py-4">
                        {item.products && item.products.length > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-150">
                            📦 {item.products.length} Item
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-semibold">Tidak</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                        {item.createdByUser?.name}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link
                          href={`/dashboard/gate-verification/${item.uuid}`}
                          className="inline-flex items-center justify-center bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition cursor-pointer"
                        >
                          <ShieldCheck className="h-4 w-4 mr-1.5" />
                          Verifikasi
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-150 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Halaman <strong>{page}</strong> dari <strong>{data.totalPages}</strong> ({data.total} total antrean)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer"
                  >
                    <ChevronLeft className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer"
                  >
                    <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

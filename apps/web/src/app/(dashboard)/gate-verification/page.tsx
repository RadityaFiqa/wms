"use client";

import React, { useState } from "react";
import { useGateOperations } from "@/hooks/useGate";
import { useAuthStore } from "@/store/auth";
import { useDebounce } from "@/hooks/useDebounce";
import Link from "next/link";
import {
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  Calendar,
  Info,
  Clock,
} from "lucide-react";

const getProductDetails = (item: any) => {
  if (!item) return { sku: "-", name: "-", uom: "-" };

  const sku = item.sku || item.inventory?.sku || item.product?.sku;
  const name = item.name || item.inventory?.name || item.product?.name;
  const uom = item.uom || item.inventory?.uom || item.product?.uom;

  if (!sku || !name || !uom) {
    console.warn(
      "Warning: Product details mapping failed or incomplete for item:",
      item,
    );
  }

  return {
    sku: sku || "-",
    name: name || "-",
    uom: uom || "-",
  };
};

export default function GateVerificationListPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [cardType, setCardType] = useState("");
  const [status, setStatus] = useState("PENDING,PARTIAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const { activeWarehouse } = useAuthStore();
  // Fetch gate operations with status and date filter for verification queue
  const { data, isLoading, error } = useGateOperations({
    search: debouncedSearch || undefined,
    cardType: cardType || undefined,
    status: status || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    limit: 10,
  });

  const getCardTypeBadge = (type: string) => {
    return type === "IN" ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-150">
        📥 GATE IN
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-55 text-purple-700 border border-purple-150">
        📤 GATE OUT
      </span>
    );
  };

  const getStatusBadge = (statusValue: string) => {
    switch (statusValue) {
      case "PENDING":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Pending
          </span>
        );
      case "PARTIAL":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Partial
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Completed
          </span>
        );
      case "CANCELED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Canceled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {statusValue}
          </span>
        );
    }
  };

  if (!activeWarehouse) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm space-y-4">
        <ShieldCheck className="h-12 w-12 text-slate-350 mx-auto animate-pulse" />
        <h3 className="text-lg font-bold text-slate-800">
          Gudang Aktif Belum Dipilih
        </h3>
        <p className="text-sm text-slate-505 max-w-md mx-auto">
          Silakan pilih gudang aktif terlebih dahulu di panel navigasi atas
          untuk melihat antrean verifikasi gerbang.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center">
          <ShieldCheck className="h-8 w-8 text-blue-606 mr-3 shrink-0" />
          Verifikasi Gate
        </h1>
        <p className="text-slate-500 mt-1">
          Lakukan audit dan verifikasi logistik untuk kendaraan masuk/keluar di{" "}
          {activeWarehouse.name}.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Nomor GO, Driver, Plat Nomor, atau Dokumen Referensi..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-55 border border-slate-200 text-slate-905 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition duration-200 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-3">
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

            <div className="flex items-center space-x-2 border border-slate-200 rounded-lg px-3 bg-slate-50">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-sm text-slate-600 focus:outline-none py-1.5 cursor-pointer font-medium"
              >
                <option value="PENDING,PARTIAL">
                  Antrean (Pending/Partial)
                </option>
                <option value="PENDING">Pending</option>
                <option value="PARTIAL">Partial</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELED">Canceled</option>
                <option value="">Semua Status</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 border border-slate-200 rounded-lg px-3 bg-slate-50">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-bold uppercase">
                Mulai:
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-sm text-slate-655 focus:outline-none py-1 cursor-pointer font-medium"
              />
            </div>

            <div className="flex items-center space-x-2 border border-slate-200 rounded-lg px-3 bg-slate-50">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-bold uppercase">
                Selesai:
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-sm text-slate-655 focus:outline-none py-1 cursor-pointer font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <svg
              className="animate-spin h-8 w-8 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">
            <Info className="h-8 w-8 mx-auto mb-2" />
            Gagal mengambil data antrean verifikasi gerbang.
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Clock className="h-12 w-12 mx-auto text-slate-355 mb-4 animate-bounce" />
            <p className="text-base font-semibold text-slate-700">
              Antrean Verifikasi Kosong
            </p>
            <p className="text-sm text-slate-450 mt-1">
              Seluruh data operasi gerbang telah diverifikasi dan diaudit.
            </p>
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
                    <th className="px-6 py-4">Dokumen Referensi</th>
                    <th className="px-6 py-4">Driver</th>
                    <th className="px-6 py-4">Plat Nomor</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {data.items.map((item: any) => (
                    <GateVerificationRow
                      key={item.uuid}
                      item={item}
                      getCardTypeBadge={getCardTypeBadge}
                      getStatusBadge={getStatusBadge}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-150 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Halaman <strong>{page}</strong> dari{" "}
                  <strong>{data.totalPages}</strong> ({data.total} total
                  antrean)
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
                    onClick={() =>
                      setPage((p) => Math.min(data.totalPages, p + 1))
                    }
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

function GateVerificationRow({
  item,
  getCardTypeBadge,
  getStatusBadge,
}: {
  item: any;
  getCardTypeBadge: any;
  getStatusBadge: any;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Map products to verify table rows
  const productRows =
    item.products?.map((gp: any) => {
      const docItem = item.documentReference?.items?.find(
        (di: any) => di.inventoryId === gp.productId,
      );
      const erpQty = docItem ? (docItem.productQty || docItem.quantity) : 0;
      const prodDetails = getProductDetails(gp);
      return {
        productId: gp.productId,
        sku: prodDetails.sku,
        name: prodDetails.name,
        uom: prodDetails.uom,
        qtyCargo: gp.quantity,
        qtyErp: erpQty,
      };
    }) || [];

  return (
    <>
      <tr
        onClick={() => setIsExpanded(!isExpanded)}
        className={`hover:bg-slate-50/70 border-b border-slate-100 transition cursor-pointer select-none ${
          isExpanded ? "bg-slate-50/40" : ""
        }`}
      >
        <td className="px-6 py-4 font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <div className="p-0.5 rounded-md hover:bg-slate-200 transition">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-550 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-550 shrink-0" />
            )}
          </div>
          <span>{item.opNumber}</span>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center space-x-1.5 text-slate-550 text-xs">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {new Date(item.createdAt).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
        </td>
         <td className="px-6 py-4">{getCardTypeBadge(item.cardType)}</td>
        <td className="px-6 py-4 font-mono text-xs font-semibold">
          {item.documentReference?.documentNumber ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-250">
              {item.documentReference.documentNumber}
            </span>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </td>
        <td className="px-6 py-4 font-semibold text-slate-800 font-bold">
          {item.driverName}
        </td>
        <td className="px-6 py-4 font-mono font-bold text-xs text-slate-900">
          {item.licensePlate}
        </td>
        <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
        <td
          className="px-6 py-4 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Link
            href={`/gate-verification/${item.uuid}`}
            className="inline-flex items-center justify-center bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition cursor-pointer"
          >
            <ShieldCheck className="h-4 w-4 mr-1.5" />
            {item.status === "COMPLETED" || item.status === "CANCELED"
              ? "Detail"
              : "Verifikasi"}
          </Link>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td
            colSpan={8}
            className="bg-slate-50/50 px-12 py-4 border-b border-slate-200"
          >
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden max-w-3xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-55 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-2">Nama Produk</th>
                    <th className="px-4 py-2 text-right">ERP Qty</th>
                    <th className="px-4 py-2 text-right">Cargo Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-105 text-xs text-slate-700">
                  {productRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-4 text-center text-slate-400 italic"
                      >
                        Tidak ada barang logistik yang dicatat
                      </td>
                    </tr>
                  ) : (
                    productRows.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/30 transition">
                        <td className="px-4 py-2.5 font-bold">
                          {r.name}{" "}
                          <span className="text-[10px] font-mono font-normal text-slate-450 ml-1">
                            SKU: {r.sku}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-black text-slate-500">
                          {r.qtyErp.toLocaleString("id-ID")} {r.uom}
                        </td>
                        <td className="px-4 py-2.5 text-right font-black text-blue-700 bg-blue-50/5">
                          {r.qtyCargo.toLocaleString("id-ID")} {r.uom}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useNonCommodityOrderDetail } from "@/hooks/useNonCommodityOrders";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  User,
  Clock,
  Info,
  ChevronDown,
  ChevronUp,
  Terminal,
  FileSpreadsheet,
  Building2,
  DollarSign,
  Copy,
  Check,
  CreditCard,
  FileText,
  BadgeAlert,
  Boxes,
} from "lucide-react";

export default function NonCommodityOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params.uuid as string;

  const [isRawJsonOpen, setIsRawJsonOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { orderDetail, isLoading, error } = useNonCommodityOrderDetail(uuid);

  const handleCopyJson = () => {
    if (!orderDetail?.rawJson) return;
    navigator.clipboard.writeText(JSON.stringify(orderDetail.rawJson, null, 2));
    setCopied(true);
    toast.success("Raw JSON berhasil disalin ke clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <svg
          className="animate-spin h-8 w-8 text-purple-600"
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
    );
  }

  if (error || !orderDetail) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm space-y-4 max-w-lg mx-auto">
        <Info className="h-12 w-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Dokumen Tidak Ditemukan
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Data dokumen Purchase Order Non Commodity tidak ditemukan atau Anda tidak memiliki akses.
        </p>
        <button
          type="button"
          onClick={() => router.push("/finance/non-commodity-documents")}
          className="border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-xl text-sm transition cursor-pointer"
        >
          Kembali ke Daftar
        </button>
      </div>
    );
  }

  const getStatusStyle = (st: string) => {
    switch (st?.toLowerCase()) {
      case "purchase":
      case "done":
        return "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400";
      case "to approve":
      case "waiting":
        return "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400";
      case "draft":
        return "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400";
      case "sent":
        return "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400";
      case "cancel":
        return "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400";
      default:
        return "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400";
    }
  };

  const getStatusText = (st: string) => {
    switch (st?.toLowerCase()) {
      case "purchase":
        return "Purchase Order";
      case "done":
        return "Done / Locked";
      case "to approve":
        return "To Approve";
      case "draft":
        return "Draft";
      case "sent":
        return "RFQ Sent";
      case "cancel":
        return "Cancelled";
      default:
        return st || "-";
    }
  };

  const formatCurrency = (amount: number, currency: string = "IDR") => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currency || "IDR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => router.push("/finance/non-commodity-documents")}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer shadow-xs"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center">
                <FileSpreadsheet className="h-6 w-6 text-purple-600 mr-2.5 shrink-0" />
                Detail Purchase Order Non Commodity
              </h1>
              <span
                className={`inline-flex items-center px-3 py-0.5 rounded-full border text-xs font-bold ${getStatusStyle(
                  orderDetail.state,
                )}`}
              >
                {getStatusText(orderDetail.state)}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-mono">
              {orderDetail.documentNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {orderDetail.invoiceStatus && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <CreditCard className="h-3.5 w-3.5 mr-1.5 text-purple-600" />
              Invoice: <span className="font-bold ml-1 uppercase">{orderDetail.invoiceStatus}</span>
            </span>
          )}
        </div>
      </div>

      {/* Header PO Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Card 1: Informasi Dokumen PO */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 md:col-span-2">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center">
            <Info className="h-4.5 w-4.5 mr-2 text-purple-600 shrink-0" />
            Informasi Dokumen & Rekanan
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Nomor Dokumen PO
              </span>
              <span className="text-sm font-bold font-mono text-purple-700 dark:text-purple-400 mt-1 block">
                {orderDetail.documentNumber}
              </span>
            </div>

            <div>
              <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Partner Reference
              </span>
              <span className="text-sm font-semibold font-mono text-slate-800 dark:text-slate-200 mt-1 block">
                {orderDetail.partnerRef || "-"}
              </span>
            </div>

            <div>
              <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Mitra / Supplier
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 block flex items-center">
                <User className="h-4 w-4 mr-1.5 text-slate-400 shrink-0" />
                {orderDetail.partner || "-"}
              </span>
            </div>

            <div>
              <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Entitas Perusahaan (Company)
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 block flex items-center">
                <Building2 className="h-4 w-4 mr-1.5 text-slate-400 shrink-0" />
                {orderDetail.companyName || "-"}
              </span>
            </div>

            <div>
              <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Tanggal Order
              </span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 block flex items-center">
                <Calendar className="h-4 w-4 mr-1.5 text-slate-400 shrink-0" />
                {orderDetail.dateOrder
                  ? new Date(orderDetail.dateOrder).toLocaleString("id-ID")
                  : "-"}
              </span>
            </div>

            <div>
              <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Tanggal Persetujuan (Approve)
              </span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 block flex items-center">
                <Clock className="h-4 w-4 mr-1.5 text-slate-400 shrink-0" />
                {orderDetail.dateApprove
                  ? new Date(orderDetail.dateApprove).toLocaleString("id-ID")
                  : "-"}
              </span>
            </div>

            {orderDetail.datePlanned && (
              <div>
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Tanggal Direncanakan (Planned)
                </span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 block flex items-center">
                  <Calendar className="h-4 w-4 mr-1.5 text-slate-400 shrink-0" />
                  {new Date(orderDetail.datePlanned).toLocaleString("id-ID")}
                </span>
              </div>
            )}

            <div>
              <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Terakhir Disinkronkan
              </span>
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 mt-1 block">
                {orderDetail.lastSyncedAt
                  ? new Date(orderDetail.lastSyncedAt).toLocaleString("id-ID")
                  : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Ringkasan Finansial Nilai PO */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center">
            <DollarSign className="h-4.5 w-4.5 mr-2 text-emerald-600 shrink-0" />
            Nilai Finansial
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Mata Uang
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                {orderDetail.currencyName || "IDR"}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Nilai Sebelum Pajak (Untaxed)
              </span>
              <span className="text-base font-semibold font-mono text-slate-700 dark:text-slate-300 mt-0.5 block">
                {formatCurrency(orderDetail.amountUntaxed, orderDetail.currencyName)}
              </span>
            </div>

            <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                Total Nilai (Amount Total)
              </span>
              <span className="text-xl font-black font-mono text-emerald-800 dark:text-emerald-300 mt-1 block">
                {formatCurrency(orderDetail.amountTotal, orderDetail.currencyName)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Table Product Lines */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center">
            <Boxes className="h-5 w-5 mr-2 text-purple-600 shrink-0" />
            Rincian Baris Produk (Product Lines)
          </h3>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {orderDetail.products?.length || 0} Item
          </span>
        </div>

        {!orderDetail.products || orderDetail.products.length === 0 ? (
          <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm italic">
            Tidak ada baris produk pada dokumen PO ini.
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-3.5 w-[30%]">Nama Produk</th>
                    <th className="px-5 py-3.5 w-[25%]">Pos Anggaran (Budget Activity)</th>
                    <th className="px-5 py-3.5 text-right w-[10%]">Kuantitas</th>
                    <th className="px-5 py-3.5 text-center w-[8%]">Satuan (UoM)</th>
                    <th className="px-5 py-3.5 text-right w-[13%]">Harga Satuan</th>
                    <th className="px-5 py-3.5 text-right w-[14%]">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                  {orderDetail.products.map((p: any, idx: number) => (
                    <tr
                      key={p.uuid || idx}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition"
                    >
                      <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-slate-100">
                        {p.productName}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px]">
                        {p.budgetActivityName ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                            {p.budgetActivityName}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-850 dark:text-slate-100 font-mono">
                        {p.productQty?.toLocaleString("id-ID")}
                      </td>
                      <td className="px-5 py-3.5 text-center font-bold text-purple-600 dark:text-purple-400 uppercase">
                        {p.productUom || "Unit"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatCurrency(p.priceUnit, orderDetail.currencyName)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-black font-mono text-slate-900 dark:text-slate-100">
                        {formatCurrency(p.priceTotal, orderDetail.currencyName)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Raw JSON Viewer (Accordion / Collapsible) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setIsRawJsonOpen(!isRawJsonOpen)}
          className="w-full px-6 py-4 flex items-center justify-between text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer select-none border-b border-transparent data-[open=true]:border-slate-200 dark:data-[open=true]:border-slate-800"
          data-open={isRawJsonOpen}
        >
          <div className="flex items-center space-x-2">
            <Terminal className="h-4.5 w-4.5 text-purple-600" />
            <span>Raw JSON Viewer (Snapshot Odoo)</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-400 font-normal">
              {isRawJsonOpen ? "Tutup" : "Lihat JSON"}
            </span>
            {isRawJsonOpen ? (
              <ChevronUp className="h-4.5 w-4.5 text-slate-400" />
            ) : (
              <ChevronDown className="h-4.5 w-4.5 text-slate-400" />
            )}
          </div>
        </button>

        {isRawJsonOpen && (
          <div className="relative">
            <div className="absolute top-3 right-4 z-10">
              <button
                type="button"
                onClick={handleCopyJson}
                className="flex items-center px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold shadow transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                    Tersalin!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Salin JSON
                  </>
                )}
              </button>
            </div>
            <div className="p-6 bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-[450px] leading-relaxed select-all">
              <pre>
                {orderDetail.rawJson
                  ? JSON.stringify(orderDetail.rawJson, null, 2)
                  : "{}"}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

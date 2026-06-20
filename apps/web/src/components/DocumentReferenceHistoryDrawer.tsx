import React from "react";
import { X, FileText, ExternalLink, Clock, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useErpDocumentRealizationHistory } from "@/hooks/useErpDocuments";

interface DocumentReferenceHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  docRefUuid?: string | null;
  documentNumber?: string;
  preloadedHistory?: {
    otherOperations?: any[];
    summary?: any[];
  } | null;
}

export function DocumentReferenceHistoryDrawer({
  isOpen,
  onClose,
  docRefUuid,
  documentNumber,
  preloadedHistory,
}: DocumentReferenceHistoryDrawerProps) {
  // Use SWR if docRefUuid is provided, otherwise fall back to preloadedHistory
  const { data: fetchedHistory, isLoading } = useErpDocumentRealizationHistory(
    docRefUuid || null
  );

  const history = preloadedHistory || fetchedHistory;

  if (!isOpen) return null;

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <div className="flex items-center text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            <Clock className="h-3 w-3 mr-1 animate-pulse" />
            Pending
          </div>
        );
      case "REJECTED":
        return (
          <div className="flex items-center text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </div>
        );
      case "PARTIAL":
        return (
          <div className="flex items-center text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            <Clock className="h-3 w-3 mr-1" />
            Partial
          </div>
        );
      case "COMPLETED":
        return (
          <div className="flex items-center text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </div>
        );
      case "VERIFIED":
        return (
          <div className="flex items-center text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Verified
          </div>
        );
      case "CANCELED":
        return (
          <div className="flex items-center text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            <XCircle className="h-3 w-3 mr-1" />
            Canceled
          </div>
        );
      default:
        return (
          <div className="flex items-center text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            {status}
          </div>
        );
    }
  };

  const getBadgeClass = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "PARTIAL":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col z-10 animate-slide-in-right">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-indigo-500 shrink-0" />
              Riwayat Realisasi Dokumen ERP
            </h3>
            {documentNumber && (
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Dokumen ERP: {documentNumber}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-24">
              <svg
                className="animate-spin h-8 w-8 text-indigo-500"
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
          ) : !history ? (
            <p className="text-sm text-slate-500 italic text-center py-12">
              Tidak ada data riwayat realisasi.
            </p>
          ) : (
            <>
              {/* Other Operations List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Tiket Terkait
                </h4>
                {history.otherOperations && history.otherOperations.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {history.otherOperations.map((op: any, index: number) => (
                      <Link
                        key={index}
                        href={`/gate-operations/${op.uuid}`}
                        onClick={onClose}
                        className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 rounded-xl transition group"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-800 font-mono group-hover:text-indigo-700 transition">
                            {op.opNumber}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Driver: {op.driverName} • {op.licensePlate}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusDisplay(op.status)}
                          <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-500 transition shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Tidak ada tiket terkait lainnya.
                  </p>
                )}
              </div>

              {/* Realization Summary Per Product */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Ringkasan Kuantitas Dokumen ERP
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3 text-center">UoM</th>
                        <th className="px-4 py-3 text-right">ERP Qty</th>
                        <th className="px-4 py-3 text-right">Realized Qty</th>
                        <th className="px-4 py-3 text-right">Unrealized Qty</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {history.summary?.map((item: any, idx: number) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/20 transition-all duration-150"
                        >
                          <td className="px-4 py-3.5 font-bold text-slate-800">
                            {item.productName}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">
                            {item.sku}
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-slate-600">
                            {item.uom}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-slate-500">
                            {item.erpQty.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-slate-800">
                            {item.realizedQty.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-slate-900">
                            {item.remainingQty.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getBadgeClass(
                                item.status
                              )}`}
                            >
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

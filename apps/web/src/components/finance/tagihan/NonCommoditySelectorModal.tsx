"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  X,
  Check,
  Receipt,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useNonCommodityOrders } from "@/hooks/useNonCommodityOrders";
import { useDebounce } from "@/hooks/useDebounce";

interface NonCommoditySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (orders: any[]) => void;
  alreadySelectedDocs: any[];
}

export function NonCommoditySelectorModal({
  isOpen,
  onClose,
  onSelect,
  alreadySelectedDocs,
}: NonCommoditySelectorModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [page, setPage] = useState(1);

  const [selectedMap, setSelectedMap] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (isOpen) {
      const map = new Map<string, any>();
      alreadySelectedDocs.forEach((d) => {
        if (d.uuid) map.set(d.uuid, d);
      });
      setSelectedMap(map);
    }
  }, [isOpen, alreadySelectedDocs]);

  const { ordersData, isLoading } = useNonCommodityOrders({
    search: debouncedSearch || undefined,
    page,
    limit: 10,
  });

  const orders = ordersData?.data || [];
  const meta = ordersData?.meta || { total: 0, totalPages: 1 };

  const handleToggle = (order: any) => {
    const newMap = new Map(selectedMap);
    if (newMap.has(order.uuid)) {
      newMap.delete(order.uuid);
    } else {
      newMap.set(order.uuid, order);
    }
    setSelectedMap(newMap);
  };

  const handleApply = () => {
    onSelect(Array.from(selectedMap.values()));
    onClose();
  };

  const formatCurrency = (val: number, curr = "IDR") => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: curr || "IDR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-600" />
              Pilih Dokumen Non-Commodity (PO)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pilih satu atau beberapa dokumen Purchase Order Non-Commodity • Terpilih:{" "}
              <strong>{selectedMap.size} dokumen</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No. Dokumen PO, Nama Mitra, Partner Ref..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-3 min-h-[250px]">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs">
              <Receipt className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              Tidak ada dokumen Purchase Order Non-Commodity yang ditemukan.
            </div>
          ) : (
            <div className="space-y-2.5">
              {orders.map((po: any) => {
                const isSelected = selectedMap.has(po.uuid);
                const formattedDate = po.dateOrder
                  ? new Date(po.dateOrder).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "-";

                return (
                  <div
                    key={po.uuid}
                    onClick={() => handleToggle(po)}
                    className={`p-3 rounded-xl border transition cursor-pointer select-none flex items-start gap-3 ${
                      isSelected
                        ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                        : "bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="pt-0.5">
                      <div
                        className={`h-5 w-5 rounded-md flex items-center justify-center border transition ${
                          isSelected
                            ? "bg-amber-600 border-amber-600 text-white"
                            : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                          {po.documentNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {formatCurrency(po.amountTotal, po.currencyName)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
                        <span className="truncate max-w-[300px]">
                          Mitra: <strong>{po.partner || "-"}</strong>
                          {po.partnerRef && ` • Ref: ${po.partnerRef}`}
                        </span>
                        <span className="text-[11px] flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formattedDate}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(Math.max(1, page - 1))}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
              Halaman {page} / {meta.totalPages || 1}
            </span>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition cursor-pointer"
            >
              Terapkan ({selectedMap.size} Terpilih)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

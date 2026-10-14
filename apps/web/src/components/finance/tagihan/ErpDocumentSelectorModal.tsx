"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  X,
  Check,
  AlertCircle,
  FileCheck2,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useErpCandidates } from "@/hooks/useTagihan";
import { useDebounce } from "@/hooks/useDebounce";
import { validateTagihanTypeRules, type TagihanType } from "@bulog-wms/schema";

interface ErpDocumentSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (docs: any[]) => void;
  tagihanType: TagihanType;
  alreadySelectedDocs: any[];
}

export function ErpDocumentSelectorModal({
  isOpen,
  onClose,
  onSelect,
  tagihanType,
  alreadySelectedDocs,
}: ErpDocumentSelectorModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);

  const [pickingTypeCode, setPickingTypeCode] = useState("");
  const [productName, setProductName] = useState("");
  const [month, setMonth] = useState("");
  const [refFax, setRefFax] = useState("");
  const [page, setPage] = useState(1);

  // Local selection state inside the modal
  const [selectedDocsMap, setSelectedDocsMap] = useState<Map<string, any>>(new Map());
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Sync initially selected docs when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const map = new Map<string, any>();
      alreadySelectedDocs.forEach((d) => {
        if (d.uuid) map.set(d.uuid, d);
      });
      setSelectedDocsMap(map);
      setRuleError(null);
    }
  }, [isOpen, alreadySelectedDocs]);

  // Query candidate documents
  const { candidatesData, isLoading } = useErpCandidates({
    tagihanType,
    search: debouncedSearch || undefined,
    pickingTypeCode: pickingTypeCode || undefined,
    productName: productName || undefined,
    month: month || undefined,
    refFax: refFax || undefined,
    page,
    limit: 10,
  });

  const candidates = candidatesData?.data || [];
  const meta = candidatesData?.meta || { total: 0, totalPages: 1 };

  const handleToggleDoc = (doc: any) => {
    setRuleError(null);
    const newMap = new Map(selectedDocsMap);

    if (newMap.has(doc.uuid)) {
      newMap.delete(doc.uuid);
      setSelectedDocsMap(newMap);
      return;
    }

    // Test adding the doc against Tagihan Type rules
    const candidateList = Array.from(newMap.values()).concat(doc);
    const validation = validateTagihanTypeRules(tagihanType, candidateList);

    if (!validation.isValid) {
      setRuleError(validation.error || "Dokumen tidak memenuhi aturan Tagihan.");
      return;
    }

    newMap.set(doc.uuid, doc);
    setSelectedDocsMap(newMap);
  };

  const handleApply = () => {
    onSelect(Array.from(selectedDocsMap.values()));
    onClose();
  };

  const formatPickingTypeBadge = (code: string) => {
    const c = (code || "").toLowerCase();
    if (c === "incoming") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-400">
          IN (Incoming)
        </span>
      );
    }
    if (c === "outgoing") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-blue-400">
          OUT (Outgoing)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/30 dark:border-purple-900/40 dark:text-purple-400">
        INT (Internal)
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-emerald-600" />
              Pilih Dokumen ERP Commodity
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tipe Tagihan:{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {tagihanType}
              </span>{" "}
              • Terpilih: <strong>{selectedDocsMap.size} dokumen</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Validation Warning Alert */}
        {ruleError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            <span>{ruleError}</span>
          </div>
        )}

        {/* Filter Bar */}
        <div className="p-6 pb-2 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari No. Dokumen, Partner, Origin..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Picking Type Filter */}
            <div>
              <select
                value={pickingTypeCode}
                onChange={(e) => {
                  setPickingTypeCode(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
              >
                <option value="">Semua Tipe Picking</option>
                <option value="IN">IN (Incoming)</option>
                <option value="OUT">OUT (Outgoing)</option>
                <option value="INT">INT (Internal)</option>
              </select>
            </div>

            {/* Month Filter */}
            <div>
              <input
                type="month"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Commodity/Product filter */}
            <div>
              <input
                type="text"
                placeholder="Filter Komoditas / Produk (misal: Beras, Gula)..."
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* refFax Filter */}
            <div>
              <input
                type="text"
                placeholder="Filter Ref Fax..."
                value={refFax}
                onChange={(e) => {
                  setRefFax(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Candidate List Table */}
        <div className="flex-1 overflow-y-auto px-6 py-3 min-h-[300px]">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs">
              <Layers className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              Tidak ada dokumen ERP yang cocok dengan filter dan aturan tipe{" "}
              <strong>{tagihanType}</strong>.
            </div>
          ) : (
            <div className="space-y-2.5">
              {candidates.map((doc: any) => {
                const isSelected = selectedDocsMap.has(doc.uuid);
                const itemsSummary = (doc.items || [])
                  .map((it: any) => `${it.productName} (${it.quantity} ${it.uom || "UNIT"})`)
                  .join(", ");

                const formattedDate = doc.scheduledDate
                  ? new Date(doc.scheduledDate).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "-";

                return (
                  <div
                    key={doc.uuid}
                    onClick={() => handleToggleDoc(doc)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer select-none flex items-start gap-3 ${
                      isSelected
                        ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                        : "bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="pt-0.5">
                      <div
                        className={`h-5 w-5 rounded-md flex items-center justify-center border transition ${
                          isSelected
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                          {doc.documentNumber}
                        </span>
                        {formatPickingTypeBadge(doc.pickingTypeCode)}
                        {doc.refFax && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-400">
                            Fax: {doc.refFax}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-auto flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formattedDate}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-300 gap-2">
                        <span className="truncate max-w-[320px]">
                          Mitra: <strong>{doc.partnerName || "Tanpa Mitra"}</strong>
                          {doc.origin && ` • Origin: ${doc.origin}`}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Total Qty: {Number(doc.totalQuantity || 0).toLocaleString("id-ID")}
                        </span>
                      </div>

                      {itemsSummary && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Komoditas: {itemsSummary}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer with Pagination and Confirm */}
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
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              Terapkan ({selectedDocsMap.size} Terpilih)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

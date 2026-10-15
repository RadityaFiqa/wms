"use client";

import React, { useState, useMemo } from "react";
import {
  FileCheck2,
  Receipt,
  FileText,
  Plus,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getSecondaryQty,
  getSecondaryUnit,
  formatSecondaryQty,
} from "@/lib/quantity";
import type { TagihanType } from "@bulog-wms/schema";

export interface ManualDocItem {
  id: string;
  documentNumber: string;
  description?: string;
}

interface SkuInfo {
  sku: string;
  name: string;
}

/**
 * Extracts unique SKUs and commodity names from selected ERP documents.
 */
export function extractUniqueSkus(documents: any[]): SkuInfo[] {
  const map = new Map<string, string>();

  for (const doc of documents) {
    for (const item of doc.items || []) {
      const pName = (item.productName || item.name || "").trim();
      const directSku = (
        item.sku ||
        item.productCode ||
        item.defaultCode ||
        ""
      ).trim();

      if (directSku) {
        if (!map.has(directSku)) {
          map.set(directSku, pName || directSku);
        }
      } else {
        // Match pattern "[SKU] Product Name"
        const match = pName.match(/^\[(.*?)\]\s*(.*)$/);
        if (match) {
          const skuCode = match[1].trim();
          const cleanName = match[2].trim() || skuCode;
          if (!map.has(skuCode)) {
            map.set(skuCode, cleanName);
          }
        } else if (item.inventoryId) {
          const key = `ITEM-${item.inventoryId}`;
          if (!map.has(key)) {
            map.set(key, pName || key);
          }
        } else if (pName) {
          if (!map.has(pName)) {
            map.set(pName, pName);
          }
        }
      }
    }
  }

  return Array.from(map.entries()).map(([sku, name]) => ({ sku, name }));
}

interface RelatedDocumentsManagerProps {
  type: TagihanType;
  selectedErpDocs: any[];
  selectedPoDocs: any[];
  manualDocs: ManualDocItem[];
  onRemoveErpDoc?: (uuid: string) => void;
  onRemovePoDoc?: (uuid: string) => void;
  onAddManualDoc?: () => void;
  onUpdateManualDoc?: (
    id: string,
    field: "documentNumber" | "description",
    val: string,
  ) => void;
  onRemoveManualDoc?: (id: string) => void;
  onOpenErpModal?: () => void;
  onOpenPoModal?: () => void;
  readOnly?: boolean;
}

export function RelatedDocumentsManager({
  type,
  selectedErpDocs,
  selectedPoDocs,
  manualDocs,
  onRemoveErpDoc,
  onRemovePoDoc,
  onAddManualDoc,
  onUpdateManualDoc,
  onRemoveManualDoc,
  onOpenErpModal,
  onOpenPoModal,
  readOnly = false,
}: RelatedDocumentsManagerProps) {
  // Tab state: 'erp' | 'po' | 'manual'
  const [activeTab, setActiveTab] = useState<"erp" | "po" | "manual">("erp");

  // Collapsible state for ERP Commodity table (default max 10 rows)
  const [isErpExpanded, setIsErpExpanded] = useState(false);

  // Format currency helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Format date helper
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "-";
      return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  // SKU detection for Loading & Unloading
  const detectedSkus = useMemo(() => {
    return extractUniqueSkus(selectedErpDocs);
  }, [selectedErpDocs]);

  const showSkuWarning =
    (type === "LOADING" || type === "UNLOADING") && detectedSkus.length > 1;

  // ERP Commodity summary totals (calculated across all documents)
  const { erpPrimaryUomSummary, erpSecondaryUnitSummary } = useMemo(() => {
    const primaryMap = new Map<string, number>();
    const secondaryMap = new Map<string, number>();

    for (const doc of selectedErpDocs) {
      for (const item of doc.items || []) {
        const primQty = Number(item.quantity || item.productQty || 0);
        const primUom = (item.uom || "UNIT").trim().toUpperCase();
        const secQty = getSecondaryQty(primQty, item.uom);
        const secUnit = getSecondaryUnit(item.uom);

        primaryMap.set(primUom, (primaryMap.get(primUom) || 0) + primQty);
        secondaryMap.set(
          secUnit,
          (secondaryMap.get(secUnit) || 0) + secQty,
        );
      }
    }

    const primaryArr: string[] = [];
    primaryMap.forEach((qty, uom) => {
      primaryArr.push(
        `${qty.toLocaleString("id-ID", { maximumFractionDigits: 3 })} ${uom}`,
      );
    });

    const secondaryArr: string[] = [];
    secondaryMap.forEach((qty, unit) => {
      secondaryArr.push(
        `${qty.toLocaleString("id-ID", { maximumFractionDigits: 3 })} ${unit}`,
      );
    });

    return {
      erpPrimaryUomSummary: primaryArr.length > 0 ? primaryArr.join(" • ") : "-",
      erpSecondaryUnitSummary:
        secondaryArr.length > 0 ? secondaryArr.join(" • ") : "-",
    };
  }, [selectedErpDocs]);

  // Non-Commodity summary total
  const totalPoAmount = useMemo(() => {
    return selectedPoDocs.reduce(
      (sum, po) => sum + (Number(po.amountTotal) || 0),
      0,
    );
  }, [selectedPoDocs]);

  // Displayed ERP docs based on collapsible state
  const displayedErpDocs = useMemo(() => {
    if (isErpExpanded || selectedErpDocs.length <= 10) {
      return selectedErpDocs;
    }
    return selectedErpDocs.slice(0, 10);
  }, [selectedErpDocs, isErpExpanded]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Dokumen Terkait (Related Documents)
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Dikelompokkan berdasarkan sumber dokumen: ERP Commodity, Non
            Commodity, atau Manual
          </p>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("erp")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${activeTab === "erp"
              ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            <span>ERP Commodity</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "erp"
                ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-extrabold"
                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
            >
              {selectedErpDocs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("po")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${activeTab === "po"
              ? "bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Non Commodity</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "po"
                ? "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-extrabold"
                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
            >
              {selectedPoDocs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${activeTab === "manual"
              ? "bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Manual</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "manual"
                ? "bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 font-extrabold"
                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
            >
              {manualDocs.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: ERP COMMODITY */}
      {activeTab === "erp" && (
        <div className="space-y-3">
          {/* Multiple SKU Warning Alert (Requirement 2.7) */}
          {showSkuWarning && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200 animate-in fade-in">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="font-bold block">
                  Perhatian: Terdapat perbedaan SKU pada dokumen ERP Commodity
                  yang dipilih.
                </strong>
                <p className="text-[11px] leading-relaxed">
                  SKU yang terdeteksi:{" "}
                  <span className="font-bold">
                    {detectedSkus
                      .map((s) => `${s.sku} (${s.name})`)
                      .join(", ")}
                  </span>
                  . Pastikan kombinasi komoditas sudah sesuai dengan tagihan.
                </p>
              </div>
            </div>
          )}

          {/* Table Action Bar */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Menjadi dasar perhitungan kuantum tagihan summary
            </span>
            {!readOnly && onOpenErpModal && (
              <button
                type="button"
                onClick={onOpenErpModal}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300 transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Pilih Dokumen ERP
              </button>
            )}
          </div>

          {/* ERP Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">No. Dokumen</th>
                  <th className="py-2.5 px-3">Jenis</th>
                  <th className="py-2.5 px-3">SKU / Komoditas</th>
                  <th className="py-2.5 px-3 text-right">Qty Primer</th>
                  <th className="py-2.5 px-3">UOM</th>
                  <th className="py-2.5 px-3 text-right">Secondary Qty</th>
                  {!readOnly && <th className="py-2.5 px-3 text-center w-12">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {selectedErpDocs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={readOnly ? 8 : 9}
                      className="py-8 text-center text-slate-400"
                    >
                      Belum ada dokumen ERP Commodity yang dipilih.
                    </td>
                  </tr>
                ) : (
                  displayedErpDocs.map((doc, idx) => {
                    const firstItem = doc.items?.[0];
                    const itemQty = Number(
                      firstItem?.quantity ||
                      firstItem?.productQty ||
                      doc.totalQuantity ||
                      0,
                    );
                    const itemUom = firstItem?.uom || "UNIT";
                    const pCode = (doc.pickingTypeCode || "").toLowerCase();

                    return (
                      <tr
                        key={doc.uuid || doc.id || idx}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatDate(doc.dateDone || doc.scheduledDate)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {doc.documentNumber}
                          {doc.refFax && (
                            <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                              Fax: {doc.refFax}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${pCode === "incoming"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : pCode === "outgoing"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                                : "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300"
                              }`}
                          >
                            {pCode === "incoming"
                              ? "IN"
                              : pCode === "outgoing"
                                ? "OUT"
                                : "INT"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                          {doc.items && doc.items.length > 0
                            ? doc.items.map((i: any) => i.productName).join(", ")
                            : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {itemQty.toLocaleString("id-ID", {
                            maximumFractionDigits: 3,
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-medium">
                          {itemUom}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatSecondaryQty(itemQty, itemUom)}
                        </td>
                        {!readOnly && (
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => onRemoveErpDoc?.(doc.uuid)}
                              className="p-1 rounded text-slate-400 hover:text-red-600 transition cursor-pointer"
                              title="Hapus dokumen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Footer / Summary (Calculated from ALL rows) */}
              {selectedErpDocs.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-800/90 border-t-2 border-slate-200 dark:border-slate-700 font-semibold text-xs">
                  <tr>
                    <td
                      colSpan={5}
                      className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-bold whitespace-nowrap"
                    >
                      Total Dokumen: {selectedErpDocs.length} Dokumen
                    </td>
                    <td
                      colSpan={2}
                      className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap"
                    >
                      <div className="flex flex-row items-center justify-end gap-1.5 whitespace-nowrap">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Primer:
                        </span>
                        <span>{erpPrimaryUomSummary}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                      <div className="flex flex-row items-center justify-end gap-1.5 whitespace-nowrap">
                        <span className="text-[10px] text-emerald-600/70 font-bold uppercase tracking-wider">
                          Sekunder:
                        </span>
                        <span>{erpSecondaryUnitSummary}</span>
                      </div>
                    </td>
                    {!readOnly && <td className="py-2.5 px-3"></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Collapsible Toggle Control (Requirement 2.3) */}
          {selectedErpDocs.length > 10 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Menampilkan{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {displayedErpDocs.length}
                </strong>{" "}
                dari{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {selectedErpDocs.length}
                </strong>{" "}
                dokumen
              </span>
              <button
                type="button"
                onClick={() => setIsErpExpanded((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isErpExpanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Tampilkan Lebih Sedikit (Show Less)
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Tampilkan Semua ({selectedErpDocs.length}) (Show More)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: NON-COMMODITY PO */}
      {activeTab === "po" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Dokumen Purchase Order (PO) Non-Commodity dari Odoo
            </span>
            {!readOnly && onOpenPoModal && (
              <button
                type="button"
                onClick={onOpenPoModal}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300 transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Pilih Dokumen PO
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">No. Dokumen PO</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Mitra / Rekanan</th>
                  <th className="py-2.5 px-3 text-right">Total Nilai</th>
                  {!readOnly && <th className="py-2.5 px-3 text-center w-12">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {selectedPoDocs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={readOnly ? 6 : 7}
                      className="py-8 text-center text-slate-400"
                    >
                      Belum ada dokumen PO Non-Commodity yang dipilih.
                    </td>
                  </tr>
                ) : (
                  selectedPoDocs.map((po, idx) => (
                    <tr
                      key={po.uuid || po.id || idx}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatDate(po.dateOrder || po.createDate)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {po.documentNumber}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          {po.state || "purchase"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        {po.partner || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatCurrency(po.amountTotal)}
                      </td>
                      {!readOnly && (
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onRemovePoDoc?.(po.uuid)}
                            className="p-1 rounded text-slate-400 hover:text-red-600 transition cursor-pointer"
                            title="Hapus dokumen PO"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>

              {selectedPoDocs.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-800/90 border-t-2 border-slate-200 dark:border-slate-700 font-semibold text-xs">
                  <tr>
                    <td
                      colSpan={5}
                      className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-bold"
                    >
                      Total Dokumen PO: {selectedPoDocs.length} Dokumen
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                      {formatCurrency(totalPoAmount)}
                    </td>
                    {!readOnly && <td className="py-2.5 px-3"></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MANUAL DOCUMENTS */}
      {activeTab === "manual" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Dokumen referensi manual yang diinput langsung oleh pengguna
            </span>
            {!readOnly && onAddManualDoc && (
              <button
                type="button"
                onClick={onAddManualDoc}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 dark:bg-purple-950/40 dark:border-purple-900 dark:text-purple-300 transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Baris Manual
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3 w-1/3">
                    No. Dokumen / Referensi <span className="text-red-500">*</span>
                  </th>
                  <th className="py-2.5 px-3">Deskripsi / Keterangan</th>
                  {!readOnly && <th className="py-2.5 px-3 text-center w-12">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {manualDocs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={readOnly ? 3 : 4}
                      className="py-8 text-center text-slate-400"
                    >
                      Belum ada dokumen manual yang ditambahkan.
                    </td>
                  </tr>
                ) : (
                  manualDocs.map((m, idx) => (
                    <tr
                      key={m.id || idx}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        {!readOnly ? (
                          <input
                            type="text"
                            placeholder="Contoh: REF/MANUAL/001"
                            value={m.documentNumber}
                            onChange={(e) =>
                              onUpdateManualDoc?.(
                                m.id,
                                "documentNumber",
                                e.target.value,
                              )
                            }
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono font-medium focus:outline-none focus:border-purple-500"
                            required
                          />
                        ) : (
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {m.documentNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {!readOnly ? (
                          <input
                            type="text"
                            placeholder="Keterangan opsional..."
                            value={m.description || ""}
                            onChange={(e) =>
                              onUpdateManualDoc?.(
                                m.id,
                                "description",
                                e.target.value,
                              )
                            }
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-purple-500"
                          />
                        ) : (
                          <span className="text-slate-600 dark:text-slate-400">
                            {m.description || "-"}
                          </span>
                        )}
                      </td>
                      {!readOnly && (
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onRemoveManualDoc?.(m.id)}
                            className="p-1 rounded text-slate-400 hover:text-red-600 transition cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>

              {manualDocs.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-800/90 border-t-2 border-slate-200 dark:border-slate-700 font-semibold text-xs">
                  <tr>
                    <td
                      colSpan={readOnly ? 3 : 4}
                      className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-bold"
                    >
                      Total Dokumen Manual: {manualDocs.length} Baris
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

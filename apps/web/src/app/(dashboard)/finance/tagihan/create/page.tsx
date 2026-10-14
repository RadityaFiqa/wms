"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Loader2,
  FileCheck2,
  Receipt,
  FileText,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  Tag,
  Paperclip,
} from "lucide-react";
import {
  createTagihan,
  uploadTagihanFile,
  useMasterTagihanStatuses,
} from "@/hooks/useTagihan";
import { ErpDocumentSelectorModal } from "@/components/finance/tagihan/ErpDocumentSelectorModal";
import { NonCommoditySelectorModal } from "@/components/finance/tagihan/NonCommoditySelectorModal";
import { CreateStatusModal } from "@/components/finance/tagihan/CreateStatusModal";
import { TagihanSummaryTable } from "@/components/finance/tagihan/TagihanSummaryTable";
import { TagihanFilesManager } from "@/components/finance/tagihan/TagihanFilesManager";
import { validateTagihanTypeRules, type TagihanType } from "@bulog-wms/schema";

interface ManualDocItem {
  id: string;
  documentNumber: string;
  description: string;
}

export default function CreateTagihanPage() {
  const router = useRouter();

  // Basic Form State
  const [type, setType] = useState<TagihanType>("LOADING");
  const [documentNumber, setDocumentNumber] = useState("");
  const [statusUuid, setStatusUuid] = useState<string>("");
  const [tagihanDate, setTagihanDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  });
  const [notes, setNotes] = useState("");

  // Related Documents State
  const [selectedErpDocs, setSelectedErpDocs] = useState<any[]>([]);
  const [selectedPoDocs, setSelectedPoDocs] = useState<any[]>([]);
  const [manualDocs, setManualDocs] = useState<ManualDocItem[]>([]);

  // Summary Costs: Map key `${docType}__${uom}` => costPerUnit
  const [costs, setCosts] = useState<Record<string, number>>({});

  // Supporting Files staged locally
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  // Modals
  const [isErpModalOpen, setIsErpModalOpen] = useState(false);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Statuses list
  const { statuses, refresh: refreshStatuses } = useMasterTagihanStatuses();

  // Form submission & error state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Select default status when statuses load
  React.useEffect(() => {
    if (!statusUuid && statuses.length > 0) {
      const def = statuses.find((s) => s.isDefault);
      if (def) setStatusUuid(def.uuid);
      else setStatusUuid(statuses[0].uuid);
    }
  }, [statuses, statusUuid]);

  // Handle Type Change & rule re-verification
  const handleTypeChange = (newType: TagihanType) => {
    setType(newType);
    if (selectedErpDocs.length > 0) {
      const val = validateTagihanTypeRules(newType, selectedErpDocs);
      if (!val.isValid) {
        setError(
          `Peringatan: Dokumen ERP yang telah dipilih tidak memenuhi aturan tipe ${newType}: ${val.error}. Silakan sesuaikan pilihan dokumen ERP.`,
        );
      } else {
        setError(null);
      }
    }
  };

  // ERP selection handler
  const handleSelectErpDocs = (docs: any[]) => {
    setSelectedErpDocs(docs);
    const val = validateTagihanTypeRules(type, docs);
    if (!val.isValid) {
      setError(val.error || "Dokumen ERP tidak memenuhi aturan tipe tagihan.");
    } else {
      setError(null);
    }
  };

  const handleCostChange = (key: string, cost: number) => {
    setCosts((prev) => ({ ...prev, [key]: cost }));
  };

  // Manual document helpers
  const handleAddManualDoc = () => {
    setManualDocs((prev) => [
      ...prev,
      { id: String(Date.now()), documentNumber: "", description: "" },
    ]);
  };

  const handleUpdateManualDoc = (
    id: string,
    field: "documentNumber" | "description",
    value: string,
  ) => {
    setManualDocs((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    );
  };

  const handleRemoveManualDoc = (id: string) => {
    setManualDocs((prev) => prev.filter((m) => m.id !== id));
  };

  // Rule summary description helper
  const getTypeRuleDescription = (t: TagihanType) => {
    switch (t) {
      case "LOADING":
        return "Aturan ERP: Dokumen OUT (outgoing) saja, komoditas/produk yang sama, dalam bulan yang sama.";
      case "UNLOADING":
        return "Aturan ERP: Dokumen IN (incoming) saja, komoditas/produk yang sama, dalam bulan yang sama.";
      case "REBAGGING":
        return "Aturan ERP: Dokumen IN & OUT, wajib memiliki Ref Fax yang sama.";
      case "REPROSES":
        return "Aturan ERP: Dokumen IN & OUT, wajib memiliki Ref Fax yang sama.";
      case "OVERSTAPEL":
        return "Aturan ERP: Dokumen INT (internal transfer) saja.";
      default:
        return "";
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!documentNumber.trim()) {
      setError("Nomor Dokumen / SDI wajib diisi.");
      return;
    }

    // Validate Tagihan Type Rules if ERP docs selected
    if (selectedErpDocs.length > 0) {
      const val = validateTagihanTypeRules(type, selectedErpDocs);
      if (!val.isValid) {
        setError(val.error || "Dokumen ERP tidak memenuhi aturan tipe tagihan.");
        return;
      }
    }

    // Check manual documents
    for (const m of manualDocs) {
      if (!m.documentNumber.trim()) {
        setError("Semua baris Dokumen Manual wajib memiliki Nomor Dokumen.");
        return;
      }
    }

    // Build summaries payload
    // Group selected ERP docs
    const summaryMap = new Map<string, { documentType: string; uom: string; quantity: number }>();
    for (const doc of selectedErpDocs) {
      const code = (doc.pickingTypeCode || "").toLowerCase();
      let docType = "INT";
      if (code === "incoming") docType = "IN";
      else if (code === "outgoing") docType = "OUT";

      for (const it of doc.items || []) {
        const uom = (it.uom || "UNIT").trim().toUpperCase();
        const key = `${docType}__${uom}`;
        if (!summaryMap.has(key)) {
          summaryMap.set(key, { documentType: docType, uom, quantity: 0 });
        }
        summaryMap.get(key)!.quantity += Number(it.quantity || it.productQty || 0);
      }
    }

    const summariesPayload: Array<{
      documentType: string;
      uom: string;
      quantity: number;
      costPerUnit: number;
      subtotal: number;
    }> = [];

    summaryMap.forEach((val, key) => {
      const costPerUnit = costs[key] ?? 0;
      const subtotal = val.quantity * costPerUnit;
      summariesPayload.push({
        documentType: val.documentType,
        uom: val.uom,
        quantity: Math.round(val.quantity * 1000) / 1000,
        costPerUnit,
        subtotal: Math.round(subtotal * 100) / 100,
      });
    });

    setIsSubmitting(true);

    try {
      const created = await createTagihan({
        documentNumber: documentNumber.trim(),
        type,
        statusUuid: statusUuid || undefined,
        tagihanDate: tagihanDate ? new Date(tagihanDate).toISOString() : undefined,
        notes: notes.trim() || undefined,
        erpDocumentUuids: selectedErpDocs.map((d) => d.uuid),
        nonCommodityDocumentUuids: selectedPoDocs.map((d) => d.uuid),
        manualDocuments: manualDocs.map((m) => ({
          documentNumber: m.documentNumber.trim(),
          description: m.description?.trim() || undefined,
        })),
        summaries: summariesPayload,
      });

      // Upload staged files if any
      if (stagedFiles.length > 0 && created?.uuid) {
        for (const file of stagedFiles) {
          try {
            await uploadTagihanFile(created.uuid, file);
          } catch (fileErr) {
            console.error("Gagal mengunggah file pendukung:", fileErr);
          }
        }
      }

      router.push(`/finance/tagihan/${created.uuid}`);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err.message || "Gagal membuat Tagihan baru.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/finance/tagihan"
          className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Daftar Tagihan
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
          <FileText className="h-7 w-7 text-emerald-600" />
          Buat Tagihan Baru
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Lengkapi informasi tagihan, pilih dokumen terkait, dan atur tarif unit.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start gap-3 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block font-bold">Terjadi Kesalahan:</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Informasi Pokok Tagihan */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            Informasi Dokumen Tagihan
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tipe Tagihan */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Tipe Tagihan <span className="text-red-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as TagihanType)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="LOADING">LOADING</option>
                <option value="UNLOADING">UNLOADING</option>
                <option value="REBAGGING">REBAGGING</option>
                <option value="REPROSES">REPROSES</option>
                <option value="OVERSTAPEL">OVERSTAPEL</option>
              </select>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                {getTypeRuleDescription(type)}
              </p>
            </div>

            {/* No Dokumen / SDI */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                No. Dokumen / SDI <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: SDI/2026/10/001"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            {/* Status (Creatable) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Status Tagihan
                </label>
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(true)}
                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  Buat Status Baru
                </button>
              </div>
              <select
                value={statusUuid}
                onChange={(e) => setStatusUuid(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {statuses.map((s) => (
                  <option key={s.uuid} value={s.uuid}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Tanggal / Waktu Tagihan */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Tanggal & Waktu Tagihan
              </label>
              <input
                type="datetime-local"
                value={tagihanDate}
                onChange={(e) => setTagihanDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Catatan / Keterangan */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Catatan / Keterangan
              </label>
              <input
                type="text"
                placeholder="Catatan opsional untuk tagihan ini..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Related Documents (From 3 Sources) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              Dokumen Terkait (Related Documents)
            </h3>
            <span className="text-xs text-slate-400">
              Dapat menghubungkan dari 3 sumber dokumen
            </span>
          </div>

          {/* 1. ERP Commodity Document */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileCheck2 className="h-4 w-4 text-emerald-600" />
                  1. ERP Commodity Documents ({selectedErpDocs.length} Terpilih)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Dokumen ini menjadi dasar perhitungan kuantitas Tagihan Summary
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsErpModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300 transition cursor-pointer self-start sm:self-auto inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Pilih Dokumen ERP
              </button>
            </div>

            {selectedErpDocs.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Belum ada dokumen ERP Commodity yang dipilih. Klik tombol di atas untuk memilih.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedErpDocs.map((doc) => (
                  <div
                    key={doc.uuid}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                          {doc.documentNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {doc.pickingTypeCode}
                        </span>
                        {doc.refFax && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200">
                            Fax: {doc.refFax}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        Mitra: {doc.partnerName || "Tanpa Mitra"} • Qty:{" "}
                        {doc.totalQuantity} •{" "}
                        {(doc.items || []).map((i: any) => i.productName).join(", ")}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedErpDocs((prev) => prev.filter((d) => d.uuid !== doc.uuid))
                      }
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 transition cursor-pointer"
                      title="Hapus tautan dokumen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Non-Commodity Document */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-amber-600" />
                  2. Dokumen Non-Commodity ({selectedPoDocs.length} Terpilih)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Referensi dokumen PO Non-Commodity dari Odoo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPoModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300 transition cursor-pointer self-start sm:self-auto inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Pilih Dokumen PO
              </button>
            </div>

            {selectedPoDocs.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Belum ada dokumen PO Non-Commodity yang dipilih.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedPoDocs.map((po) => (
                  <div
                    key={po.uuid}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                          {po.documentNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                          {po.state}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        Mitra: {po.partner || "-"} • Total Nilai: Rp{" "}
                        {Number(po.amountTotal || 0).toLocaleString("id-ID")}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPoDocs((prev) => prev.filter((d) => d.uuid !== po.uuid))
                      }
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Manual Document / Text Only */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-purple-600" />
                  3. Dokumen Manual / Text Only ({manualDocs.length} Baris)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Dokumen manual tidak terhubung ke ERP, dapat diinput langsung oleh pengguna
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddManualDoc}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 dark:bg-purple-950/40 dark:border-purple-900 dark:text-purple-300 transition cursor-pointer self-start sm:self-auto inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Baris Manual
              </button>
            </div>

            {manualDocs.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Belum ada dokumen manual ditambahkan.
              </p>
            ) : (
              <div className="space-y-3">
                {manualDocs.map((m, idx) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                  >
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        No. Dokumen / Referensi <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: REF/MANUAL/001"
                        value={m.documentNumber}
                        onChange={(e) =>
                          handleUpdateManualDoc(m.id, "documentNumber", e.target.value)
                        }
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono font-medium focus:outline-none focus:border-purple-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-7">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Deskripsi / Keterangan (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Keterangan singkat..."
                        value={m.description}
                        onChange={(e) =>
                          handleUpdateManualDoc(m.id, "description", e.target.value)
                        }
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="md:col-span-1 flex justify-end md:pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveManualDoc(m.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition cursor-pointer"
                        title="Hapus baris"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Tagihan Summary Table */}
        <TagihanSummaryTable
          selectedErpDocs={selectedErpDocs}
          costs={costs}
          onCostChange={handleCostChange}
        />

        {/* Section 4: Supporting Files Upload */}
        <TagihanFilesManager
          files={[]}
          stagedFiles={stagedFiles}
          onStagedFilesChange={setStagedFiles}
        />

        {/* Form Action Buttons */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <Link
            href="/finance/tagihan"
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan Tagihan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Simpan Tagihan
              </>
            )}
          </button>
        </div>
      </form>

      {/* Modals */}
      <ErpDocumentSelectorModal
        isOpen={isErpModalOpen}
        onClose={() => setIsErpModalOpen(false)}
        onSelect={handleSelectErpDocs}
        tagihanType={type}
        alreadySelectedDocs={selectedErpDocs}
      />

      <NonCommoditySelectorModal
        isOpen={isPoModalOpen}
        onClose={() => setIsPoModalOpen(false)}
        onSelect={setSelectedPoDocs}
        alreadySelectedDocs={selectedPoDocs}
      />

      <CreateStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onSuccess={(created) => {
          refreshStatuses();
          if (created?.uuid) setStatusUuid(created.uuid);
        }}
      />
    </div>
  );
}

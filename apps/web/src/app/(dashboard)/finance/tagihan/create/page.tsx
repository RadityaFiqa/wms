"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Loader2,
  FileText,
  Plus,
  AlertCircle,
} from "lucide-react";
import {
  createTagihan,
  uploadTagihanFile,
  useMasterTagihanStatuses,
} from "@/hooks/useTagihan";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import { ErpDocumentSelectorModal } from "@/components/finance/tagihan/ErpDocumentSelectorModal";
import { NonCommoditySelectorModal } from "@/components/finance/tagihan/NonCommoditySelectorModal";
import { CreateStatusModal } from "@/components/finance/tagihan/CreateStatusModal";
import { TagihanSummaryTable } from "@/components/finance/tagihan/TagihanSummaryTable";
import { TagihanFilesManager } from "@/components/finance/tagihan/TagihanFilesManager";
import {
  RelatedDocumentsManager,
  type ManualDocItem,
} from "@/components/finance/tagihan/RelatedDocumentsManager";
import { getSecondaryQty, getSecondaryUnit } from "@/lib/quantity";
import { validateTagihanTypeRules, type TagihanType } from "@bulog-wms/schema";

export default function CreateTagihanPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuthStore();

  React.useEffect(() => {
    if (user && (user.role === "FINANCE" || !hasPermission("create", "Tagihan"))) {
      toast.error("Role Finance tidak diperbolehkan membuat tagihan baru.");
      router.replace("/finance/tagihan");
    }
  }, [user, hasPermission, router]);

  if (user?.role === "FINANCE" || !hasPermission("create", "Tagihan")) {
    return null;
  }

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
        return "Aturan ERP: Dokumen OUT (outgoing) saja, dalam bulan yang sama.";
      case "UNLOADING":
        return "Aturan ERP: Dokumen IN (incoming) saja, dalam bulan yang sama.";
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

    // Build summaries payload based on secondary quantity & secondary unit
    const summaryMap = new Map<
      string,
      { documentType: string; uom: string; quantity: number }
    >();
    for (const doc of selectedErpDocs) {
      const code = (doc.pickingTypeCode || "").toLowerCase();
      let docType = "INT";
      if (code === "incoming") docType = "IN";
      else if (code === "outgoing") docType = "OUT";

      for (const it of doc.items || []) {
        const primQty = Number(it.quantity || it.productQty || 0);
        const secQty = getSecondaryQty(primQty, it.uom);
        const secUnit = getSecondaryUnit(it.uom).toUpperCase();
        const key = `${docType}__${secUnit}`;
        if (!summaryMap.has(key)) {
          summaryMap.set(key, { documentType: docType, uom: secUnit, quantity: 0 });
        }
        summaryMap.get(key)!.quantity += secQty;
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
      const costPerUnit = costs[key] ?? costs[val.uom] ?? 0;
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

        {/* Section 2: Related Documents (Tabs & Tables) */}
        <RelatedDocumentsManager
          type={type}
          selectedErpDocs={selectedErpDocs}
          selectedPoDocs={selectedPoDocs}
          manualDocs={manualDocs}
          onRemoveErpDoc={(uuid) =>
            handleSelectErpDocs(selectedErpDocs.filter((d) => d.uuid !== uuid))
          }
          onRemovePoDoc={(uuid) =>
            setSelectedPoDocs((prev) => prev.filter((d) => d.uuid !== uuid))
          }
          onAddManualDoc={handleAddManualDoc}
          onUpdateManualDoc={handleUpdateManualDoc}
          onRemoveManualDoc={handleRemoveManualDoc}
          onOpenErpModal={() => setIsErpModalOpen(true)}
          onOpenPoModal={() => setIsPoModalOpen(true)}
        />

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

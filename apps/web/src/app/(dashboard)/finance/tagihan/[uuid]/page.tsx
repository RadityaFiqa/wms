"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Save,
  Lock,
  Calendar,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  useTagihanDetail,
  useMasterTagihanStatuses,
  updateTagihan,
  deleteTagihan,
} from "@/hooks/useTagihan";
import { ErpDocumentSelectorModal } from "@/components/finance/tagihan/ErpDocumentSelectorModal";
import { NonCommoditySelectorModal } from "@/components/finance/tagihan/NonCommoditySelectorModal";
import { CreateStatusModal } from "@/components/finance/tagihan/CreateStatusModal";
import { TagihanSummaryTable } from "@/components/finance/tagihan/TagihanSummaryTable";
import { TagihanExportReports } from "@/components/finance/tagihan/TagihanExportReports";
import { TagihanFilesManager } from "@/components/finance/tagihan/TagihanFilesManager";
import {
  RelatedDocumentsManager,
  type ManualDocItem,
} from "@/components/finance/tagihan/RelatedDocumentsManager";
import { getSecondaryQty, getSecondaryUnit } from "@/lib/quantity";
import { validateTagihanTypeRules, type TagihanType } from "@bulog-wms/schema";
import { useAuthStore } from "@/store/auth";

export default function TagihanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const uuid = params.uuid as string;

  const { user, hasPermission } = useAuthStore();
  const isFinance = user?.role === "FINANCE";
  const canDeleteTagihan = hasPermission("delete", "Tagihan") && !isFinance;
  const canEditMainInfo = !isFinance;

  const { tagihan, isLoading, error, refresh } = useTagihanDetail(uuid);
  const { statuses, refresh: refreshStatuses } = useMasterTagihanStatuses();

  // Mode: View vs Edit
  const [isEditing, setIsEditing] = useState(false);

  // Edit Form State
  const [type, setType] = useState<TagihanType>("LOADING");
  const [documentNumber, setDocumentNumber] = useState("");
  const [statusUuid, setStatusUuid] = useState("");
  const [tagihanDate, setTagihanDate] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedErpDocs, setSelectedErpDocs] = useState<any[]>([]);
  const [selectedPoDocs, setSelectedPoDocs] = useState<any[]>([]);
  const [manualDocs, setManualDocs] = useState<ManualDocItem[]>([]);
  const [costs, setCosts] = useState<Record<string, number>>({});

  // Modals
  const [isErpModalOpen, setIsErpModalOpen] = useState(false);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Initialize edit form when tagihan loads or when entering edit mode
  useEffect(() => {
    if (tagihan) {
      setType(tagihan.type || "LOADING");
      setDocumentNumber(tagihan.documentNumber || "");
      setStatusUuid(tagihan.status?.uuid || "");
      setTagihanDate(
        tagihan.tagihanDate
          ? new Date(tagihan.tagihanDate).toISOString().slice(0, 16)
          : "",
      );
      setNotes(tagihan.notes || "");

      // Map ERP documents
      const erpList = (tagihan.documentReferences || [])
        .map((r: any) => r.documentReference)
        .filter(Boolean);
      setSelectedErpDocs(erpList);

      // Map Non-Commodity PO documents
      const poList = (tagihan.nonCommodityDocuments || [])
        .map((r: any) => r.documentPurchaseOrder)
        .filter(Boolean);
      setSelectedPoDocs(poList);

      // Map Manual documents
      const mList: ManualDocItem[] = (tagihan.manualDocuments || []).map(
        (m: any) => ({
          id: m.uuid || String(m.id),
          documentNumber: m.documentNumber,
          description: m.description || "",
        }),
      );
      setManualDocs(mList);

      // Map existing costs
      const costMap: Record<string, number> = {};
      (tagihan.summaries || []).forEach((s: any) => {
        const key = `${s.documentType}__${s.uom}`;
        costMap[key] = s.costPerUnit || 0;
      });
      setCosts(costMap);
    }
  }, [tagihan, isEditing]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const getTypeBadge = (t: string) => {
    switch (t) {
      case "LOADING":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-blue-400">
            LOADING (OUT)
          </span>
        );
      case "UNLOADING":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-400">
            UNLOADING (IN)
          </span>
        );
      case "REBAGGING":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-400">
            REBAGGING
          </span>
        );
      case "REPROSES":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-400">
            REPROSES
          </span>
        );
      case "OVERSTAPEL":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/30 dark:border-purple-900/40 dark:text-purple-400">
            OVERSTAPEL (INT)
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-50 text-slate-700 border border-slate-200">
            {t || "-"}
          </span>
        );
    }
  };

  const getStatusBadge = (st: any) => {
    if (!st) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          Draft
        </span>
      );
    }
    const color = st.color || "blue";
    const colorClasses: Record<string, string> = {
      slate:
        "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
      blue:
        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900",
      emerald:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
      green:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
      amber:
        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
      purple:
        "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900",
      red:
        "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-bold border ${
          colorClasses[color] || colorClasses.blue
        }`}
      >
        {st.name}
      </span>
    );
  };

  const handleSaveEdit = async () => {
    setActionError(null);

    if (selectedErpDocs.length > 0) {
      const val = validateTagihanTypeRules(type, selectedErpDocs);
      if (!val.isValid) {
        setActionError(val.error || "Dokumen ERP tidak memenuhi aturan.");
        return;
      }
    }

    for (const m of manualDocs) {
      if (!m.documentNumber.trim()) {
        setActionError("Semua baris Dokumen Manual wajib memiliki Nomor Dokumen.");
        return;
      }
    }

    // Prepare summaries with secondary quantity & secondary unit
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

    const summariesPayload: any[] = [];
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

    setIsSaving(true);
    try {
      // Note: documentNumber and tagihanDate are read-only on edit and kept identical
      // For Role Finance, type and notes are also kept identical
      await updateTagihan(uuid, {
        documentNumber: tagihan.documentNumber,
        type: isFinance ? tagihan.type : type,
        statusUuid: statusUuid || null,
        tagihanDate: tagihan.tagihanDate,
        notes: isFinance ? (tagihan.notes || null) : (notes.trim() || null),
        erpDocumentUuids: selectedErpDocs.map((d) => d.uuid),
        nonCommodityDocumentUuids: selectedPoDocs.map((d) => d.uuid),
        manualDocuments: manualDocs.map((m) => ({
          documentNumber: m.documentNumber.trim(),
          description: m.description?.trim() || null,
        })),
        summaries: summariesPayload,
      });

      setIsEditing(false);
      refresh();
    } catch (err: any) {
      setActionError(
        err?.response?.data?.message || err.message || "Gagal memperbarui Tagihan.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTagihan(uuid);
      router.push("/finance/tagihan");
    } catch (err: any) {
      setActionError(
        err?.response?.data?.message || err.message || "Gagal menghapus Tagihan.",
      );
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
        <p className="text-xs text-slate-500 font-semibold">
          Memuat detail tagihan...
        </p>
      </div>
    );
  }

  if (error || !tagihan) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Tagihan tidak ditemukan atau terjadi kesalahan
        </h2>
        <Link
          href="/finance/tagihan"
          className="inline-flex items-center px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
        >
          Kembali ke Daftar Tagihan
        </Link>
      </div>
    );
  }

  const formattedCreatedDate = tagihan.tagihanDate
    ? new Date(tagihan.tagihanDate).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Navigation & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/finance/tagihan"
          className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Daftar Tagihan
        </Link>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5 text-emerald-600" />
                Edit Tagihan
              </button>
              {canDeleteTagihan && (
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-red-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950/20 transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveEdit}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/25 inline-flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Simpan Perubahan
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start gap-3 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block flex items-center gap-1.5">
              No. Dokumen / SDI
              {isEditing && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/50">
                  <Lock className="h-3 w-3" /> Read-only
                </span>
              )}
            </span>
            {isEditing ? (
              <div className="relative">
                <input
                  type="text"
                  value={documentNumber}
                  disabled
                  readOnly
                  className="text-xl font-black font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 cursor-not-allowed select-all"
                />
                <span className="block text-[10px] text-slate-400 font-medium mt-1">
                  Nomor dokumen tagihan tidak dapat diubah setelah dibuat.
                </span>
              </div>
            ) : (
              <h2 className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 tracking-tight select-all">
                {tagihan.documentNumber}
              </h2>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isEditing ? (
              <div className="flex items-center gap-2">
                {canEditMainInfo ? (
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as TagihanType)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold"
                  >
                    <option value="LOADING">LOADING</option>
                    <option value="UNLOADING">UNLOADING</option>
                    <option value="REBAGGING">REBAGGING</option>
                    <option value="REPROSES">REPROSES</option>
                    <option value="OVERSTAPEL">OVERSTAPEL</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {getTypeBadge(tagihan.type)}
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/50">
                      <Lock className="h-2.5 w-2.5" /> Read-only
                    </span>
                  </div>
                )}

                <select
                  value={statusUuid}
                  onChange={(e) => setStatusUuid(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold"
                >
                  {statuses.map((s) => (
                    <option key={s.uuid} value={s.uuid}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                {getTypeBadge(tagihan.type)}
                {getStatusBadge(tagihan.status)}
              </>
            )}
          </div>
        </div>

        {/* Metadata info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5 flex items-center gap-1">
              Tanggal / Waktu Tagihan
              {isEditing && (
                <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400 inline" />
              )}
            </span>
            {isEditing ? (
              <div>
                <input
                  type="datetime-local"
                  value={tagihanDate}
                  disabled
                  readOnly
                  className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
                <span className="block text-[10px] text-slate-400 font-medium mt-1">
                  Tanggal tagihan tidak dapat diubah setelah dibuat.
                </span>
              </div>
            ) : (
              <strong className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {formattedCreatedDate}
              </strong>
            )}
          </div>

          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">
              Total Tagihan
            </span>
            <strong className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(tagihan.totalAmount)}
            </strong>
          </div>

          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">
              Gudang Operasional
            </span>
            <strong className="text-slate-700 dark:text-slate-300 font-semibold">
              {tagihan.warehouse?.name || "-"} ({tagihan.warehouse?.code || "-"})
            </strong>
          </div>

          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">
              Dibuat Oleh
            </span>
            <strong className="text-slate-700 dark:text-slate-300 font-semibold">
              {tagihan.createdBy?.name || "Sistem"}
            </strong>
          </div>
        </div>

        {/* Notes */}
        <div>
          <span className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
            Catatan / Keterangan
            {isEditing && !canEditMainInfo && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/50">
                <Lock className="h-2.5 w-2.5" /> Read-only
              </span>
            )}
          </span>
          {isEditing && canEditMainInfo ? (
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tagihan..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs"
            />
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
              {tagihan.notes || "Tidak ada catatan."}
            </p>
          )}
        </div>
      </div>

      {/* Section: Related Documents (Tabs & Tables) */}
      <RelatedDocumentsManager
        type={type}
        selectedErpDocs={selectedErpDocs}
        selectedPoDocs={selectedPoDocs}
        manualDocs={manualDocs}
        onRemoveErpDoc={(dUuid) =>
          setSelectedErpDocs((prev) => prev.filter((d) => d.uuid !== dUuid))
        }
        onRemovePoDoc={(pUuid) =>
          setSelectedPoDocs((prev) => prev.filter((d) => d.uuid !== pUuid))
        }
        onAddManualDoc={() =>
          setManualDocs((prev) => [
            ...prev,
            { id: String(Date.now()), documentNumber: "", description: "" },
          ])
        }
        onUpdateManualDoc={(id, field, val) =>
          setManualDocs((prev) =>
            prev.map((m) => (m.id === id ? { ...m, [field]: val } : m)),
          )
        }
        onRemoveManualDoc={(id) =>
          setManualDocs((prev) => prev.filter((m) => m.id !== id))
        }
        onOpenErpModal={() => setIsErpModalOpen(true)}
        onOpenPoModal={() => setIsPoModalOpen(true)}
        readOnly={!isEditing}
      />

      {/* Section: Tagihan Summary Table */}
      <TagihanSummaryTable
        selectedErpDocs={selectedErpDocs}
        costs={costs}
        onCostChange={(key, val) => setCosts((prev) => ({ ...prev, [key]: val }))}
        readOnly={!isEditing}
        initialSummaries={tagihan.summaries}
      />

      {/* Section: Export & Reports (Commodity Recap & Odoo Report) */}
      <TagihanExportReports
        tagihanUuid={uuid}
        tagihanType={tagihan.type}
        hasErpDocuments={(selectedErpDocs || []).length > 0}
        onFilesChange={refresh}
      />

      {/* Section: Supporting Files Manager */}
      <TagihanFilesManager
        tagihanUuid={uuid}
        files={tagihan.files || []}
        onFilesChange={refresh}
        readOnly={!isEditing}
      />

      {/* Modals */}
      <ErpDocumentSelectorModal
        isOpen={isErpModalOpen}
        onClose={() => setIsErpModalOpen(false)}
        onSelect={(docs) => setSelectedErpDocs(docs)}
        tagihanType={type}
        alreadySelectedDocs={selectedErpDocs}
      />

      <NonCommoditySelectorModal
        isOpen={isPoModalOpen}
        onClose={() => setIsPoModalOpen(false)}
        onSelect={(pos) => setSelectedPoDocs(pos)}
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

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Konfirmasi Hapus Tagihan
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Apakah Anda yakin ingin menghapus Tagihan{" "}
              <strong>{tagihan.documentNumber}</strong>?
            </p>
            <p className="text-[11px] text-slate-400">
              Menghapus tagihan hanya akan menghapus data pada tabel Tagihan dan
              hubungannya. Dokumen asli ERP Commodity dan PO Non-Commodity tidak akan
              terpengaruh sama sekali.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-600/20 inline-flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Ya, Hapus Tagihan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

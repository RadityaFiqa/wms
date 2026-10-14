"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Save,
  X,
  FileCheck2,
  Receipt,
  FileText,
  DollarSign,
  Calendar,
  Layers,
  Paperclip,
  CheckCircle2,
  Clock,
  Plus,
  Loader2,
  AlertCircle,
  FolderOpen,
  ChevronDown,
  ChevronRight,
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
import { TagihanFilesManager } from "@/components/finance/tagihan/TagihanFilesManager";
import { validateTagihanTypeRules, type TagihanType } from "@bulog-wms/schema";

export default function TagihanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const uuid = params.uuid as string;

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
  const [manualDocs, setManualDocs] = useState<any[]>([]);
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
        tagihan.tagihanDate ? new Date(tagihan.tagihanDate).toISOString().slice(0, 16) : "",
      );
      setNotes(tagihan.notes || "");

      // Map ERP documents
      const erpList = (tagihan.documentReferences || []).map((r: any) => r.documentReference).filter(Boolean);
      setSelectedErpDocs(erpList);

      // Map Non-Commodity PO documents
      const poList = (tagihan.nonCommodityDocuments || []).map((r: any) => r.documentPurchaseOrder).filter(Boolean);
      setSelectedPoDocs(poList);

      // Map Manual documents
      const mList = (tagihan.manualDocuments || []).map((m: any) => ({
        id: m.uuid,
        documentNumber: m.documentNumber,
        description: m.description || "",
      }));
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
      slate: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
      blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900",
      emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
      green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
      amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
      purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900",
      red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
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

    if (!documentNumber.trim()) {
      setActionError("Nomor Dokumen / SDI wajib diisi.");
      return;
    }

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

    // Prepare summaries
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

    const summariesPayload: any[] = [];
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

    setIsSaving(true);
    try {
      await updateTagihan(uuid, {
        documentNumber: documentNumber.trim(),
        type,
        statusUuid: statusUuid || null,
        tagihanDate: tagihanDate ? new Date(tagihanDate).toISOString() : undefined,
        notes: notes.trim() || null,
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
        <p className="text-xs text-slate-500 font-semibold">Memuat detail tagihan...</p>
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
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-red-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950/20 transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus
              </button>
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              No. Dokumen / SDI
            </span>
            {isEditing ? (
              <input
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500"
              />
            ) : (
              <h2 className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 tracking-tight select-all">
                {tagihan.documentNumber}
              </h2>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isEditing ? (
              <div className="flex items-center gap-2">
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
            <span className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">
              Tanggal / Waktu Tagihan
            </span>
            {isEditing ? (
              <input
                type="datetime-local"
                value={tagihanDate}
                onChange={(e) => setTagihanDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs"
              />
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
          <span className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">
            Catatan / Keterangan
          </span>
          {isEditing ? (
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

      {/* Section: Related Documents (ERP, PO, Manual) */}
      <div className="space-y-4">
        {/* 1. ERP Commodity Documents */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4.5 w-4.5 text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                1. Dokumen ERP Commodity ({selectedErpDocs.length} Dokumen)
              </h4>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={() => setIsErpModalOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                Kelola Dokumen ERP
              </button>
            )}
          </div>

          {selectedErpDocs.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Belum ada dokumen ERP terkait.</p>
          ) : (
            <div className="space-y-2">
              {selectedErpDocs.map((doc: any) => (
                <div
                  key={doc.uuid}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                        {doc.documentNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {doc.pickingTypeCode}
                      </span>
                      {doc.refFax && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200">
                          Ref Fax: {doc.refFax}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      Mitra: <strong>{doc.partnerName || "Tanpa Mitra"}</strong> • Total Qty:{" "}
                      <strong>{Number(doc.totalQuantity || 0).toLocaleString("id-ID")}</strong> •{" "}
                      {(doc.items || []).map((i: any) => `${i.productName} (${i.quantity} ${i.uom || "UNIT"})`).join(", ")}
                    </p>
                  </div>

                  {isEditing && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedErpDocs((prev) => prev.filter((d) => d.uuid !== doc.uuid))
                      }
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 transition cursor-pointer"
                      title="Hapus tautan dokumen ERP"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Non-Commodity Documents */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4.5 w-4.5 text-amber-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                2. Dokumen Non-Commodity ({selectedPoDocs.length} Dokumen PO)
              </h4>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={() => setIsPoModalOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                Kelola Dokumen PO
              </button>
            )}
          </div>

          {selectedPoDocs.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Belum ada dokumen PO Non-Commodity terkait.</p>
          ) : (
            <div className="space-y-2">
              {selectedPoDocs.map((po: any) => (
                <div
                  key={po.uuid}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex items-center justify-between gap-4"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                        {po.documentNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                        {po.state}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      Mitra: <strong>{po.partner || "-"}</strong> • Total PO:{" "}
                      <strong>{formatCurrency(po.amountTotal)}</strong>
                    </p>
                  </div>

                  {isEditing && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPoDocs((prev) => prev.filter((d) => d.uuid !== po.uuid))
                      }
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Manual Documents */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-purple-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                3. Dokumen Manual / Text Only ({manualDocs.length} Baris)
              </h4>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={() =>
                  setManualDocs((prev) => [
                    ...prev,
                    { id: String(Date.now()), documentNumber: "", description: "" },
                  ])
                }
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                Tambah Baris Manual
              </button>
            )}
          </div>

          {manualDocs.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Belum ada dokumen manual terkait.</p>
          ) : (
            <div className="space-y-2">
              {manualDocs.map((m, idx) => (
                <div
                  key={m.id || idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex items-center justify-between gap-4"
                >
                  {isEditing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                      <input
                        type="text"
                        placeholder="No. Dokumen / Referensi..."
                        value={m.documentNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setManualDocs((prev) =>
                            prev.map((item) => (item.id === m.id ? { ...item, documentNumber: val } : item)),
                          );
                        }}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono font-bold"
                      />
                      <input
                        type="text"
                        placeholder="Keterangan..."
                        value={m.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setManualDocs((prev) =>
                            prev.map((item) => (item.id === m.id ? { ...item, description: val } : item)),
                          );
                        }}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs"
                      />
                    </div>
                  ) : (
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                        {m.documentNumber}
                      </span>
                      {m.description && (
                        <p className="text-xs text-slate-500">{m.description}</p>
                      )}
                    </div>
                  )}

                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => setManualDocs((prev) => prev.filter((item) => item.id !== m.id))}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section: Tagihan Summary Table */}
      <TagihanSummaryTable
        selectedErpDocs={selectedErpDocs}
        costs={costs}
        onCostChange={(key, val) => setCosts((prev) => ({ ...prev, [key]: val }))}
        readOnly={!isEditing}
        initialSummaries={tagihan.summaries}
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

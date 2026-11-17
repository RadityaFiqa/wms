"use client";

import { useState, type KeyboardEvent, type SyntheticEvent } from "react";
import { useDndContext, useDroppable } from "@dnd-kit/core";
import { Folder, FolderOpen, FolderPlus, Inbox, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { InboundGroup, InboundProduct } from "@bulog-wms/schema";
import InboundSenderList, { Chevron, summaryClass, type FolderDragData } from "@/components/analytics/InboundSenderList";
import { formatDateId, formatDecimal, formatGroupValue } from "@/components/analytics/format";
import { deleteStockFolder, renameStockFolder } from "@/hooks/useAnalytics";

export const apiErrorMessage = (err: unknown, fallback: string) => {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(message)) return String(message[0]);
  return typeof message === "string" ? message : fallback;
};

// Controls inside a <summary>: keep their clicks and keys from toggling the folder
export const stopClick = (e: SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export const formatPct = (value: number) => `${formatDecimal(value)}%`;

/** Inline "+ Folder" that turns into a name field; onCreate saves the name */
export function NewFolderButton({ onCreate }: { onCreate: (name: string) => Promise<unknown> }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const close = () => {
    setAdding(false);
    setName("");
  };

  const submit = async () => {
    const value = name.trim();
    if (!value) return close();
    setSaving(true);
    try {
      await onCreate(value);
      close();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal membuat folder."));
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 dark:border-slate-600 dark:text-slate-400 dark:hover:text-blue-400"
      >
        <FolderPlus className="h-3.5 w-3.5" />
        Folder
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        autoFocus
        value={name}
        maxLength={60}
        disabled={saving}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (!saving && !name.trim()) close();
        }}
        placeholder="Nama folder, Enter untuk simpan"
        aria-label="Nama folder baru"
        className="w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      />
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
    </span>
  );
}

/** Drop target of a folder (or of "Belum dikelompokkan"); lights up for drags from the same product */
function useFolderDrop(productUuid: string, folderUuid: string | null) {
  const { active } = useDndContext();
  const { setNodeRef, isOver } = useDroppable({
    id: `drop::${productUuid}::${folderUuid ?? "none"}`,
    data: { productUuid, folderUuid },
  });
  const dragged = active?.data.current as FolderDragData | undefined;
  const accepts = !!dragged && dragged.productUuid === productUuid && dragged.fromFolderUuid !== folderUuid;
  return { setNodeRef, accepts, isOver: accepts && isOver };
}

export const dropClass = (accepts: boolean, isOver: boolean) =>
  isOver
    ? "ring-2 ring-blue-500 bg-blue-50/60 dark:bg-blue-950/30"
    : accepts
      ? "ring-1 ring-dashed ring-blue-300 dark:ring-blue-800"
      : "";

function SummaryLine({ product, group }: { product: InboundProduct; group: InboundGroup }) {
  const { summary } = group;
  return (
    <>
      <span className="block text-[11px] text-slate-400">
        {summary.senderCount} pengirim · {summary.stackCount} tumpukan · {summary.lotCount} lot
        {summary.lastReceivedAt && <> · Masuk terakhir {formatDateId(summary.lastReceivedAt)}</>}
      </span>
      {summary.pendingGateCount > 0 && (
        <span className="block text-[11px] font-medium text-amber-600 dark:text-amber-400">
          termasuk {formatGroupValue(summary.pendingDisplayQty, product.unit)} belum diadministrasikan (
          {summary.pendingGateCount} gate)
        </span>
      )}
    </>
  );
}

interface SectionProps {
  product: InboundProduct;
  group: InboundGroup;
  canEdit: boolean;
  forceOpen: boolean;
}

/** A manual folder: collapsible, droppable, with its summary and per-sender share */
export function InboundFolderSection({ product, group, canEdit, forceOpen }: SectionProps) {
  const folder = group.folder!;
  const { setNodeRef, accepts, isOver } = useFolderDrop(product.productUuid, folder.uuid);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [busy, setBusy] = useState(false);

  const saveName = async () => {
    // Disabling the input while saving blurs it, which would save a second time
    if (busy) return;
    const next = name.trim();
    if (!next || next === folder.name) {
      setEditing(false);
      setName(folder.name);
      return;
    }
    setBusy(true);
    try {
      await renameStockFolder(folder.uuid, { name: next });
      setEditing(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal mengganti nama folder."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Hapus folder "${folder.name}"? Isinya kembali ke "Belum dikelompokkan".`)) return;
    setBusy(true);
    try {
      await deleteStockFolder(folder.uuid);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal menghapus folder."));
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      void saveName();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false);
      setName(folder.name);
    }
  };

  return (
    <details
      ref={setNodeRef}
      className={`group/folder rounded-xl border border-slate-200 transition-shadow dark:border-slate-700 ${dropClass(accepts, isOver)}`}
      open={forceOpen || undefined}
    >
      <summary className={`${summaryClass} px-3 py-2.5`}>
        <Chevron level="folder" />
        <Folder className="h-4 w-4 shrink-0 text-amber-500 group-open/folder:hidden" aria-hidden="true" />
        <FolderOpen className="hidden h-4 w-4 shrink-0 text-amber-500 group-open/folder:block" aria-hidden="true" />
        <div className="min-w-0">
          {editing ? (
            <input
              autoFocus
              value={name}
              maxLength={60}
              disabled={busy}
              onClick={stopClick}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onKeyDown}
              onKeyUp={(e) => e.stopPropagation()}
              onBlur={() => void saveName()}
              aria-label="Nama folder"
              className="w-48 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-sm font-bold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          ) : (
            <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{folder.name}</div>
          )}
          <SummaryLine product={product} group={group} />
        </div>
        {canEdit && !editing && (
          <span className="flex shrink-0 items-center gap-0.5" onClick={stopClick}>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={busy}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label={`Ganti nama folder ${folder.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              aria-label={`Hapus folder ${folder.name}`}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </span>
        )}
        <span className="ml-auto shrink-0 pl-3 text-right">
          <span className="block text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
            {formatGroupValue(group.summary.displayQty, product.unit)}
          </span>
          <span className="block text-[11px] tabular-nums text-slate-400">{formatPct(group.summary.sharePct)} stok produk</span>
        </span>
      </summary>

      <div className="px-3 pb-3">
        {group.senders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400 dark:border-slate-700">
            Folder kosong. Seret pengirim atau lot ke sini.
          </p>
        ) : (
          <InboundSenderList
            product={product}
            senders={group.senders}
            folderUuid={folder.uuid}
            canDrag={canEdit}
            forceOpen={forceOpen}
          />
        )}
      </div>
    </details>
  );
}

/** Senders and lots not in any folder; also the drop target to take things out of a folder */
export function UngroupedSection({ product, group, canEdit, forceOpen }: SectionProps) {
  const { setNodeRef, accepts, isOver } = useFolderDrop(product.productUuid, null);
  return (
    <div ref={setNodeRef} className={`rounded-xl px-3 py-2 transition-shadow ${dropClass(accepts, isOver)}`}>
      <div className="flex items-center gap-2 py-1">
        <Inbox className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-600 dark:text-slate-300">Belum dikelompokkan</div>
          {group.senders.length > 0 && <SummaryLine product={product} group={group} />}
        </div>
        {group.senders.length > 0 && (
          <span className="ml-auto shrink-0 pl-3 text-right">
            <span className="block text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
              {formatGroupValue(group.summary.displayQty, product.unit)}
            </span>
            <span className="block text-[11px] tabular-nums text-slate-400">{formatPct(group.summary.sharePct)} stok produk</span>
          </span>
        )}
      </div>
      {group.senders.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400">Semua stok produk ini sudah masuk folder.</p>
      ) : (
        <InboundSenderList
          product={product}
          senders={group.senders}
          folderUuid={null}
          canDrag={canEdit}
          forceOpen={forceOpen}
        />
      )}
    </div>
  );
}

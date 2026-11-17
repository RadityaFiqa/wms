"use client";

import { useState, type KeyboardEvent } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { FolderPlus, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { filterInboundProducts, type InboundGroup, type InboundProduct } from "@bulog-wms/schema";
import { formatGroupValue, formatProductName, formatQty } from "@/components/analytics/format";
import InboundSenderList, {
  Chevron,
  isScaledUnit,
  summaryClass,
  type FolderDragData,
} from "@/components/analytics/InboundSenderList";
import {
  apiErrorMessage,
  formatPct,
  InboundFolderSection,
  UngroupedSection,
} from "@/components/analytics/InboundFolderSection";
import { createStockFolder, moveStockFolderItem } from "@/hooks/useAnalytics";
import { useAuthStore } from "@/store/auth";

/** Inline "+ Folder" that turns into a name field */
function NewFolderButton({ productUuid }: { productUuid: string }) {
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
      await createStockFolder({ productUuid, name: value });
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

/** "HGL KALSEL 62% · Belum dikelompokkan 38%" under the product name */
function FolderShareLine({ groups }: { groups: InboundGroup[] }) {
  const parts = groups.filter((g) => g.summary.displayQty > 0);
  if (parts.length === 0) return null;
  return (
    <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
      {parts.map((g, i) => (
        <span key={g.folder?.uuid ?? "none"}>
          {i > 0 && " · "}
          <span className={g.folder ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
            {g.folder?.name ?? "Belum dikelompokkan"}
          </span>{" "}
          {formatPct(g.summary.sharePct)}
        </span>
      ))}
    </div>
  );
}

export default function InboundGroupingTree({ products, search }: { products: InboundProduct[]; search: string }) {
  const canEdit = useAuthStore((s) => s.hasPermission("update", "Report"));
  const [dragging, setDragging] = useState<FolderDragData | null>(null);
  const [moving, setMoving] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const visible = filterInboundProducts(products, search);
  const forceOpen = search.trim().length > 0;

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current as FolderDragData) ?? null);

  const onDragEnd = async (e: DragEndEvent) => {
    setDragging(null);
    const item = e.active.data.current as FolderDragData | undefined;
    const target = e.over?.data.current as { productUuid: string; folderUuid: string | null } | undefined;
    if (!item || !target || target.productUuid !== item.productUuid || target.folderUuid === item.fromFolderUuid) return;

    setMoving(true);
    try {
      await moveStockFolderItem({
        productUuid: item.productUuid,
        senderName: item.senderName,
        lotName: item.lotName,
        folderUuid: target.folderUuid,
      });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal memindahkan ke folder."));
    } finally {
      setMoving(false);
    }
  };

  if (visible.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-400">Tidak ada stok yang cocok.</p>;
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={(e) => void onDragEnd(e)}
      onDragCancel={() => setDragging(null)}
    >
      {moving && (
        <div className="flex items-center gap-2 text-xs text-slate-400" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyimpan pengelompokan…
        </div>
      )}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {visible.map((p) => {
          const folderGroups = p.groups.filter((g) => g.folder);
          const ungrouped = p.groups.find((g) => !g.folder);
          const hasFolders = folderGroups.length > 0;
          return (
            <details key={p.productUuid} className="group/product" open={forceOpen || undefined}>
              <summary className={`${summaryClass} py-3`}>
                <Chevron level="product" />
                <div className="min-w-0" title={p.name}>
                  <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{formatProductName(p.name)}</div>
                  <div className="text-[11px] text-slate-400">
                    <span className="font-medium tracking-wide">{p.sku}</span> · {p.senderCount} pengirim · {p.stackCount} tumpukan
                    {hasFolders && <> · {folderGroups.length} folder</>}
                  </div>
                  {p.pendingDisplayQty !== 0 && (
                    <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      termasuk {formatGroupValue(p.pendingDisplayQty, p.unit)} belum diadministrasikan
                    </div>
                  )}
                  {hasFolders && <FolderShareLine groups={p.groups} />}
                </div>
                <span className="ml-auto shrink-0 pl-3 text-right">
                  <span className="block text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
                    {formatGroupValue(p.displayQty, p.unit)}
                  </span>
                  {isScaledUnit(p.unit) && (
                    <span className="block text-[11px] tabular-nums text-slate-400">
                      {formatQty(p.qty)} {p.uom}
                    </span>
                  )}
                </span>
              </summary>

              <div className="mb-3 ml-5 space-y-2">
                {canEdit && (
                  <div className="flex flex-wrap items-center gap-2">
                    <NewFolderButton productUuid={p.productUuid} />
                    {hasFolders && (
                      <span className="text-[11px] text-slate-400">
                        Seret <GripVertical className="inline h-3 w-3 align-[-2px]" /> pengirim atau lot ke folder.
                      </span>
                    )}
                  </div>
                )}

                {hasFolders ? (
                  <>
                    {folderGroups.map((g) => (
                      <InboundFolderSection
                        key={g.folder!.uuid}
                        product={p}
                        group={g}
                        canEdit={canEdit}
                        forceOpen={forceOpen}
                      />
                    ))}
                    {ungrouped && (
                      <UngroupedSection product={p} group={ungrouped} canEdit={canEdit} forceOpen={forceOpen} />
                    )}
                  </>
                ) : (
                  ungrouped && (
                    <InboundSenderList
                      product={p}
                      senders={ungrouped.senders}
                      folderUuid={null}
                      canDrag={false}
                      forceOpen={forceOpen}
                    />
                  )
                )}
              </div>
            </details>
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-lg dark:border-blue-700 dark:bg-slate-800 dark:text-slate-100">
            <GripVertical className="h-3.5 w-3.5 text-slate-400" />
            {dragging.lotName ? `Lot ${dragging.label}` : dragging.label}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

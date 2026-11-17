"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  CalendarRange,
  FileText,
  Folder,
  FolderOpen,
  GripVertical,
  Inbox,
  Landmark,
  Loader2,
  MapPin,
  Pencil,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import type {
  BanpangGroup,
  BanpangProductQty,
  BanpangRealizationResponse,
  BanpangSalesOrder,
  BanpangSummary,
} from "@bulog-wms/schema";
import SummaryCard from "@/components/analytics/SummaryCard";
import { Chevron, summaryClass } from "@/components/analytics/InboundSenderList";
import {
  apiErrorMessage,
  dropClass,
  formatPct,
  NewFolderButton,
  stopClick,
} from "@/components/analytics/InboundFolderSection";
import { formatDateId, formatProductName, formatQty } from "@/components/analytics/format";
import {
  createBanpangFolder,
  deleteBanpangFolder,
  moveBanpangSalesOrder,
  renameBanpangFolder,
  useBanpangRealization,
} from "@/hooks/useAnalytics";
import { useAuthStore } from "@/store/auth";

const toDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const inputClass =
  "w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500";
const labelClass = "text-[10px] font-bold uppercase tracking-wider text-slate-400";

const formatKg = (kg: number) => `${formatQty(Math.round(kg))} Kg`;

/** "337.345 Pack 10 KG", "95.700 Pack 2 L": quantities summed per UoM, for the totals card */
function qtyPerUom(products: BanpangProductQty[]) {
  const byUom = new Map<string, number>();
  for (const p of products) byUom.set(p.uom, (byUom.get(p.uom) ?? 0) + p.qty);
  return Array.from(byUom.entries()).map(([uom, qty]) => `${formatQty(qty)} ${uom}`);
}

/** "1 Nov 2026" or "1 Nov 2026 – 16 Nov 2026" */
function formatRange(summary: BanpangSummary) {
  if (!summary.firstDoneAt) return "-";
  const first = formatDateId(summary.firstDoneAt);
  const last = formatDateId(summary.lastDoneAt);
  return first === last ? first : `${first} – ${last}`;
}

/** "450 Pack 10 KG BERAS MEDIUM …" per product, for the summary lines */
function ProductLines({ products }: { products: BanpangProductQty[] }) {
  return (
    <>
      {products.map((p) => (
        <div key={p.productUuid} className="truncate" title={p.name}>
          <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">
            {formatQty(p.qty)} {p.uom}
          </span>{" "}
          {formatProductName(p.name)}
        </div>
      ))}
    </>
  );
}

/** What a drag carries: a whole sales order and the folder it comes from */
interface SalesOrderDragData {
  soNumber: string;
  fromFolderUuid: string | null;
}

const salesOrderMatches = (so: BanpangSalesOrder, q: string) =>
  so.soNumber.toLowerCase().includes(q) ||
  so.destinations.some(
    (d) => d.name.toLowerCase().includes(q) || d.documents.some((doc) => doc.documentNumber.toLowerCase().includes(q)),
  );

/**
 * Keeps the sales orders that match the search, narrowed to their matching kecamatan;
 * a matching folder name or SO number keeps everything under it. Without a search,
 * empty folders stay so they remain drop targets.
 */
function filterGroups(groups: BanpangGroup[], search: string): BanpangGroup[] {
  const q = search.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => {
      if (g.folder && g.folder.name.toLowerCase().includes(q)) return g;
      const salesOrders = g.salesOrders
        .filter((so) => salesOrderMatches(so, q))
        .map((so) =>
          so.soNumber.toLowerCase().includes(q)
            ? so
            : {
                ...so,
                destinations: so.destinations.filter(
                  (d) =>
                    d.name.toLowerCase().includes(q) ||
                    d.documents.some((doc) => doc.documentNumber.toLowerCase().includes(q)),
                ),
              },
        );
      return { ...g, salesOrders };
    })
    .filter((g) => g.salesOrders.length > 0 || (g.folder && g.folder.name.toLowerCase().includes(q)));
}

/** Grip that starts dragging a sales order; sits inside a <summary>, so clicks must not toggle it */
function DragHandle({ data }: { data: SalesOrderDragData }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `so::${data.soNumber}`, data });
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={stopClick}
      className={`-ml-1 shrink-0 cursor-grab touch-none rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 ${
        isDragging ? "opacity-40" : ""
      }`}
      aria-label={`Seret ${data.soNumber} ke folder`}
      title="Seret ke folder"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

/** Drop target of a folder (or of "Belum dikelompokkan"); lights up while a sales order from elsewhere is dragged */
function useFolderDrop(folderUuid: string | null) {
  const { active } = useDndContext();
  const { setNodeRef, isOver } = useDroppable({ id: `banpang-drop::${folderUuid ?? "none"}`, data: { folderUuid } });
  const dragged = active?.data.current as SalesOrderDragData | undefined;
  const accepts = !!dragged && "soNumber" in dragged && dragged.fromFolderUuid !== folderUuid;
  return { setNodeRef, accepts, isOver: accepts && isOver };
}

function SalesOrderRow({
  so,
  folderUuid,
  canDrag,
  forceOpen,
}: {
  so: BanpangSalesOrder;
  folderUuid: string | null;
  canDrag: boolean;
  forceOpen: boolean;
}) {
  return (
    <details className="group/product" open={forceOpen || undefined}>
      <summary className={`${summaryClass} py-3`}>
        <Chevron level="product" />
        {canDrag && <DragHandle data={{ soNumber: so.soNumber, fromFolderUuid: folderUuid }} />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{so.soNumber}</div>
          <div className="text-[11px] text-slate-400">
            {so.summary.destinationCount} kecamatan · {so.summary.documentCount} dokumen · {formatRange(so.summary)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            <ProductLines products={so.summary.products} />
          </div>
        </div>
        <span className="ml-auto shrink-0 pl-3 text-right text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
          {formatKg(so.summary.kg)}
        </span>
      </summary>

      <div className="mb-2 ml-5 divide-y divide-slate-100 border-l border-slate-100 dark:divide-slate-800 dark:border-slate-800">
        {so.destinations.map((d) => (
          <details key={d.name} className="group/sender" open={forceOpen || undefined}>
            <summary className={`${summaryClass} py-2.5 pl-3 text-sm`}>
              <Chevron level="sender" />
              <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-slate-700 dark:text-slate-200">{d.name}</div>
                <div className="text-[11px] text-slate-400">
                  {d.summary.documentCount} dokumen · {formatRange(d.summary)}
                </div>
              </div>
              <span className="ml-auto shrink-0 pl-3 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">
                {formatKg(d.summary.kg)}
              </span>
            </summary>

            <div className="mb-2 ml-8 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-[11px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="py-1 pr-2">Dokumen</th>
                    <th className="py-1 px-2">Tanggal selesai</th>
                    <th className="py-1 px-2">Produk</th>
                    <th className="py-1 pl-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {d.documents.map((doc) => (
                    <tr key={doc.documentUuid} className="align-top">
                      <td className="whitespace-nowrap py-1.5 pr-2">
                        <Link
                          href={`/erp-documents/${doc.documentUuid}`}
                          className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {doc.documentNumber}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap py-1.5 px-2 text-slate-500">{formatDateId(doc.dateDone)}</td>
                      {/* max-w-0 + w-full lets the product name truncate instead of widening the table */}
                      <td className="w-full max-w-0 py-1.5 px-2 text-slate-500">
                        <ProductLines products={doc.products} />
                      </td>
                      <td className="whitespace-nowrap py-1.5 pl-2 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">
                        {formatKg(doc.kg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}

function SalesOrderRows({
  group,
  canDrag,
  forceOpen,
}: {
  group: BanpangGroup;
  canDrag: boolean;
  forceOpen: boolean;
}) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {group.salesOrders.map((so) => (
        <SalesOrderRow
          key={so.soNumber}
          so={so}
          folderUuid={group.folder?.uuid ?? null}
          canDrag={canDrag}
          forceOpen={forceOpen}
        />
      ))}
    </div>
  );
}

function GroupSummaryLine({ group }: { group: BanpangGroup }) {
  const { summary } = group;
  return (
    <span className="block text-[11px] text-slate-400">
      {summary.salesOrderCount} SO · {summary.destinationCount} kecamatan · {summary.documentCount} dokumen
      {summary.firstDoneAt && <> · {formatRange(summary)}</>}
    </span>
  );
}

function GroupTotal({ group }: { group: BanpangGroup }) {
  return (
    <span className="ml-auto shrink-0 pl-3 text-right">
      <span className="block text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
        {formatKg(group.summary.kg)}
      </span>
      <span className="block text-[11px] tabular-nums text-slate-400">{formatPct(group.summary.sharePct)} realisasi</span>
    </span>
  );
}

/** A manual folder of sales orders: collapsible, droppable, renamable */
function BanpangFolderSection({ group, canEdit, forceOpen }: { group: BanpangGroup; canEdit: boolean; forceOpen: boolean }) {
  const folder = group.folder!;
  const { setNodeRef, accepts, isOver } = useFolderDrop(folder.uuid);
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
      await renameBanpangFolder(folder.uuid, { name: next });
      setEditing(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal mengganti nama folder."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Hapus folder "${folder.name}"? SO di dalamnya kembali ke "Belum dikelompokkan".`)) return;
    setBusy(true);
    try {
      await deleteBanpangFolder(folder.uuid);
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
          <GroupSummaryLine group={group} />
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
        <GroupTotal group={group} />
      </summary>

      <div className="px-3 pb-3">
        {group.salesOrders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400 dark:border-slate-700">
            Belum ada SO pada rentang tanggal ini. Seret SO ke sini.
          </p>
        ) : (
          <SalesOrderRows group={group} canDrag={canEdit} forceOpen={forceOpen} />
        )}
      </div>
    </details>
  );
}

/** Sales orders not in any folder; also the drop target to take a sales order out of a folder */
function UngroupedSection({ group, canEdit, forceOpen }: { group: BanpangGroup; canEdit: boolean; forceOpen: boolean }) {
  const { setNodeRef, accepts, isOver } = useFolderDrop(null);
  return (
    <div ref={setNodeRef} className={`rounded-xl px-3 py-2 transition-shadow ${dropClass(accepts, isOver)}`}>
      <div className="flex items-center gap-2 py-1">
        <Inbox className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-600 dark:text-slate-300">Belum dikelompokkan</div>
          {group.salesOrders.length > 0 && <GroupSummaryLine group={group} />}
        </div>
        {group.salesOrders.length > 0 && <GroupTotal group={group} />}
      </div>
      {group.salesOrders.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400">Semua SO pada rentang ini sudah masuk folder.</p>
      ) : (
        <SalesOrderRows group={group} canDrag={canEdit} forceOpen={forceOpen} />
      )}
    </div>
  );
}

function SalesOrderList({ data, search }: { data: BanpangRealizationResponse; search: string }) {
  const canEdit = useAuthStore((s) => s.hasPermission("update", "Report"));
  const [dragging, setDragging] = useState<SalesOrderDragData | null>(null);
  const [moving, setMoving] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const visible = useMemo(() => filterGroups(data.groups, search), [data, search]);
  const forceOpen = search.trim().length > 0;
  const folderGroups = visible.filter((g) => g.folder);
  const ungrouped = visible.find((g) => !g.folder);
  const hasFolders = data.groups.some((g) => g.folder);

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current as SalesOrderDragData) ?? null);

  const onDragEnd = async (e: DragEndEvent) => {
    setDragging(null);
    const item = e.active.data.current as SalesOrderDragData | undefined;
    const target = e.over?.data.current as { folderUuid: string | null } | undefined;
    if (!item || !target || target.folderUuid === item.fromFolderUuid) return;

    setMoving(true);
    try {
      await moveBanpangSalesOrder({ soNumber: item.soNumber, folderUuid: target.folderUuid });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal memindahkan SO ke folder."));
    } finally {
      setMoving(false);
    }
  };

  const noData = data.totals.salesOrderCount === 0;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={(e) => void onDragEnd(e)}
      onDragCancel={() => setDragging(null)}
    >
      <div className="space-y-2">
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <NewFolderButton onCreate={(name) => createBanpangFolder({ name })} />
            {hasFolders && (
              <span className="text-[11px] text-slate-400">
                Seret <GripVertical className="inline h-3 w-3 align-[-2px]" /> SO ke folder untuk mengelompokkan.
              </span>
            )}
            {moving && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400" role="status">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyimpan pengelompokan…
              </span>
            )}
          </div>
        )}

        {noData && !hasFolders ? (
          <p className="py-12 text-center text-sm text-slate-400">
            Tidak ada realisasi Badan Pangan Nasional pada rentang tanggal ini.
          </p>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">Tidak ada folder, SO, atau kecamatan yang cocok.</p>
        ) : hasFolders ? (
          <>
            {folderGroups.map((g) => (
              <BanpangFolderSection key={g.folder!.uuid} group={g} canEdit={canEdit} forceOpen={forceOpen} />
            ))}
            {ungrouped && <UngroupedSection group={ungrouped} canEdit={canEdit} forceOpen={forceOpen} />}
          </>
        ) : (
          ungrouped && <SalesOrderRows group={ungrouped} canDrag={false} forceOpen={forceOpen} />
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-700 shadow-lg dark:border-blue-700 dark:bg-slate-800 dark:text-slate-100">
            <GripVertical className="h-3.5 w-3.5 text-slate-400" />
            {dragging.soNumber}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/** Realization of Badan Pangan Nasional: done outgoing documents grouped by SO, then kecamatan */
export default function BanpangRealizationSection({ cardClass }: { cardClass: string }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return toDateString(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => toDateString(new Date()));
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const validRange = Boolean(startDate && endDate && startDate <= endDate);
  const { realization, isLoading, error } = useBanpangRealization({
    startDate: validRange ? startDate : "",
    endDate: validRange ? endDate : "",
  });
  const totals = realization?.totals;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Realisasi"
          icon={Truck}
          tone="blue"
          value={totals ? formatQty(Math.round(totals.kg)) : null}
          unit="Kg"
          details={totals ? qtyPerUom(totals.products) : []}
        />
        <SummaryCard label="Sales Order" icon={FileText} tone="emerald" value={totals ? String(totals.salesOrderCount) : null} unit="SO" />
        <SummaryCard
          label="Kecamatan"
          icon={MapPin}
          tone="orange"
          value={totals ? String(totals.destinationCount) : null}
          unit="kecamatan"
        />
        <SummaryCard
          label="Dokumen keluar"
          icon={CalendarRange}
          tone="violet"
          value={totals ? String(totals.documentCount) : null}
          unit="dokumen"
          details={totals?.firstDoneAt ? [formatRange(totals)] : []}
        />
      </div>

      <div className={`${cardClass} space-y-3`}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
              <Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              Banpang Realization
            </h2>
            <p className="text-xs text-slate-400">
              Dokumen keluar selesai untuk Badan Pangan Nasional, per SO lalu per kecamatan (picking ref ERP). Kelompokkan
              SO ke dalam folder.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
            <div className="space-y-1">
              <label htmlFor="banpang-start" className={labelClass}>Dari</label>
              <input
                id="banpang-start"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="banpang-end" className={labelClass}>Sampai</label>
              <input
                id="banpang-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="relative col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari folder, SO, kecamatan, dokumen"
                aria-label="Cari folder, SO, kecamatan, dokumen"
                className={`${inputClass} pl-9 sm:w-64`}
              />
            </div>
          </div>
        </div>

        {!validRange ? (
          <p className="py-16 text-center text-sm text-amber-600">Tanggal mulai tidak boleh setelah tanggal akhir.</p>
        ) : error ? (
          <p className="py-16 text-center text-sm text-red-500">Gagal memuat realisasi. Coba muat ulang halaman.</p>
        ) : !realization && isLoading ? (
          <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : realization ? (
          <div className={isLoading ? "opacity-60 transition-opacity" : ""}>
            <SalesOrderList data={realization} search={search} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

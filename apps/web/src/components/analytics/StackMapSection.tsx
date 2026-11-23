"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Eye,
  EyeOff,
  FileText,
  ImageDown,
  LayoutGrid,
  MousePointerClick,
  Search,
  StickyNote,
  Warehouse,
  X,
} from "lucide-react";
import type { StockInboundResponse } from "@bulog-wms/schema";
import {
  saveStackMapArea,
  saveStackMapLabel,
  useStackMapSettings,
} from "@/hooks/useAnalytics";
import { useAuthStore } from "@/store/auth";
import { apiErrorMessage } from "@/components/analytics/InboundFolderSection";
import {
  formatDateId,
  formatProductName,
  formatQty,
} from "@/components/analytics/format";
import {
  buildStackMapAreas,
  buildStackMapStacks,
  formatStackNumber,
  formatStackTotals,
  isSackUom,
  stackMatches,
  type StackMapAreaLayout,
  type StackMapStack,
} from "@/components/analytics/stack-map";
import { downloadStackMapImage, downloadStackMapPdf } from "@/components/analytics/stack-map-image";

interface StackCardProps {
  stack: StackMapStack;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
}

function StackCard({ stack, selected, dimmed, onSelect }: StackCardProps) {
  const title = stack.label?.title;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={[
        stack.locationName,
        ...stack.products.map((p) => `${p.sku} · ${formatProductName(p.name)}`),
      ].join("\n")}
      className={`flex h-full w-full min-w-0 flex-col gap-0.5 rounded-xl border bg-white p-2 text-left transition cursor-pointer dark:bg-slate-900 ${
        selected
          ? "border-blue-500 ring-2 ring-blue-500/30 dark:border-blue-400"
          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
      } ${stack.label?.hidden ? "border-dashed bg-slate-50 dark:bg-slate-900/40" : ""} ${
        dimmed ? "opacity-30" : stack.label?.hidden ? "opacity-60" : ""
      }`}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="break-all font-mono text-[11px] text-slate-500 dark:text-slate-400">
          {stack.code}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {stack.label?.note && (
            <StickyNote
              className="h-3 w-3 text-amber-500"
              aria-label="Ada catatan"
            />
          )}
          {stack.label?.hidden && (
            <EyeOff
              className="h-3 w-3 text-slate-400"
              aria-label="Disembunyikan"
            />
          )}
        </span>
      </span>
      {/* Nothing is cut: long titles and product names wrap */}
      <span
        className={`break-words text-xs ${
          title
            ? "font-bold text-slate-800 dark:text-slate-100"
            : "italic text-slate-500 dark:text-slate-400"
        }`}
      >
        {title || "Tanpa judul"}
      </span>
      {stack.products.map((p) => (
        <span key={p.productUuid} className="mt-0.5 flex flex-col">
          <span className="break-all font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            {p.sku}
            {stack.products.length > 1 && (
              <span className="ml-1 font-sans font-normal text-slate-500 dark:text-slate-400">
                {formatStackTotals([{ ...p.unit, displayQty: p.displayQty }], p.sacks)}
              </span>
            )}
          </span>
          <span className="break-words text-[11px] leading-snug text-slate-600 dark:text-slate-300">
            {formatProductName(p.name)}
          </span>
        </span>
      ))}
      <span className="mt-auto break-words pt-1 text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {formatStackTotals(stack.totals, stack.sacks)}
      </span>
    </button>
  );
}

interface AreaMapProps {
  layout: StackMapAreaLayout;
  selectedUuid: string | null;
  query: string;
  canEdit: boolean;
  onSelect: (stack: StackMapStack) => void;
}

function AreaMap({
  layout,
  selectedUuid,
  query,
  canEdit,
  onSelect,
}: AreaMapProps) {
  const [saving, setSaving] = useState(false);
  // A row letter is as wide as its most stacks sharing one number, since those sit side by side
  const columns = {
    gridTemplateColumns: `1.75rem ${
      layout.rowWidths.map((n) => `minmax(${n * 7.5}rem, ${n}fr)`).join(" ") ||
      "minmax(7.5rem, 1fr)"
    }`,
  };

  const toggleOrder = async () => {
    setSaving(true);
    try {
      await saveStackMapArea({
        area: layout.area,
        descending: !layout.descending,
      });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal mengubah urutan baris."));
    } finally {
      setSaving(false);
    }
  };

  const renderStack = (s: StackMapStack) => (
    <StackCard
      key={s.locationUuid}
      stack={s}
      selected={s.locationUuid === selectedUuid}
      dimmed={!stackMatches(s, query)}
      onSelect={() => onSelect(s)}
    />
  );

  return (
    <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/30">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-50">
          <Warehouse
            className="h-4 w-4 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
          {layout.area}
          <span className="text-xs font-normal text-slate-400">
            {layout.stackCount} tumpukan ·{" "}
            {formatStackTotals(layout.totals, layout.sacks)}
          </span>
        </h3>
        {layout.rows.length > 1 && (
          <button
            type="button"
            onClick={toggleOrder}
            disabled={!canEdit || saving}
            title={canEdit ? "Balik urutan baris" : "Urutan baris"}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:disabled:hover:bg-slate-900 cursor-pointer"
          >
            {canEdit && (
              <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
            )}
            {layout.rows.join("-")}
          </button>
        )}
      </div>

      {layout.lines.length > 0 && (
        <div className="overflow-x-auto">
          <div className="min-w-fit space-y-1.5">
            {/* Row letters left to right, numbers top to bottom */}
            <div className="grid gap-1.5" style={columns}>
              <span />
              {layout.rows.map((row) => (
                <div
                  key={row}
                  className="rounded-lg bg-slate-200/70 py-0.5 text-center text-xs font-bold text-slate-600 dark:bg-slate-700/60 dark:text-slate-300"
                >
                  {row}
                </div>
              ))}
            </div>
            {layout.lines.map((line) => (
              <div key={line.number} className="grid gap-1.5" style={columns}>
                <div className="flex items-center justify-center text-[11px] font-bold text-slate-400">
                  {formatStackNumber(line.number)}
                </div>
                {line.cells.map((cell, i) =>
                  cell.stacks.length > 0 ? (
                    // At most rowWidths[i] stacks side by side; more wrap below in the same position
                    <div
                      key={cell.row}
                      className="grid min-w-0 gap-1.5"
                      style={{
                        gridTemplateColumns: `repeat(${Math.min(cell.stacks.length, layout.rowWidths[i])}, minmax(0, 1fr))`,
                      }}
                    >
                      {cell.stacks.map((s) => (
                        <div key={s.locationUuid} className="min-w-0">
                          {renderStack(s)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      key={cell.row}
                      className="flex min-h-[7.25rem] flex-col justify-center rounded-xl border border-dashed border-slate-200 p-2 text-[10px] text-slate-300 dark:border-slate-700 dark:text-slate-600"
                    >
                      <span className="font-mono">
                        {cell.row}
                        {formatStackNumber(cell.number)}
                      </span>
                      Kosong
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {layout.others.length > 0 && (
        <div className={layout.lines.length > 0 ? "mt-3" : ""}>
          {layout.lines.length > 0 && (
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Lokasi lain
            </p>
          )}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {layout.others.map(renderStack)}
          </div>
        </div>
      )}
    </section>
  );
}

function StackDetail({
  stack,
  canEdit,
  onClose,
}: {
  stack: StackMapStack;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(stack.label?.title ?? "");
  const [note, setNote] = useState(stack.label?.note ?? "");
  const [saving, setSaving] = useState(false);
  const lotCount = stack.products.reduce((sum, p) => sum + p.lots.length, 0);
  const dirty =
    title.trim() !== (stack.label?.title ?? "") ||
    note.trim() !== (stack.label?.note ?? "");

  const hidden = stack.label?.hidden ?? false;
  const [hiding, setHiding] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveStackMapLabel({
        locationUuid: stack.locationUuid,
        title: title.trim(),
        note: note.trim(),
        hidden,
      });
      toast.success("Judul dan catatan tumpukan disimpan.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal menyimpan judul dan catatan."));
    } finally {
      setSaving(false);
    }
  };

  /** Hides the stack from the map for everyone, or shows it again; keeps the typed title and note */
  const toggleHidden = async () => {
    setHiding(true);
    try {
      await saveStackMapLabel({
        locationUuid: stack.locationUuid,
        title: title.trim(),
        note: note.trim(),
        hidden: !hidden,
      });
      toast.success(
        hidden
          ? `${stack.code} ditampilkan lagi di peta.`
          : `${stack.code} disembunyikan dari peta.`,
      );
    } catch (err) {
      toast.error(
        apiErrorMessage(
          err,
          hidden
            ? "Gagal menampilkan tumpukan."
            : "Gagal menyembunyikan tumpukan.",
        ),
      );
    } finally {
      setHiding(false);
    }
  };

  const fieldClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:disabled:bg-slate-800/50";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-400">
            {stack.locationName}
          </p>
          <h3
            className={`break-words text-base font-bold ${
              stack.label?.title
                ? "text-slate-900 dark:text-slate-50"
                : "italic text-slate-400"
            }`}
          >
            {stack.label?.title || "Tanpa judul"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {stack.products.length} SKU · {lotCount} lot ·{" "}
            {formatStackTotals(stack.totals, stack.sacks)}
          </p>
          {hidden && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <EyeOff className="h-3 w-3" aria-hidden="true" />
              Disembunyikan dari peta
            </span>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={toggleHidden}
            disabled={hiding}
            title={hidden ? "Tampilkan lagi di peta" : "Sembunyikan dari peta"}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            {hidden ? (
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {hidden ? "Tampilkan" : "Sembunyikan"}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          aria-label="Tutup rincian"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="space-y-1">
          <label
            htmlFor="stack-title"
            className="text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Judul tumpukan
          </label>
          <input
            id="stack-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            disabled={!canEdit}
            placeholder="Beras PSO Kanwil"
            className={fieldClass}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="stack-note"
            className="text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Catatan
          </label>
          <textarea
            id="stack-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            disabled={!canEdit}
            placeholder="Prioritas keluar minggu ini"
            className={`${fieldClass} resize-y`}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">
            {stack.label
              ? `Diubah ${formatDateId(stack.label.updatedAt)}${stack.label.updatedBy ? ` oleh ${stack.label.updatedBy}` : ""}`
              : ""}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {stack.products.map((p) => (
          <div
            key={p.productUuid}
            className="border-t border-slate-100 pt-3 dark:border-slate-800"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
                  {p.sku}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatProductName(p.name)}
                </p>
              </div>
              <span className="shrink-0 whitespace-nowrap text-right text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {formatStackTotals(
                  [{ ...p.unit, displayQty: p.displayQty }],
                  p.sacks,
                )}
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {p.lots.map((lot, i) => (
                <li
                  key={`${lot.lotName}-${lot.senderName}-${i}`}
                  className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] dark:bg-slate-800/50"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-slate-700 dark:text-slate-200">
                      {lot.lotName || "Tanpa lot"}
                    </p>
                    <p
                      className="break-words text-slate-500 dark:text-slate-400"
                      title={lot.senderName}
                    >
                      {lot.senderName}
                    </p>
                    {lot.pendingGate ? (
                      <Link
                        href={`/gate-operations/${lot.pendingGate.gateOperationUuid}`}
                        className="mt-0.5 inline-block rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 hover:underline dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
                      >
                        {lot.pendingGate.cardType === "OUT"
                          ? "Keluar"
                          : "Masuk"}{" "}
                        belum adm. · {lot.pendingGate.opNumber}
                      </Link>
                    ) : (
                      lot.documents.slice(0, 2).map((d) => (
                        <Link
                          key={d.documentUuid}
                          href={`/erp-documents/${d.documentUuid}`}
                          className="mr-2 font-mono text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {d.documentNumber}
                        </Link>
                      ))
                    )}
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <p className="whitespace-nowrap font-bold text-slate-700 dark:text-slate-200">
                      {formatStackTotals(
                        [{ ...p.unit, displayQty: lot.displayQty }],
                        isSackUom(p.uom) ? lot.qty : 0,
                      )}
                    </p>
                    {!isSackUom(p.uom) && p.uom !== p.unit.displayUnit && (
                      <p className="text-slate-400">
                        {formatQty(lot.qty)} {p.uom}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

interface StackMapSectionProps {
  cardClass: string;
  stockInbound: StockInboundResponse | undefined;
  isLoading: boolean;
  error: unknown;
}

/** Peta tumpukan: each area as rows (A, B, C) left to right and numbers top to bottom */
export default function StackMapSection({
  cardClass,
  stockInbound,
  isLoading,
  error,
}: StackMapSectionProps) {
  const { stackMapSettings, error: settingsError } = useStackMapSettings();
  const canEdit = useAuthStore((s) => s.hasPermission("update", "Report"));
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(
      () => setQuery(searchInput.trim().toLowerCase()),
      200,
    );
    return () => clearTimeout(timer);
  }, [searchInput]);

  const stacks = useMemo(
    () =>
      buildStackMapStacks(
        stockInbound?.products ?? [],
        stackMapSettings?.labels ?? [],
      ),
    [stockInbound, stackMapSettings],
  );
  // Hidden stacks leave the map, its totals and its image unless "Tampilkan tersembunyi" is on
  const [showHidden, setShowHidden] = useState(false);
  const visibleStacks = useMemo(
    () => (showHidden ? stacks : stacks.filter((s) => !s.label?.hidden)),
    [stacks, showHidden],
  );
  const hiddenByArea = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of stacks)
      if (s.label?.hidden) counts.set(s.area, (counts.get(s.area) ?? 0) + 1);
    return counts;
  }, [stacks]);
  const areas = useMemo(
    () =>
      buildStackMapAreas(
        visibleStacks,
        new Map(
          (stackMapSettings?.areas ?? []).map((a) => [a.area, a.descending]),
        ),
      ),
    [visibleStacks, stackMapSettings],
  );
  const selected = stacks.find((s) => s.locationUuid === selectedUuid) ?? null;
  const matchCount = query
    ? visibleStacks.filter((s) => stackMatches(s, query)).length
    : null;
  const areaMatches = useMemo(() => {
    const counts = new Map<string, number>();
    if (query)
      for (const s of visibleStacks)
        if (stackMatches(s, query))
          counts.set(s.area, (counts.get(s.area) ?? 0) + 1);
    return counts;
  }, [visibleStacks, query]);
  const hiddenTotal = Array.from(hiddenByArea.values()).reduce(
    (sum, n) => sum + n,
    0,
  );

  // Keep the chosen gudang while it has stock, else fall back to the first one
  const [activeAreaName, setActiveAreaName] = useState<string | null>(null);
  const activeArea = areas.find((a) => a.area === activeAreaName) ?? areas[0];
  // The detail follows the open gudang
  const shownStack =
    selected && selected.area === activeArea?.area ? selected : null;

  const warehouseName = useAuthStore((s) => s.activeWarehouse?.name);
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  const handleExport = async (format: "png" | "pdf") => {
    if (!activeArea) return;
    const label = format === "pdf" ? "PDF" : "Gambar";
    setExporting(format);
    try {
      if (format === "pdf") await downloadStackMapPdf(activeArea, warehouseName || "");
      else await downloadStackMapImage(activeArea, warehouseName || "");
      toast.success(`${label} ${activeArea.area} berhasil diunduh.`);
    } catch {
      toast.error(`Gagal membuat ${label.toLowerCase()} ${activeArea.area}.`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className={`${cardClass} space-y-4`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
            <LayoutGrid
              className="h-5 w-5 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            Peta tumpukan
          </h2>
          <p className="text-xs text-slate-400">
            Susunan tumpukan per area dari stok saat ini. Klik tumpukan untuk
            melihat rincian SKU dan lot, serta mengisi judul dan catatan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {matchCount !== null && (
            <span className="whitespace-nowrap text-xs text-slate-400">
              {matchCount} cocok
            </span>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari judul, SKU, produk, lot, tumpukan"
              className="w-full sm:w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {error ? (
        <p className="py-16 text-center text-sm text-red-500">
          Gagal memuat stok. Coba muat ulang halaman.
        </p>
      ) : !stockInbound && isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      ) : areas.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">
          Belum ada tumpukan berisi stok di gudang ini.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-3">
            {settingsError && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Judul, catatan, dan urutan baris gagal dimuat; peta memakai
                susunan bawaan.
              </p>
            )}
            {/* One gudang (area) at a time */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div
                role="tablist"
                aria-label="Gudang"
                className="flex min-w-0 gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800"
              >
                {areas.map((a) => {
                  const isActive = a.area === activeArea?.area;
                  const matches = query ? (areaMatches.get(a.area) ?? 0) : null;
                  return (
                    <button
                      key={a.area}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveAreaName(a.area)}
                      className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition cursor-pointer ${
                        isActive
                          ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                          : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      } ${matches === 0 ? "opacity-40" : ""}`}
                    >
                      {a.area}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {matches ?? a.stackCount}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex shrink-0 gap-2">
                {(hiddenTotal > 0 || showHidden) && (
                  <button
                    type="button"
                    onClick={() => setShowHidden((v) => !v)}
                    aria-pressed={showHidden}
                    className={`flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-bold shadow-xs transition cursor-pointer ${
                      showHidden
                        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {showHidden ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                    {showHidden ? "Sembunyikan lagi" : "Tampilkan tersembunyi"}
                    {(hiddenByArea.get(activeArea?.area ?? "") ?? 0) > 0 && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-700">
                        {hiddenByArea.get(activeArea?.area ?? "")}
                      </span>
                    )}
                  </button>
                )}
                {activeArea && (
                  <button
                    type="button"
                    onClick={() => handleExport("png")}
                    disabled={exporting !== null}
                    title={`Unduh gambar PNG ${activeArea.area}`}
                    className="flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <ImageDown
                      className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    {exporting === "png" ? "Membuat..." : "Gambar"}
                  </button>
                )}
                {activeArea && (
                  <button
                    type="button"
                    onClick={() => handleExport("pdf")}
                    disabled={exporting !== null}
                    title={`Unduh PDF ${activeArea.area} (tetap tajam saat diperbesar atau dicetak)`}
                    className="flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white shadow-xs transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    {exporting === "pdf" ? "Membuat..." : `PDF ${activeArea.area}`}
                  </button>
                )}
              </div>
            </div>
            {activeArea && (
              <AreaMap
                key={activeArea.area}
                layout={activeArea}
                selectedUuid={selectedUuid}
                query={query}
                canEdit={canEdit}
                onSelect={(s) => {
                  setSelectedUuid(s.locationUuid);
                  // Below xl the detail sits under the map, so bring it into view
                  if (window.innerWidth < 1280) {
                    requestAnimationFrame(() =>
                      detailRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      }),
                    );
                  }
                }}
              />
            )}
          </div>
          <aside
            ref={detailRef}
            className="scroll-mt-4 xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            {shownStack ? (
              <StackDetail
                key={`${shownStack.locationUuid}-${shownStack.label?.updatedAt ?? ""}`}
                stack={shownStack}
                canEdit={canEdit}
                onClose={() => setSelectedUuid(null)}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-slate-400">
                <MousePointerClick className="h-6 w-6" aria-hidden="true" />
                Pilih tumpukan untuk melihat rincian SKU dan lot.
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

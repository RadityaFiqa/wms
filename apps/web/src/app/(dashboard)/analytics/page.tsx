"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChartNoAxesCombined,
  Droplets,
  LayoutGrid,
  Layers,
  type LucideIcon,
  Weight,
  PackageSearch,
  RotateCcw,
  Search,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import SummaryCard from "@/components/analytics/SummaryCard";
import ProductFilterSelect from "@/components/analytics/ProductFilterSelect";
import type { AnalyticsAccount, FlowGranularity, FlowTrendGroup } from "@bulog-wms/schema";
import { useAuthStore } from "@/store/auth";
import { useFlowTrend, useStockInbound } from "@/hooks/useAnalytics";
import FlowTrendChart from "@/components/analytics/FlowTrendChart";
import ProductFlowBars from "@/components/analytics/ProductFlowBars";
import InboundGroupingTree from "@/components/analytics/InboundGroupingTree";
import { formatGroupNumber, formatGroupValue } from "@/components/analytics/format";

const toDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const RANGES = [
  { key: "3", label: "3 bulan terakhir" },
  { key: "6", label: "6 bulan terakhir" },
  { key: "12", label: "1 tahun terakhir" },
  { key: "36", label: "3 tahun terakhir" },
] as const;

const GRANULARITIES: { key: FlowGranularity; label: string }[] = [
  { key: "month", label: "Bulanan" },
  { key: "week", label: "Mingguan" },
  { key: "day", label: "Harian" },
];

// Same field style as the Laporan Mutasi filters
const selectClass =
  "w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 cursor-pointer";
const labelClass = "text-[10px] font-bold uppercase tracking-wider text-slate-400";

const cardClass =
  "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm";

const UNIT_ICONS: Record<string, LucideIcon> = { Kg: Weight, L: Droplets };

/** Last period with movement, so the SKU table opens on something useful */
const defaultPeriod = (group: FlowTrendGroup) =>
  [...group.points].reverse().find((p) => p.in > 0 || p.out > 0)?.period ?? group.points.at(-1)?.period ?? null;

export default function AnalyticsPage() {
  const { activeWarehouse } = useAuthStore();

  const [granularity, setGranularity] = useState<FlowGranularity>("month");
  const [months, setMonths] = useState("12");
  const [category, setCategory] = useState("");
  const [productUuid, setProductUuid] = useState("");
  const [account, setAccount] = useState<AnalyticsAccount | "">("");
  const [selectedPeriods, setSelectedPeriods] = useState<Record<string, string>>({});
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setMonth(start.getMonth() - Number(months));
    start.setDate(1);
    return { startDate: toDateString(start), endDate: toDateString(end) };
  }, [months]);

  const { flowTrend, isLoading: trendLoading, error: trendError } = useFlowTrend({
    startDate,
    endDate,
    granularity,
    category: category || undefined,
    account: account || undefined,
    productUuid: productUuid || undefined,
  });
  const { stockInbound, isLoading: stockLoading, error: stockError } = useStockInbound();

  const skuOptions = useMemo(
    () =>
      (flowTrend?.skuOptions ?? []).filter(
        (s) => !category || s.category === category || s.programs.includes(category),
      ),
    [flowTrend, category],
  );

  const hasActiveFilter = Boolean(productUuid || category || account || granularity !== "month" || months !== "12");
  const resetFilters = () => {
    setProductUuid("");
    setCategory("");
    setAccount("");
    setGranularity("month");
    setMonths("12");
  };

  const groups = flowTrend?.groups ?? [];
  // Keep the chosen tab while it exists in the data, else fall back to the first group
  const activeGroup = groups.find((g) => g.key === activeGroupKey) ?? groups[0];
  const [mainStock, ...otherStock] = stockInbound?.totals ?? [];

  /** Card props for this month's incoming or outgoing, main unit first */
  const monthCard = (side: "in" | "out") => {
    const [main, ...others] = groups;
    if (!flowTrend) return { value: null };
    if (!main) return { value: "0", details: ["Tidak ada pergerakan"] };
    const lastMonth = main.lastMonth[side];
    return {
      value: formatGroupNumber(main.thisMonth[side], main),
      unit: main.displayUnit,
      details: [
        `Bulan lalu ${formatGroupValue(lastMonth, main)}`,
        ...others
          .filter((g) => g.thisMonth[side] > 0)
          .map((g) => `+ ${formatGroupValue(g.thisMonth[side], g)}`),
      ],
      progress: lastMonth > 0 ? main.thisMonth[side] / lastMonth : undefined,
    };
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
          <ChartNoAxesCombined className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Visualization</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Tren barang masuk dan keluar serta asal stok saat ini ·{" "}
            <span className="font-semibold text-blue-600 dark:text-blue-400">{activeWarehouse?.name || "Belum dipilih"}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Stok saat ini"
          icon={Warehouse}
          tone="blue"
          value={stockInbound ? (mainStock ? formatGroupNumber(mainStock.displayQty, mainStock) : "0") : null}
          unit={mainStock?.displayUnit}
          details={otherStock.map((t) => `+ ${formatGroupValue(t.displayQty, t)}`)}
        />
        <SummaryCard label="Masuk bulan ini" icon={ArrowDownToLine} tone="emerald" {...monthCard("in")} />
        <SummaryCard label="Keluar bulan ini" icon={ArrowUpFromLine} tone="orange" {...monthCard("out")} />
        <SummaryCard
          label="Tumpukan terisi"
          icon={LayoutGrid}
          tone="violet"
          value={stockInbound ? String(stockInbound.stackCount) : null}
          unit="tumpukan"
          details={stockInbound ? [`${stockInbound.productCount} produk tersimpan`] : []}
        />
      </div>

      {/* Flow trend, one chart per unit group found in the data */}
      <div className={`${cardClass} space-y-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              Tren masuk vs keluar
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Dari dokumen ERP selesai, tanpa transfer internal. Klik satu titik untuk melihat produk apa saja yang masuk dan
              keluar.
            </p>
          </div>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset filter
            </button>
          )}
        </div>

        {/* Filters: what to look at (product, commodity, type), then how (period, range) */}
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-6 dark:border-slate-800 dark:bg-slate-800/30">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="analytics-product-filter" className={labelClass}>Produk</label>
            <ProductFilterSelect
              options={skuOptions}
              value={productUuid}
              onChange={setProductUuid}
              isLoading={trendLoading}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="analytics-category" className={labelClass}>Komoditas</label>
            <select
              id="analytics-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setProductUuid("");
              }}
              className={selectClass}
            >
              <option value="">Semua komoditas</option>
              {flowTrend && flowTrend.programs.length > 0 && (
                <optgroup label="Program">
                  {flowTrend.programs.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </optgroup>
              )}
              {flowTrend && (
                <optgroup label="Komoditas">
                  {flowTrend.categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="analytics-account" className={labelClass}>Jenis</label>
            <select
              id="analytics-account"
              value={account}
              onChange={(e) => setAccount(e.target.value as AnalyticsAccount | "")}
              className={selectClass}
            >
              <option value="">PSO + Komersil</option>
              <option value="PSO">PSO</option>
              <option value="Komersil">Komersil</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="analytics-granularity" className={labelClass}>Tampilkan per</label>
            <select
              id="analytics-granularity"
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as FlowGranularity)}
              className={selectClass}
            >
              {GRANULARITIES.map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="analytics-range" className={labelClass}>Rentang waktu</label>
            <select id="analytics-range" value={months} onChange={(e) => setMonths(e.target.value)} className={selectClass}>
              {RANGES.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        {trendError ? (
          <p className="py-16 text-center text-sm text-red-500">Gagal memuat tren. Coba muat ulang halaman.</p>
        ) : !flowTrend && trendLoading ? (
          <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : groups.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">Tidak ada barang masuk atau keluar untuk filter ini.</p>
        ) : (
          <div className={trendLoading ? "opacity-60 transition-opacity" : ""}>
            {/* One tab per unit group found in the data */}
            <div role="tablist" aria-label="Kelompok satuan" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
              {groups.map((g) => {
                const isActive = g.key === activeGroup?.key;
                const Icon = UNIT_ICONS[g.key] ?? Layers;
                return (
                  <button
                    key={g.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveGroupKey(g.key)}
                    className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition cursor-pointer ${
                      isActive
                        ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {g.label === g.displayUnit ? g.label : `${g.label} (${g.displayUnit})`}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {g.skus.length} produk
                    </span>
                  </button>
                );
              })}
            </div>

            {activeGroup && (() => {
              const group = activeGroup;
              const selected =
                selectedPeriods[group.key] && group.points.some((p) => p.period === selectedPeriods[group.key])
                  ? selectedPeriods[group.key]
                  : defaultPeriod(group);
              return (
                <div role="tabpanel">
                  <div className="mb-2 flex flex-wrap items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Total masuk <b className="text-emerald-600 dark:text-emerald-400">{formatGroupValue(group.totals.in, group)}</b>
                      {" · "}keluar <b className="text-orange-600 dark:text-orange-400">{formatGroupValue(group.totals.out, group)}</b>
                    </span>
                  </div>
                  <div className="space-y-4">
                    <FlowTrendChart
                      group={group}
                      granularity={flowTrend!.granularity}
                      selectedPeriod={selected}
                      onSelectPeriod={(period) => setSelectedPeriods((prev) => ({ ...prev, [group.key]: period }))}
                    />
                    {selected && (
                      <ProductFlowBars
                        key={`${group.key}-${selected}`}
                        group={group}
                        granularity={flowTrend!.granularity}
                        period={selected}
                      />
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Stock inbound grouping: commodity → sender → stack → lot */}
      <div className={`${cardClass} space-y-3`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
              <PackageSearch className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              Stok inbound grouping
            </h2>
            <p className="text-xs text-slate-400">
              Stok saat ini per produk, dikelompokkan menurut pengirim atau pengolahan dari dokumen masuk ERP. Buka untuk
              melihat tumpukan, lot, dan dokumennya.
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari produk, pengirim, tumpukan, lot"
              className="w-full sm:w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {stockError ? (
          <p className="py-16 text-center text-sm text-red-500">Gagal memuat stok. Coba muat ulang halaman.</p>
        ) : !stockInbound && stockLoading ? (
          <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : stockInbound ? (
          <InboundGroupingTree products={stockInbound.products} search={search} />
        ) : null}
      </div>
    </div>
  );
}

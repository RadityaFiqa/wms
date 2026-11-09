"use client";

import React, { useState } from "react";
import {
  useInventory,
  useInventoryDetail,
} from "@/hooks/useInventory";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
  Tag,
  Layers,
  Box,
  FileText,
  CheckCircle2,
  Weight,
  type LucideIcon,
} from "lucide-react";
import type {
  InventoryCommoditySummary,
  InventoryListItem,
  InventoryListSummary,
  SecondaryUnit,
} from "@bulog-wms/schema";
import { formatDecimal, formatQty } from "@/components/analytics/format";

/** Big unit for a secondary unit: Kg → Ton, L → KL */
const SECONDARY_BIG_UNIT: Record<SecondaryUnit, string> = { Kg: "Ton", L: "KL" };

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [category, setCategory] = useState("");

  const { activeWarehouse } = useAuthStore();

  // Custom hook for paginated stock data and PDF generation
  const { inventoryData, isLoading, refresh, exportPdf } =
    useInventory({
      search: debouncedSearch,
      page,
      limit,
      category: category || undefined,
    });

  const handleExportPdf = async () => {
    if (!activeWarehouse) {
      toast.error("Gudang aktif tidak terdeteksi.");
      return;
    }

    const toastId = toast.loading("Membuat berkas laporan PDF...");
    try {
      await exportPdf(debouncedSearch);
      toast.success("Laporan PDF berhasil diunduh.", { id: toastId });
    } catch (e: any) {
      toast.error("Gagal mengekspor laporan ke PDF.", { id: toastId });
    }
  };

  // The summary covers the whole warehouse whatever the filters; the hook keeps the previous
  // response while a new page or filter loads, so the commodity dropdown stays filled
  const summary: InventoryListSummary = inventoryData?.summary || {
    totalProducts: 0,
    totalLocations: 0,
    totalQuantity: 0,
    totalReserved: 0,
    totalAvailable: 0,
    secondaryTotals: [],
    commodities: [],
    programs: [],
  };

  // Total, reserved and available stock in Kg and L, from the per-commodity summary
  // (raw quantities mix Pack, Kg and Lembar, so they are not summed)
  const stockTotals = summary.commodities.reduce(
    (acc, c) => {
      if ((c.unit === "Kg" || c.unit === "L") && c.quantity !== null && c.available !== null) {
        acc.total[c.unit] += c.quantity;
        acc.available[c.unit] += c.available;
        acc.reserved[c.unit] += Math.max(0, c.quantity - c.available);
      }
      return acc;
    },
    { total: { Kg: 0, L: 0 }, reserved: { Kg: 0, L: 0 }, available: { Kg: 0, L: 0 } },
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight dark:text-slate-100">
            Status Persediaan
          </h1>
          <p className="text-slate-500 mt-1 text-sm dark:text-slate-400">
            Data stok barang termutakhir yang disinkronisasi dari ERP Odoo untuk
            gudang:{" "}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {activeWarehouse?.name || "Belum Dipilih"}
            </span>
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportPdf}
            className="flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-sm dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/60 dark:text-slate-200"
          >
            <FileText className="h-4.5 w-4.5 mr-2 text-slate-500 dark:text-slate-400" />
            Cetak PDF
          </button>
        </div>
      </div>

      {/* Summary Cards / Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryStatCard
          icon={Layers}
          tone="text-blue-600 bg-blue-50 border-blue-100/40 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-900/50"
          label="Produk & Lokasi"
          value={`${summary.totalProducts.toLocaleString("id-ID")} produk`}
          lines={[`${summary.totalLocations.toLocaleString("id-ID")} area lokasi`]}
        />
        <SummaryStatCard
          icon={Weight}
          tone="text-sky-600 bg-sky-50 border-sky-100/40 dark:text-sky-400 dark:bg-sky-950/40 dark:border-sky-900/50"
          label="Total Stok"
          value={formatStockTotal(stockTotals.total, "Kg")}
          lines={stockTotals.total.L > 0 ? [formatStockTotal(stockTotals.total, "L")] : []}
        />
        <SummaryStatCard
          icon={Tag}
          tone="text-amber-600 bg-amber-50 border-amber-100/40 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-900/50"
          label="Stok Dipesan"
          valueClassName="text-amber-600"
          value={formatStockTotal(stockTotals.reserved, "Kg")}
          lines={stockTotals.reserved.L > 0 ? [formatStockTotal(stockTotals.reserved, "L")] : []}
        />
        <SummaryStatCard
          icon={CheckCircle2}
          tone="text-emerald-600 bg-emerald-50 border-emerald-100/40 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/50"
          label="Stok Tersedia"
          valueClassName="text-emerald-600"
          value={formatStockTotal(stockTotals.available, "Kg")}
          lines={stockTotals.available.L > 0 ? [formatStockTotal(stockTotals.available, "L")] : []}
          progress={stockTotals.total.Kg > 0 ? stockTotals.available.Kg / stockTotals.total.Kg : undefined}
        />
      </div>

      {/* Filters Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex-1 max-w-md">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Cari SKU / Nama Produk
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari SKU atau nama produk..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
            />
          </div>
        </div>

        <div className="sm:w-56">
          <label
            htmlFor="inventory-category"
            className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2"
          >
            Komoditas
          </label>
          <select
            id="inventory-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer transition dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-200 dark:focus:bg-slate-900"
          >
            <option value="">Semua komoditas</option>
            {summary.programs.length > 0 && (
              <optgroup label="Program">
                {summary.programs.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Komoditas">
              {summary.commodities.map((c) => (
                <option key={c.category} value={c.category}>{c.category}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Baris per Halaman
          </label>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer transition min-w-[80px] dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-200 dark:focus:bg-slate-900"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Inventory Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto relative">
          <table className="w-full text-left border-collapse table-layout-fixed">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200 z-10 dark:bg-slate-800/95 dark:border-slate-800">
              <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4 w-[16%]">SKU</th>
                <th className="px-6 py-4 w-[30%]">Nama Produk</th>
                <th className="px-6 py-4 text-center w-[9%]">UOM</th>
                <th className="px-6 py-4 text-right w-[11%]">Total Quantity</th>
                <th className="px-6 py-4 text-right w-[13%]">Qty Sekunder</th>
                <th className="px-6 py-4 text-right w-[11%]">
                  Total Available
                </th>
                <th className="px-6 py-4 text-center w-[10%]">
                  Total Locations
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                Array.from({ length: limit }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 rounded w-24 dark:bg-slate-700"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 rounded w-48 dark:bg-slate-700"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 rounded w-8 mx-auto dark:bg-slate-700"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-200 rounded w-16 ml-auto dark:bg-slate-700"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-200 rounded w-16 ml-auto dark:bg-slate-700"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-200 rounded w-16 ml-auto dark:bg-slate-700"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-200 rounded w-12 mx-auto dark:bg-slate-700"></div>
                    </td>
                  </tr>
                ))
              ) : inventoryData?.data?.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-16 text-center text-slate-400 font-medium"
                  >
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Box className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                      <span>
                        Tidak ada data persediaan ditemukan. Silakan lakukan sinkronisasi data melalui halaman Pengaturan Odoo.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                // Products come sorted by name, so each commodity forms one block with a header row
                inventoryData?.data?.map((inv: InventoryListItem, idx: number) => {
                  const isNewGroup = idx === 0 || inventoryData.data[idx - 1].category !== inv.category;
                  const commodity = summary.commodities.find((c) => c.category === inv.category);
                  return (
                    <React.Fragment key={inv.uuid}>
                      {isNewGroup && <CommodityHeaderRow category={inv.category} commodity={commodity} />}
                      <ProductRow product={inv} />
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {inventoryData?.meta && (
          <div className="bg-slate-50 px-4 sm:px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 dark:bg-slate-800/40 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-semibold text-center sm:text-left dark:text-slate-400">
              Menampilkan {inventoryData.data.length} dari{" "}
              {inventoryData.meta.total} produk
            </span>

            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </button>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {page} / {inventoryData.meta.totalPages || 1}
              </span>
              <button
                disabled={page >= inventoryData.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60"
              >
                <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** "3.582,4 Ton" from a Kg/L total */
function formatStockTotal(totals: Record<SecondaryUnit, number>, unit: SecondaryUnit) {
  return `${formatDecimal(totals[unit] / 1000)} ${SECONDARY_BIG_UNIT[unit]}`;
}

function SummaryStatCard({
  icon: Icon,
  tone,
  label,
  value,
  valueClassName = "text-slate-800",
  lines = [],
  progress,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: string;
  valueClassName?: string;
  lines?: string[];
  progress?: number;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-center space-x-3.5">
        <div className={`p-2.5 rounded-lg border ${tone}`}>
          <Icon className="h-5.5 w-5.5" />
        </div>
        <div className="min-w-0">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
          <strong className={`block text-lg font-black ${valueClassName}`}>{value}</strong>
          {lines.map((line) => (
            <span key={line} className="block text-[11px] font-semibold text-slate-400">
              {line}
            </span>
          ))}
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Header row of a commodity block, with its stock in the whole warehouse.
 */
function CommodityHeaderRow({
  category,
  commodity,
}: {
  category: string;
  commodity?: InventoryCommoditySummary;
}) {
  const unit = commodity?.unit;
  const isSecondary = unit === "Kg" || unit === "L";
  const format = (value: number | null | undefined) => {
    if (value === null || value === undefined || !unit) return null;
    return isSecondary
      ? { main: `${formatDecimal(value / 1000)} ${SECONDARY_BIG_UNIT[unit as SecondaryUnit]}`, sub: `${formatQty(Math.round(value))} ${unit}` }
      : { main: `${formatQty(Math.round(value))} ${unit}`, sub: null };
  };
  const total = format(commodity?.quantity);
  const available = format(commodity?.available);

  return (
    <tr className="bg-slate-100/80 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-800">
      <td colSpan={4} className="px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black tracking-wider text-slate-800 dark:text-slate-100">{category}</span>
          {commodity && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white text-slate-500 font-bold text-[10px] border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800">
              {commodity.productCount} produk
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-2.5 text-right">
        {total ? (
          <>
            <div className="text-xs font-black text-slate-800 dark:text-slate-100">{total.main}</div>
            {total.sub && <div className="text-[10px] font-semibold text-slate-400">{total.sub}</div>}
          </>
        ) : (
          <span className="text-[10px] font-semibold text-slate-400">Satuan campuran</span>
        )}
      </td>
      <td className="px-6 py-2.5 text-right">
        {available && <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">{available.main}</div>}
      </td>
      <td className="px-6 py-2.5 text-center">
        {commodity && (
          <span className="inline-flex items-center text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <MapPin className="h-3 w-3 mr-1 text-slate-400" />
            {commodity.locationCount}
          </span>
        )}
      </td>
    </tr>
  );
}

/**
 * Product Row with expand functionality.
 */
interface ProductRowProps {
  product: InventoryListItem;
}

function ProductRow({ product }: ProductRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <tr
        onClick={() => setIsExpanded(!isExpanded)}
        className={`hover:bg-slate-50/70 border-b border-slate-100 transition cursor-pointer select-none dark:hover:bg-slate-800/60 dark:border-slate-800 ${
          isExpanded ? "bg-slate-50/40 dark:bg-slate-800/30" : ""
        }`}
      >
        <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
          <div className="p-0.5 rounded-md hover:bg-slate-200/80 transition dark:hover:bg-slate-700">
            {isExpanded ? (
              <ChevronDown className="h-4.5 w-4.5 text-slate-500 shrink-0 dark:text-slate-400" />
            ) : (
              <ChevronRight className="h-4.5 w-4.5 text-slate-500 shrink-0 dark:text-slate-400" />
            )}
          </div>
          <span className="select-all block truncate font-mono text-xs text-slate-900 dark:text-slate-100">
            {product.sku}
          </span>
        </td>
        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{product.name}</td>
        <td className="px-6 py-4 text-center">
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-xs border border-blue-100/50 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50">
            {product.uom}
          </span>
        </td>
        <td className="px-6 py-4 text-right font-black text-slate-700 dark:text-slate-200">
          {product.totalQuantity.toLocaleString("id-ID")}
        </td>
        <td className="px-6 py-4 text-right">
          {product.secondaryQuantity !== null && product.secondaryUnit ? (
            <>
              <div className="font-black text-slate-700 dark:text-slate-200">
                {formatQty(Math.round(product.secondaryQuantity))} {product.secondaryUnit}
              </div>
              <div className="text-[11px] font-semibold text-slate-400">
                {formatDecimal(product.secondaryQuantity / 1000)} {SECONDARY_BIG_UNIT[product.secondaryUnit]}
              </div>
            </>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">—</span>
          )}
        </td>
        <td className="px-6 py-4 text-right font-black text-emerald-600 bg-emerald-50/5 dark:text-emerald-400">
          {product.totalAvailable.toLocaleString("id-ID")}
        </td>
        <td className="px-6 py-4 text-center">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200/50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-800">
            <MapPin className="h-3 w-3 mr-1 text-slate-400" />
            {product.locationCount}
          </span>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td
            colSpan={7}
            className="bg-slate-50/50 px-8 py-5 border-b border-slate-200 dark:bg-slate-800/40 dark:border-slate-800"
          >
            <ProductDetailSection productUuid={product.uuid} secondaryUnit={product.secondaryUnit} />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Section that fetches and shows detail location/quants levels for expanded product.
 */
function ProductDetailSection({
  productUuid,
  secondaryUnit,
}: {
  productUuid: string;
  secondaryUnit: SecondaryUnit | null;
}) {
  const { detailData, isLoading, error } = useInventoryDetail(productUuid);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 space-x-2.5">
        <svg
          className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Memuat rincian lokasi dan tumpukan...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-500 font-bold py-4 bg-red-50 px-4 rounded-lg border border-red-150 dark:text-red-400 dark:bg-red-950/40 dark:border-red-900/50">
        Gagal memuat rincian: {error.response?.data?.message || error.message}
      </div>
    );
  }

  if (!detailData || detailData.locations.length === 0) {
    return (
      <div className="text-xs text-slate-400 font-semibold py-4 text-center">
        Tidak ada data lokasi atau tumpukan stok aktif untuk produk ini.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {detailData.locations.map((loc: any) => {
        let totalQty = 0;
        let totalReserved = 0;
        let totalAvailable = 0;
        let totalSecondary = 0;

        for (const q of loc.quants) {
          totalQty += q.quantity;
          totalReserved += q.reservedQuantity;
          totalAvailable += q.availableQuantity;
          totalSecondary += q.secondaryUnitQty || 0;
        }

        return (
          <div
            key={loc.locationUuid}
            className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900"
          >
            {/* Location Level Header */}
            <div className="bg-slate-100/70 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 gap-2 dark:bg-slate-800 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <MapPin className="h-4.5 w-4.5 text-blue-500 shrink-0" />
                <span className="font-bold text-slate-700 text-xs dark:text-slate-200">
                  {loc.locationDisplayName}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span>
                  Total Qty:{" "}
                  <strong className="text-slate-800 dark:text-slate-100">
                    {totalQty.toLocaleString("id-ID")}
                  </strong>
                  {secondaryUnit && totalSecondary > 0 && (
                    <>
                      {" · "}
                      <strong className="text-sky-700 dark:text-sky-400">
                        {formatQty(Math.round(totalSecondary))} {secondaryUnit}
                      </strong>
                    </>
                  )}
                </span>
                <span>
                  Reserved:{" "}
                  <strong className="text-amber-600 dark:text-amber-400">
                    {totalReserved.toLocaleString("id-ID")}
                  </strong>
                </span>
                <span>
                  Available:{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {totalAvailable.toLocaleString("id-ID")}
                  </strong>
                </span>
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100/40 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50">
                  {loc.quants.length} Tumpukan
                </span>
              </div>
            </div>

            {/* Nested Quants Level Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/30 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider dark:bg-slate-800/40 dark:border-slate-800">
                    <th className="px-5 py-2.5">Lot / Batch</th>
                    <th className="px-5 py-2.5 text-right">Quantity</th>
                    <th className="px-5 py-2.5 text-right">
                      Reserved Quantity
                    </th>
                    <th className="px-5 py-2.5 text-right font-bold text-emerald-600 bg-emerald-50/5 dark:text-emerald-400">
                      Available Quantity
                    </th>
                    <th className="px-5 py-2.5 text-right">
                      Secondary Unit Qty
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loc.quants.map((q: any) => (
                    <tr
                      key={q.uuid}
                      className="hover:bg-slate-50/20 transition bg-white dark:hover:bg-slate-800/60 dark:bg-slate-900"
                    >
                      <td className="px-5 py-3">
                        {/* ACCESSIBILITY & CONTRAST FIX FOR LOT BADGE */}
                        {q.lotName && q.lotName !== "-" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-xs">
                            <Tag className="h-3 w-3 mr-1 text-slate-500 dark:text-slate-400 shrink-0" />
                            {q.lotName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200 italic dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                            Tanpa Lot
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-700 dark:text-slate-200">
                        {q.quantity.toLocaleString("id-ID")}{" "}
                        <span className="text-slate-400 font-normal text-[10px] ml-0.5">
                          {detailData.product.uom}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                        {q.reservedQuantity.toLocaleString("id-ID")}{" "}
                        <span className="text-slate-400 font-normal text-[10px] ml-0.5">
                          {detailData.product.uom}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-emerald-600 bg-emerald-50/5 dark:text-emerald-400">
                        {q.availableQuantity.toLocaleString("id-ID")}{" "}
                        <span className="text-slate-400 font-normal text-[10px] ml-0.5">
                          {detailData.product.uom}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">
                        {q.secondaryUnitQty > 0 ? (
                          <span>
                            {q.secondaryUnitQty.toLocaleString("id-ID")}{" "}
                            <span className="text-slate-400 font-normal text-[10px] ml-0.5">
                              L/KG
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-350 dark:text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

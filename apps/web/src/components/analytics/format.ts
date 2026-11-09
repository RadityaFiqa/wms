import type { AnalyticsUnitGroup, FlowGranularity, StockOriginCategory } from "@bulog-wms/schema";

const decimal = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

/** 1.234,5 */
export const formatDecimal = (value: number) => decimal.format(value);
/** 13.430 */
export const formatQty = (value: number) => integer.format(value);

/** Ton/KL with one decimal, other units (Lembar) as whole counts, without the unit */
export function formatGroupNumber(value: number, group: Pick<AnalyticsUnitGroup, "key">) {
  const scaled = group.key === "Kg" || group.key === "L";
  return scaled ? formatDecimal(value) : formatQty(Math.round(value));
}

/** Same as formatGroupNumber, followed by the display unit */
export function formatGroupValue(value: number, group: Pick<AnalyticsUnitGroup, "displayUnit" | "key">) {
  return `${formatGroupNumber(value, group)} ${group.displayUnit}`;
}

/**
 * Product name as in the ERP, upper case, without its [SKU] prefix:
 * "[B0010053Z] BERAS MEDIUM HASIL REPROSES POLOS 50 KG PSO DN" →
 * "BERAS MEDIUM HASIL REPROSES POLOS 50 KG PSO DN"
 */
export function formatProductName(name: string) {
  return name.replace(/^\s*\[[^\]]*\]\s*/, "").trim().toUpperCase();
}

export const MONTHS_ID =["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Axis label for a period start (YYYY-MM-DD) */
export function formatPeriod(period: string, granularity: FlowGranularity) {
  const [year, month, day] = period.split("-").map(Number);
  if (granularity === "month") return `${MONTHS_ID[month - 1]} ${String(year).slice(2)}`;
  return `${day} ${MONTHS_ID[month - 1]}`;
}

/** Long label for a period start, used in headings */
export function formatPeriodLong(period: string, granularity: FlowGranularity) {
  const [year, month, day] = period.split("-").map(Number);
  if (granularity === "month") return `${MONTHS_ID[month - 1]} ${year}`;
  if (granularity === "week") return `minggu ${day} ${MONTHS_ID[month - 1]} ${year}`;
  return `${day} ${MONTHS_ID[month - 1]} ${year}`;
}

export function formatDateId(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const ORIGIN_BADGES: Record<StockOriginCategory, string> = {
  Pengadaan: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/40",
  Pengolahan: "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900/40",
  "Antar gudang": "bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-900/40",
  Lainnya: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  "Tidak tercatat": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40",
};

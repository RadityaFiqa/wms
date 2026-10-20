import React, { memo } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  QUANTITY_CALCULATION_MAX_ROWS,
  QUANTITY_EXPRESSION_MAX_LENGTH,
  evaluateQuantityCalculation,
  type QuantityCalculationSummary,
} from "@bulog-wms/schema";
import { formatQuantity } from "@/lib/quantity";

// Cache by array identity: untouched rows keep the same array between renders,
// so only the row being edited is re-evaluated.
const summaryCache = new WeakMap<string[], QuantityCalculationSummary>();

export function summarizeCalculationRows(
  rows: string[],
): QuantityCalculationSummary {
  let summary = summaryCache.get(rows);
  if (!summary) {
    summary = evaluateQuantityCalculation(rows);
    summaryCache.set(rows, summary);
  }
  return summary;
}

interface QuantityCalculatorRowsProps {
  /** Identifies the rows in onChange, so the parent can pass one stable callback. */
  rowsKey: string;
  rows: string[];
  onChange: (rowsKey: string, rows: string[]) => void;
  uom?: string | null;
  disabled?: boolean;
}

/**
 * Multi-row arithmetic calculator. Each row accepts an expression such as
 * "20x2x5" or "(10+5)x(2+3)"; the total of valid rows is shown below.
 */
export const QuantityCalculatorRows = memo(function QuantityCalculatorRows({
  rowsKey,
  rows,
  onChange,
  uom,
  disabled = false,
}: QuantityCalculatorRowsProps) {
  const summary = summarizeCalculationRows(rows);

  const updateRow = (index: number, value: string) => {
    const next = [...rows];
    next[index] = value;
    onChange(rowsKey, next);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(rowsKey, next.length > 0 ? next : [""]);
  };

  const addRow = () => {
    if (rows.length >= QUANTITY_CALCULATION_MAX_ROWS) return;
    onChange(rowsKey, [...rows, ""]);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_2rem] gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span>No</span>
        <span>Ekspresi</span>
        <span className="text-right">Hasil</span>
        <span />
      </div>

      {rows.map((expression, index) => {
        const result = summary.rows[index];
        const hasError = result?.status === "error";
        return (
          <div
            key={index}
            className="grid grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_2rem] gap-2 items-start"
          >
            <span className="pt-1.5 text-xs font-bold text-slate-400">
              {index + 1}
            </span>
            <div className="min-w-0">
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                disabled={disabled}
                maxLength={QUANTITY_EXPRESSION_MAX_LENGTH}
                value={expression}
                onChange={(e) => updateRow(index, e.target.value)}
                placeholder="contoh: 20x2x5"
                aria-invalid={hasError}
                className={`w-full bg-slate-50 dark:bg-slate-800 border text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed ${
                  hasError
                    ? "border-red-400 focus:border-red-500"
                    : "border-slate-250 dark:border-slate-700 focus:border-blue-500"
                }`}
              />
              {hasError && (
                <p className="mt-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                  {result.message}
                </p>
              )}
            </div>
            <span className="pt-1.5 text-right text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
              {result?.status === "ok" ? formatQuantity(result.value) : "-"}
            </span>
            {!disabled ? (
              <button
                type="button"
                onClick={() => removeRow(index)}
                title="Hapus baris"
                aria-label={`Hapus baris ${index + 1}`}
                className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span />
            )}
          </div>
        );
      })}

      {!disabled && (
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= QUANTITY_CALCULATION_MAX_ROWS}
          className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-500 disabled:text-slate-400 disabled:cursor-not-allowed transition cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah Baris
        </button>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
          Total Kuantum Fisik
        </span>
        <span className="text-sm font-black text-slate-800 dark:text-slate-100">
          {summary.total !== null ? formatQuantity(summary.total) : "-"}{" "}
          <span className="text-xs font-normal text-slate-400">{uom}</span>
        </span>
      </div>

      {!disabled && (
        <p className="text-[10px] text-slate-400">
          Operator: + − x / ( ). Gunakan titik (.) untuk desimal, tanpa pemisah
          ribuan.
        </p>
      )}
    </div>
  );
});

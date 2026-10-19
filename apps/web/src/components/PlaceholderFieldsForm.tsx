"use client";

import React from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";

export interface PlaceholderField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[] | null;
  columns?: Array<{ key: string; label: string }> | null;
}

interface PlaceholderFieldsFormProps {
  placeholders: PlaceholderField[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  /** Rendered read-only (e.g. values derived from a Tagihan) */
  disabledKeys?: string[];
}

const DEFAULT_TABLE_COLUMNS = [
  { key: "item", label: "Item / Keterangan" },
  { key: "value", label: "Nilai / Kuantitas" },
];

/** Initial value per placeholder type, matching what the generator expects */
export function initialPlaceholderValues(placeholders: PlaceholderField[]) {
  const initVals: Record<string, any> = {};
  placeholders.forEach((p) => {
    if (p.type === "BOOLEAN") {
      initVals[p.key] = false;
    } else if (p.type === "MULTI_SELECT") {
      initVals[p.key] = [];
    } else if (p.type === "TABLE") {
      const cols = p.columns && p.columns.length > 0 ? p.columns : [{ key: "item" }, { key: "value" }];
      const row: Record<string, any> = {};
      cols.forEach((col: any) => {
        row[col.key] = "";
      });
      initVals[p.key] = [row];
    } else {
      initVals[p.key] = "";
    }
  });
  return initVals;
}

/**
 * Dynamic inputs for template placeholders: typed fields in a grid, then
 * table (loop) sections full width.
 */
export default function PlaceholderFieldsForm({
  placeholders,
  values,
  onChange,
  disabledKeys = [],
}: PlaceholderFieldsFormProps) {
  const handleInputChange = (key: string, val: any) => {
    onChange({ ...values, [key]: val });
  };

  const handleTableChange = (key: string, rowIndex: number, colKey: string, val: any) => {
    const tableRows = [...(values[key] || [{}])];
    tableRows[rowIndex] = { ...tableRows[rowIndex], [colKey]: val };
    onChange({ ...values, [key]: tableRows });
  };

  const addTableRow = (pKey: string) => {
    const p = placeholders.find((item) => item.key === pKey);
    const columns = p?.columns && p.columns.length > 0 ? p.columns : [{ key: "item" }, { key: "value" }];

    const tableRows = [...(values[pKey] || [{}])];
    const newRow: Record<string, any> = {};
    columns.forEach((col: any) => {
      newRow[col.key] = "";
    });
    tableRows.push(newRow);
    onChange({ ...values, [pKey]: tableRows });
  };

  const removeTableRow = (key: string, rowIndex: number) => {
    const tableRows = [...(values[key] || [{}])];
    if (tableRows.length <= 1) return;
    tableRows.splice(rowIndex, 1);
    onChange({ ...values, [key]: tableRows });
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {placeholders.map((p) => {
          if (p.type === "TABLE") {
            // Table handles loops separately (full width)
            return null;
          }
          const disabled = disabledKeys.includes(p.key);

          return (
            <div key={p.key} className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {p.label}
                {p.required && !disabled && <span className="text-rose-500 ml-0.5">*</span>}
              </label>

              {disabled ? (
                <div className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 min-h-[38px] break-words">
                  {String(values[p.key] ?? "") || "-"}
                </div>
              ) : p.type === "BOOLEAN" ? (
                <div className="flex items-center space-x-2 py-1.5">
                  <input
                    type="checkbox"
                    id={`check-${p.key}`}
                    checked={values[p.key] || false}
                    onChange={(e) => handleInputChange(p.key, e.target.checked)}
                    className="h-4.5 w-4.5 text-blue-655 rounded border-slate-200 dark:border-slate-800 cursor-pointer"
                  />
                  <label htmlFor={`check-${p.key}`} className="text-xs text-slate-500 cursor-pointer">
                    Ya / Setuju
                  </label>
                </div>
              ) : p.type === "TEXTAREA" ? (
                <textarea
                  value={values[p.key] || ""}
                  onChange={(e) => handleInputChange(p.key, e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-white dark:bg-slate-900 min-h-[80px]"
                  required={p.required}
                  placeholder={`Masukkan ${p.label.toLowerCase()}...`}
                />
              ) : p.type === "DATE" ? (
                <input
                  type="date"
                  value={values[p.key] || ""}
                  onChange={(e) => handleInputChange(p.key, e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
                  required={p.required}
                />
              ) : p.type === "TIME" ? (
                <input
                  type="time"
                  value={values[p.key] || ""}
                  onChange={(e) => handleInputChange(p.key, e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
                  required={p.required}
                />
              ) : p.type === "DATETIME" ? (
                <input
                  type="datetime-local"
                  value={values[p.key] || ""}
                  onChange={(e) => handleInputChange(p.key, e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
                  required={p.required}
                />
              ) : p.type === "CURRENCY" ? (
                <div className="relative flex items-center">
                  <span className="absolute left-4 text-sm font-semibold text-slate-400">Rp</span>
                  <input
                    type="number"
                    value={values[p.key] ?? ""}
                    onChange={(e) => handleInputChange(p.key, e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    required={p.required}
                    placeholder="0"
                  />
                </div>
              ) : p.type === "NUMBER" ? (
                <input
                  type="number"
                  value={values[p.key] ?? ""}
                  onChange={(e) => handleInputChange(p.key, e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
                  required={p.required}
                  placeholder="0"
                />
              ) : p.type === "SELECT" ? (
                <select
                  value={values[p.key] || ""}
                  onChange={(e) => handleInputChange(p.key, e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none bg-white dark:bg-slate-900 focus:border-blue-500"
                  required={p.required}
                >
                  <option value="">-- Pilih {p.label} --</option>
                  {/* Keep a prefilled value visible even when it is not a configured option */}
                  {values[p.key] && !(p.options || []).includes(values[p.key]) && (
                    <option value={values[p.key]}>{values[p.key]}</option>
                  )}
                  {(p.options || []).map((opt: string) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : p.type === "MULTI_SELECT" ? (
                <div className="space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/50 max-h-[120px] overflow-y-auto">
                  {(p.options || []).map((opt: string) => {
                    const currentValues = Array.isArray(values[p.key]) ? values[p.key] : [];
                    const isChecked = currentValues.includes(opt);
                    return (
                      <label key={opt} className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...currentValues, opt]
                              : currentValues.filter((v: string) => v !== opt);
                            handleInputChange(p.key, updated);
                          }}
                          className="h-4 w-4 text-blue-600 rounded border-slate-250 dark:border-slate-800 cursor-pointer"
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              ) : p.type === "IMAGE" ? (
                <div className="space-y-2">
                  {values[p.key] ? (
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center space-x-2 min-w-0">
                        <div className="text-xs font-mono font-bold text-slate-550 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          IMG
                        </div>
                        <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[150px] md:max-w-[200px]" title={values[p.key]}>
                          {values[p.key].split("/").pop()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInputChange(p.key, "")}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const toastId = toast.loading("Mengunggah gambar...");
                          try {
                            const formData = new FormData();
                            formData.append("file", file);
                            const res = await api.post(API_ROUTES.storage.upload, formData, {
                              headers: { "Content-Type": "multipart/form-data" },
                            });
                            const filePath = res.data.filePath || res.data.url;
                            handleInputChange(p.key, filePath);
                            toast.success("Gambar berhasil diunggah!", { id: toastId });
                          } catch (err: any) {
                            toast.error("Gagal mengunggah gambar.", { id: toastId });
                          }
                        }}
                        className="hidden"
                        id={`image-upload-${p.key}`}
                      />
                      <label
                        htmlFor={`image-upload-${p.key}`}
                        className="flex items-center justify-center w-full px-4 py-2 border border-dashed border-slate-250 dark:border-slate-800 hover:bg-slate-55 dark:hover:bg-slate-850 rounded-xl text-xs cursor-pointer font-semibold text-slate-550 dark:text-slate-400 transition"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        Pilih Gambar
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={values[p.key] || ""}
                  onChange={(e) => handleInputChange(p.key, e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none"
                  required={p.required}
                  placeholder={`Masukkan ${p.label.toLowerCase()}...`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Table loops (Loops are placed at the bottom, full width) */}
      {placeholders
        .filter((p) => p.type === "TABLE" && !disabledKeys.includes(p.key))
        .map((p) => {
          const rows = values[p.key] || [{}];
          const columns = p.columns && p.columns.length > 0 ? p.columns : DEFAULT_TABLE_COLUMNS;

          return (
            <div key={p.key} className="space-y-3 border border-slate-200 dark:border-slate-850 p-4 rounded-xl bg-slate-50/20 dark:bg-slate-900/10">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tabel Section: {p.label}
                </label>
                <button
                  type="button"
                  onClick={() => addTableRow(p.key)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 font-bold px-2.5 py-1 rounded-md transition cursor-pointer text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
                >
                  + Tambah Baris
                </button>
              </div>

              {rows.map((row: any, rIdx: number) => (
                <div key={rIdx} className="flex items-start space-x-2 border-b border-slate-100 dark:border-slate-800 pb-3 last:border-b-0 last:pb-0">
                  <span className="text-xs text-slate-450 font-mono mt-2.5">#{rIdx + 1}</span>
                  <div className="grid gap-3 flex-1" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
                    {columns.map((col: any) => (
                      <div key={col.key}>
                        <input
                          type="text"
                          placeholder={col.label}
                          value={row[col.key] || ""}
                          onChange={(e) => handleTableChange(p.key, rIdx, col.key, e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-850 rounded-lg text-xs"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTableRow(p.key, rIdx)}
                    className="text-rose-500 hover:text-rose-700 p-1 mt-1 cursor-pointer transition"
                    disabled={rows.length <= 1}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          );
        })}
    </>
  );
}

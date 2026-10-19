"use client";

import React from "react";
import { X, Check } from "lucide-react";

interface TagihanDocumentModalShellProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  steps: string[];
  currentStep: number;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}

/** Shared frame (header, step indicator, scrollable body, footer) for Tagihan document modals */
export function TagihanDocumentModalShell({
  title,
  subtitle,
  icon,
  steps,
  currentStep,
  onClose,
  footer,
  children,
  wide = false,
}: TagihanDocumentModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full ${
          wide ? "max-w-5xl" : "max-w-3xl"
        } max-h-[92vh] flex flex-col overflow-hidden`}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shrink-0">
              {icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ol className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold">
          {steps.map((label, idx) => {
            const done = idx < currentStep;
            const active = idx === currentStep;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`flex items-center justify-center h-5 w-5 rounded-full border ${
                    done
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : active
                        ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                        : "border-slate-300 dark:border-slate-700 text-slate-400"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : idx + 1}
                </span>
                <span className={active ? "text-slate-800 dark:text-slate-100" : "text-slate-400"}>{label}</span>
                {idx < steps.length - 1 && <span className="text-slate-300 dark:text-slate-700">›</span>}
              </li>
            );
          })}
        </ol>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">{children}</div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-900">
          {footer}
        </div>
      </div>
    </div>
  );
}

/** Read-only key/value list used by the preview steps */
export function ValuePreviewList({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-3 gap-3 px-4 py-2 text-xs">
          <dt className="font-semibold text-slate-500 dark:text-slate-400">{r.label}</dt>
          <dd className="col-span-2 text-slate-800 dark:text-slate-100 break-words">{r.value || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

export const modalButton = {
  secondary:
    "px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50",
  primary:
    "px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/25 inline-flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
};

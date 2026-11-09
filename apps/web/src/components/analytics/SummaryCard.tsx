import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const TONES = {
  blue: { icon: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400", bar: "bg-blue-500" },
  emerald: { icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400", bar: "bg-emerald-500" },
  orange: { icon: "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400", bar: "bg-orange-500" },
  violet: { icon: "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400", bar: "bg-violet-500" },
} as const;

interface SummaryCardProps {
  label: string;
  icon: LucideIcon;
  tone: keyof typeof TONES;
  /** Main figure without its unit, already formatted; null while loading */
  value: string | null;
  unit?: string;
  /** Supporting lines under the figure */
  details?: ReactNode[];
  /** 0..1, drawn as a thin bar under the card (e.g. this month vs last month) */
  progress?: number;
}

export default function SummaryCard({ label, icon: Icon, tone, value, unit, details = [], progress }: SummaryCardProps) {
  const colors = TONES[tone];
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors.icon}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>

      {value === null ? (
        <div className="mt-2 h-8 w-28 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      ) : (
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums dark:text-slate-50">
            {value}
          </span>
          {unit && <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{unit}</span>}
        </div>
      )}

      {details.length > 0 && (
        <div className="mt-2 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
          {details.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
      )}

      {progress !== undefined && (
        <div className="mt-auto pt-3">
          <div className="h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

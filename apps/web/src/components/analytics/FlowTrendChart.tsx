"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FlowGranularity, FlowTrendGroup } from "@bulog-wms/schema";
import { formatGroupValue, formatPeriod, formatPeriodLong } from "@/components/analytics/format";

export const IN_COLOR = "#10b981";
export const OUT_COLOR = "#f97316";

type ChartRow = { period: string; label: string; in: number; out: number };

interface FlowTrendChartProps {
  group: FlowTrendGroup;
  granularity: FlowGranularity;
  selectedPeriod: string | null;
  onSelectPeriod: (period: string) => void;
}

/** Total incoming vs outgoing per period; clicking a period selects it for the product breakdown */
export default function FlowTrendChart({ group, granularity, selectedPeriod, onSelectPeriod }: FlowTrendChartProps) {
  const data: ChartRow[] = group.points.map((p) => ({
    period: p.period,
    label: formatPeriod(p.period, granularity),
    in: p.in,
    out: p.out,
  }));
  const selectedLabel = data.find((d) => d.period === selectedPeriod)?.label;
  const showDots = data.length <= 31;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden="true"><line x1="0" y1="2" x2="16" y2="2" stroke={IN_COLOR} strokeWidth="2" /></svg>
          Masuk
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden="true"><line x1="0" y1="2" x2="16" y2="2" stroke={OUT_COLOR} strokeWidth="2" strokeDasharray="5 4" /></svg>
          Keluar
        </span>
        <span className="ml-auto text-[11px] text-slate-400">Klik titik untuk melihat produknya</span>
      </div>
      <div className="h-60 w-full cursor-pointer">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
            onClick={(state) => {
              const index = Number(state?.activeIndex);
              if (Number.isInteger(index) && data[index]) onSelectPeriod(data[index].period);
            }}
          >
            <CartesianGrid vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={{ stroke: "#94a3b8", strokeOpacity: 0.4 }}
              minTickGap={12}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              width={68}
              tickFormatter={(v: number) => v.toLocaleString("id-ID")}
            />
            {selectedLabel && <ReferenceLine x={selectedLabel} stroke="#3b82f6" strokeWidth={2} strokeOpacity={0.35} />}
            <Tooltip
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as ChartRow | undefined;
                if (!active || !row) return null;
                return (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-1 font-bold text-slate-700 dark:text-slate-200">{formatPeriodLong(row.period, granularity)}</div>
                    <div className="tabular-nums" style={{ color: IN_COLOR }}>Masuk: {formatGroupValue(row.in, group)}</div>
                    <div className="tabular-nums" style={{ color: OUT_COLOR }}>Keluar: {formatGroupValue(row.out, group)}</div>
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey="in" stroke={IN_COLOR} strokeWidth={2} dot={showDots ? { r: 3 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="out" stroke={OUT_COLOR} strokeWidth={2} strokeDasharray="5 4" dot={showDots ? { r: 3 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

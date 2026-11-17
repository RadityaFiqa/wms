"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { ChevronRight, GripVertical } from "lucide-react";
import type { AnalyticsUnitGroup, InboundProduct, InboundSender } from "@bulog-wms/schema";
import { formatDateId, formatGroupValue, formatQty, ORIGIN_BADGES } from "@/components/analytics/format";

/** What a drag carries: a whole sender (lotName null) or one of its lots */
export interface FolderDragData {
  productUuid: string;
  senderName: string;
  lotName: string | null;
  /** Folder the item is dragged from, null when not in a folder */
  fromFolderUuid: string | null;
  label: string;
}

// Named groups so a chevron only turns when its own level is open
const CHEVRON_ROTATE = {
  product: "group-open/product:rotate-90",
  folder: "group-open/folder:rotate-90",
  sender: "group-open/sender:rotate-90",
  stack: "group-open/stack:rotate-90",
} as const;

export const Chevron = ({ level }: { level: keyof typeof CHEVRON_ROTATE }) => (
  <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${CHEVRON_ROTATE[level]}`} />
);

export const summaryClass = "flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden";

export const isScaledUnit = (unit: AnalyticsUnitGroup) => unit.key === "Kg" || unit.key === "L";

function Qty({ value, unit, strong = true }: { value: number; unit: AnalyticsUnitGroup; strong?: boolean }) {
  return (
    <span
      className={`ml-auto shrink-0 pl-3 text-right tabular-nums ${
        strong ? "font-bold text-slate-800 dark:text-slate-100" : "font-semibold text-slate-600 dark:text-slate-300"
      }`}
    >
      {formatGroupValue(value, unit)}
    </span>
  );
}

/** Grip that starts a drag; sits inside a <summary>, so its clicks must not toggle the row */
function DragHandle({ id, data }: { id: string; data: FolderDragData }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className={`-ml-1 shrink-0 cursor-grab touch-none rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 ${
        isDragging ? "opacity-40" : ""
      }`}
      aria-label={`Seret ${data.label} ke folder`}
      title="Seret ke folder"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

interface InboundSenderListProps {
  product: InboundProduct;
  senders: InboundSender[];
  folderUuid: string | null;
  canDrag: boolean;
  forceOpen: boolean;
}

/** Sender → stack → lot rows of one folder (or of the senders not in any folder) */
export default function InboundSenderList({ product: p, senders, folderUuid, canDrag, forceOpen }: InboundSenderListProps) {
  const groupKey = folderUuid ?? "none";
  const isScaled = isScaledUnit(p.unit);

  return (
    <div className="divide-y divide-slate-100 border-l border-slate-100 dark:divide-slate-800 dark:border-slate-800">
      {senders.map((s) => (
        <details key={s.name} className="group/sender" open={forceOpen || undefined}>
          <summary className={`${summaryClass} py-2.5 pl-3 text-sm`}>
            {canDrag && (
              <DragHandle
                id={`sender::${p.productUuid}::${groupKey}::${s.name}`}
                data={{ productUuid: p.productUuid, senderName: s.name, lotName: null, fromFolderUuid: folderUuid, label: s.name }}
              />
            )}
            <Chevron level="sender" />
            <span className="min-w-0 truncate font-semibold text-slate-700 dark:text-slate-200">{s.name}</span>
            <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${ORIGIN_BADGES[s.originCategory]}`}>
              {s.originCategory}
            </span>
            <span className="hidden shrink-0 text-[11px] text-slate-400 sm:inline">{s.stacks.length} tumpukan</span>
            {s.pendingGateCount > 0 && (
              <span
                className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
                title={`${s.pendingGateCount} gate belum diadministrasikan`}
              >
                {formatGroupValue(s.pendingDisplayQty, p.unit)} belum adm. · {s.pendingGateCount} gate
              </span>
            )}
            <Qty value={s.displayQty} unit={p.unit} />
          </summary>

          <div className="mb-2 ml-8 divide-y divide-slate-100 border-l border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {s.stacks.map((st) => (
              <details key={st.locationUuid} className="group/stack" open={forceOpen || undefined}>
                <summary className={`${summaryClass} py-2 pl-3 text-xs`}>
                  <Chevron level="stack" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{st.locationName}</span>
                  <span className="text-[11px] text-slate-400">{st.lots.length} lot</span>
                  <Qty value={st.displayQty} unit={p.unit} strong={false} />
                </summary>

                <div className="mb-2 ml-8 overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-[11px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                        {canDrag && <th className="w-6 py-1" aria-label="Seret" />}
                        <th className="py-1 pr-2">Lot</th>
                        <th className="py-1 px-2">Dokumen masuk</th>
                        <th className="py-1 pl-2 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {st.lots.map((lot, i) => (
                        <tr key={`${lot.lotName}-${i}`} className="align-top">
                          {canDrag && (
                            <td className="py-1">
                              {lot.lotName && !lot.pendingGate && (
                                <DragHandle
                                  id={`lot::${p.productUuid}::${groupKey}::${s.name}::${st.locationUuid}::${lot.lotName}::${i}`}
                                  data={{
                                    productUuid: p.productUuid,
                                    senderName: s.name,
                                    lotName: lot.lotName,
                                    fromFolderUuid: folderUuid,
                                    label: lot.lotName,
                                  }}
                                />
                              )}
                            </td>
                          )}
                          <td className="py-1.5 pr-2 font-mono text-slate-700 dark:text-slate-300">
                            {lot.pendingGate ? (
                              <>
                                {lot.lotName && <div>{lot.lotName}</div>}
                                <span className="inline-block rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-sans text-[10px] font-bold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                                  {lot.pendingGate.cardType === "OUT" ? "Keluar belum diadministrasikan" : "Belum diadministrasikan"}
                                </span>
                              </>
                            ) : (
                              lot.lotName || "Tanpa lot"
                            )}
                          </td>
                          <td className="py-1.5 px-2">
                            {lot.pendingGate ? (
                              <div>
                                <Link
                                  href={`/gate-operations/${lot.pendingGate.gateOperationUuid}`}
                                  className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                                >
                                  {lot.pendingGate.opNumber}
                                </Link>
                                <span className="ml-1.5 text-slate-400">{formatDateId(lot.pendingGate.date)}</span>
                              </div>
                            ) : lot.documents.length === 0 ? (
                              <span className="text-slate-400">Lot tidak ditemukan di dokumen masuk</span>
                            ) : (
                              lot.documents.map((d) => (
                                <div key={d.documentUuid}>
                                  <Link
                                    href={`/erp-documents/${d.documentUuid}`}
                                    className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                                  >
                                    {d.documentNumber}
                                  </Link>
                                  <span className="ml-1.5 text-slate-400">{formatDateId(d.dateDone)}</span>
                                </div>
                              ))
                            )}
                          </td>
                          <td className="py-1.5 pl-2 text-right tabular-nums">
                            <div className="font-bold text-slate-700 dark:text-slate-200">
                              {formatQty(lot.qty)} {p.uom}
                            </div>
                            {isScaled && <div className="text-slate-400">{formatGroupValue(lot.displayQty, p.unit)}</div>}
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
      ))}
    </div>
  );
}

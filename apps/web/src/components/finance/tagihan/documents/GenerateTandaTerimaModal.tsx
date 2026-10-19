"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ReceiptText, Loader2, Play, AlertCircle, Crown, RotateCcw, Search } from "lucide-react";
import {
  allocateWorkerPayments,
  allocationDifference,
  formatRupiah,
  TAGIHAN_EDITABLE_KEYS,
} from "@bulog-wms/schema";
import {
  useTagihanDocumentPrefill,
  useTagihanDocumentTemplates,
  generateTandaTerima,
} from "@/hooks/useTagihanDocuments";
import { useAuthStore } from "@/store/auth";
import {
  TagihanDocumentModalShell,
  ValuePreviewList,
  modalButton,
} from "@/components/finance/tagihan/documents/TagihanDocumentModalShell";

interface GenerateTandaTerimaModalProps {
  tagihanUuid: string;
  tagihanType: string;
  /** A Tanda Terima for this Tagihan is still being generated */
  isProcessing: boolean;
  onClose: () => void;
}

const STEPS = ["Pilih Buruh", "Alokasi Pembayaran", "Preview"];

const FIELD_LABELS: Record<string, string> = {
  judul: "Judul",
  nama_gudang: "Nama Gudang",
  kanwil: "Kanwil",
  tanggal: "Tanggal",
  kota: "Kota (tanda tangan)",
  tanggal_ttd: "Tanggal Tanda Tangan",
  kepala_gudang: "Nama Kepala Gudang",
};

const inputClass =
  "w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 focus:outline-none focus:border-emerald-500";

export function GenerateTandaTerimaModal({
  tagihanUuid,
  tagihanType,
  isProcessing,
  onClose,
}: GenerateTandaTerimaModalProps) {
  const { hasPermission } = useAuthStore();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [remainderUuid, setRemainderUuid] = useState<string>("");
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [manuallyAdjusted, setManuallyAdjusted] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { templates, isLoading: templatesLoading } = useTagihanDocumentTemplates(tagihanUuid, "TANDA_TERIMA");
  // One active Tanda Terima per warehouse & type; the most specific one wins
  const template = templates[0] ?? null;
  const { prefill, isLoading: prefillLoading } = useTagihanDocumentPrefill(tagihanUuid, "TANDA_TERIMA");

  const workers = prefill?.workers ?? [];
  const totalPayment = prefill?.totalPayment ?? 0;
  const mandor = workers.find((w) => w.isMandor) ?? null;

  useEffect(() => {
    if (!prefill) return;
    const editable: Record<string, string> = {};
    for (const key of TAGIHAN_EDITABLE_KEYS.TANDA_TERIMA) editable[key] = String(prefill.values[key] ?? "");
    setValues(editable);
  }, [prefill]);

  // Keep list order (mandor first, then name) for the receipt rows
  const selectedWorkers = useMemo(() => workers.filter((w) => selected.includes(w.uuid)), [workers, selected]);

  // Remainder recipient must be selected; default to the mandor, else the first worker
  useEffect(() => {
    if (selectedWorkers.length === 0) {
      setRemainderUuid("");
      return;
    }
    if (!selectedWorkers.some((w) => w.uuid === remainderUuid)) {
      const preferred = selectedWorkers.find((w) => w.uuid === prefill?.defaultRemainderBuruhUuid);
      setRemainderUuid((preferred ?? selectedWorkers[0]).uuid);
    }
  }, [selectedWorkers, remainderUuid, prefill]);

  const autoAllocate = () => {
    if (selectedWorkers.length === 0) {
      setAmounts({});
      return;
    }
    // The remainder effect may not have caught up with a new selection yet
    const recipient = selectedWorkers.some((w) => w.uuid === remainderUuid) ? remainderUuid : undefined;
    const allocation = allocateWorkerPayments(
      totalPayment,
      selectedWorkers.map((w) => w.uuid),
      recipient,
    );
    setAmounts(Object.fromEntries(allocation.map((a) => [a.id, a.amount])));
    setManuallyAdjusted(false);
  };

  // Re-split automatically until the user adjusts amounts by hand
  useEffect(() => {
    if (!manuallyAdjusted) autoAllocate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkers, remainderUuid, totalPayment]);

  const recipients = selectedWorkers.map((w) => ({ buruhUuid: w.uuid, amount: amounts[w.uuid] ?? 0 }));
  const difference = allocationDifference(totalPayment, recipients);
  const allocationValid = selectedWorkers.length > 0 && difference === 0 && recipients.every((r) => r.amount >= 0);

  const filteredWorkers = workers.filter((w) => w.name.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleGenerate = async () => {
    if (!template) return;
    setSubmitting(true);
    const toastId = toast.loading("Mengantrekan generate Tanda Terima...");
    try {
      await generateTandaTerima(tagihanUuid, {
        templateUuid: template.uuid,
        recipients,
        remainderBuruhUuid: remainderUuid,
        values,
      });
      toast.success("Tanda Terima sedang dibuat. Pantau progresnya di Dokumen Tagihan.", { id: toastId });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memulai generate tanda terima.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const loading = templatesLoading || prefillLoading || !prefill;
  const blocked = !loading && (!template || workers.length === 0 || totalPayment <= 0);

  const footer = (
    <>
      <button type="button" onClick={step === 0 ? onClose : () => setStep(step - 1)} className={modalButton.secondary}>
        {step === 0 ? "Batal" : "Kembali"}
      </button>
      {step === 0 && (
        <button type="button" disabled={blocked || selected.length === 0} onClick={() => setStep(1)} className={modalButton.primary}>
          Lanjut ({selected.length} buruh)
        </button>
      )}
      {step === 1 && (
        <button type="button" disabled={!allocationValid} onClick={() => setStep(2)} className={modalButton.primary}>
          Lihat Preview
        </button>
      )}
      {step === 2 && (
        <button
          type="button"
          disabled={submitting || isProcessing || !allocationValid}
          onClick={handleGenerate}
          title={isProcessing ? "Masih ada Tanda Terima yang sedang diproses" : undefined}
          className={modalButton.primary}
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Generate DOCX &amp; PDF
        </button>
      )}
    </>
  );

  return (
    <TagihanDocumentModalShell
      title="Generate Tanda Terima — Upah Buruh"
      subtitle={`Tagihan ${tagihanType} · total ${formatRupiah(totalPayment)}`}
      icon={<ReceiptText className="h-4 w-4" />}
      steps={STEPS}
      currentStep={step}
      onClose={onClose}
      footer={footer}
      wide
    >
      {isProcessing && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Tanda Terima untuk tagihan ini sedang diproses. Generate baru bisa dimulai setelah selesai.
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Memuat data buruh dan template...
        </div>
      ) : blocked ? (
        <div className="p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-2">
          <p className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            {!template
              ? `Belum ada template Tanda Terima aktif untuk tipe ${tagihanType}.`
              : workers.length === 0
                ? "Belum ada buruh aktif di gudang ini."
                : "Total tagihan masih Rp 0, tanda terima belum dapat dibuat."}
          </p>
          {!template && hasPermission("update", "DocumentTemplate") && (
            <Link href="/document-templates" className="inline-block font-bold text-emerald-700 dark:text-emerald-400 hover:underline">
              Buka Generator Template →
            </Link>
          )}
          {template && workers.length === 0 && (
            <Link href="/finance/buruh" className="inline-block font-bold text-emerald-700 dark:text-emerald-400 hover:underline">
              Kelola data buruh →
            </Link>
          )}
        </div>
      ) : (
        <>
          {step === 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <div className="relative sm:w-72">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama buruh..."
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button type="button" onClick={() => setSelected(workers.map((w) => w.uuid))} className={modalButton.secondary}>
                    Pilih Semua
                  </button>
                  <button type="button" onClick={() => setSelected([])} className={modalButton.secondary}>
                    Hapus Pilihan
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[46vh] overflow-y-auto pr-1">
                {filteredWorkers.map((w) => {
                  const checked = selected.includes(w.uuid);
                  return (
                    <label
                      key={w.uuid}
                      className={`flex items-center gap-2.5 px-3 py-2 border rounded-xl text-xs cursor-pointer transition ${
                        checked
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                          : "border-slate-200 dark:border-slate-800 hover:border-emerald-300"
                      }`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggle(w.uuid)} className="h-4 w-4" />
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{w.name}</span>
                      {w.isMandor && (
                        <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400">
                          <Crown className="h-3 w-3 mr-0.5" /> Mandor
                        </span>
                      )}
                    </label>
                  );
                })}
                {filteredWorkers.length === 0 && (
                  <p className="text-xs text-slate-400 col-span-full py-4 text-center">Tidak ada buruh yang cocok.</p>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {selected.length} dari {workers.length} buruh dipilih · total dibagi: {formatRupiah(totalPayment)}
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3 space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Penerima sisa pembulatan</label>
                    <select
                      value={remainderUuid}
                      onChange={(e) => setRemainderUuid(e.target.value)}
                      className={`${inputClass} w-64`}
                    >
                      {selectedWorkers.map((w) => (
                        <option key={w.uuid} value={w.uuid}>
                          {w.name}
                          {w.isMandor ? " (Mandor)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={autoAllocate} className={`${modalButton.secondary} inline-flex items-center gap-1.5`}>
                    <RotateCcw className="h-3.5 w-3.5" /> Bagi rata otomatis
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left w-10">No</th>
                        <th className="px-3 py-2 text-left">Nama Buruh</th>
                        <th className="px-3 py-2 text-right w-44">Jumlah Diterima (Rp)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedWorkers.map((w, i) => (
                        <tr key={w.uuid}>
                          <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                          <td className="px-3 py-1.5 font-semibold text-slate-800 dark:text-slate-100">
                            {w.name}
                            {w.uuid === remainderUuid && <span className="ml-1.5 text-[10px] text-emerald-600">+ sisa</span>}
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min={0}
                              step={100}
                              value={amounts[w.uuid] ?? 0}
                              onChange={(e) => {
                                const next = Math.max(0, Math.round(Number(e.target.value) || 0));
                                setAmounts((prev) => ({ ...prev, [w.uuid]: next }));
                                setManuallyAdjusted(true);
                              }}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 rounded-lg text-right bg-white dark:bg-slate-900"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/40 font-bold">
                      <tr>
                        <td className="px-3 py-2" colSpan={2}>
                          Total dialokasikan
                        </td>
                        <td className="px-3 py-2 text-right">{formatRupiah(totalPayment + difference)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div
                  className={`p-3 rounded-xl text-xs font-semibold border ${
                    difference === 0
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400"
                      : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400"
                  }`}
                >
                  {difference === 0
                    ? `Sesuai total tagihan ${formatRupiah(totalPayment)}.`
                    : `Selisih ${difference > 0 ? "+" : "-"}${formatRupiah(Math.abs(difference))} dari total tagihan ${formatRupiah(totalPayment)}. Sesuaikan nominal hingga selisih 0.`}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data Dokumen</div>
                {TAGIHAN_EDITABLE_KEYS.TANDA_TERIMA.map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {FIELD_LABELS[key] ?? key}
                    </label>
                    <input
                      type="text"
                      value={values[key] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                ))}
                <ValuePreviewList
                  rows={[
                    { label: "Tonase (Kg)", value: prefill?.values.tonase },
                    { label: "Upah per Kg", value: `Rp ${prefill?.values.upah_per_kg ?? "-"}` },
                    { label: "Total Upah", value: formatRupiah(totalPayment) },
                    { label: "Mandor", value: mandor?.name ?? "-" },
                  ]}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Periksa data berikut. Dokumen dibuat dengan template <strong>{template?.name}</strong> dan disimpan ke
                Supporting Files.
              </p>
              <ValuePreviewList
                rows={[
                  ...TAGIHAN_EDITABLE_KEYS.TANDA_TERIMA.map((key) => ({ label: FIELD_LABELS[key] ?? key, value: values[key] })),
                  { label: "Tonase (Kg)", value: prefill?.values.tonase },
                  { label: "Upah per Kg", value: `Rp ${prefill?.values.upah_per_kg ?? "-"}` },
                  { label: "Mandor (Yang Membayar)", value: mandor?.name ?? "-" },
                ]}
              />
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left w-10">No</th>
                      <th className="px-3 py-2 text-left">Nama Buruh</th>
                      <th className="px-3 py-2 text-right">Penyaluran</th>
                      <th className="px-3 py-2 text-right">Jumlah Diterima</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedWorkers.map((w, i) => (
                      <tr key={w.uuid}>
                        <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-1.5 font-semibold">{w.name}</td>
                        <td className="px-3 py-1.5 text-right">{formatRupiah(amounts[w.uuid] ?? 0)}</td>
                        <td className="px-3 py-1.5 text-right">{formatRupiah(amounts[w.uuid] ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/40 font-bold">
                    <tr>
                      <td className="px-3 py-2" colSpan={2}>
                        Total
                      </td>
                      <td className="px-3 py-2 text-right">{formatRupiah(totalPayment + difference)}</td>
                      <td className="px-3 py-2 text-right">{formatRupiah(totalPayment + difference)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </TagihanDocumentModalShell>
  );
}

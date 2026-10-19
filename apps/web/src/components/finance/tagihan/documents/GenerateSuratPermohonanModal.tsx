"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileSignature, Loader2, Play, AlertCircle } from "lucide-react";
import { TAGIHAN_EDITABLE_KEYS, TAGIHAN_TEMPLATE_TAGS, canonicalTagihanKey } from "@bulog-wms/schema";
import PlaceholderFieldsForm, {
  initialPlaceholderValues,
  type PlaceholderField,
} from "@/components/PlaceholderFieldsForm";
import {
  useTagihanDocumentPrefill,
  useTagihanDocumentTemplates,
  generateSuratPermohonan,
} from "@/hooks/useTagihanDocuments";
import { useAuthStore } from "@/store/auth";
import {
  TagihanDocumentModalShell,
  ValuePreviewList,
  modalButton,
} from "@/components/finance/tagihan/documents/TagihanDocumentModalShell";

interface GenerateSuratPermohonanModalProps {
  tagihanUuid: string;
  tagihanType: string;
  /** A Surat Permohonan for this Tagihan is still being generated */
  isProcessing: boolean;
  onClose: () => void;
}

const STEPS = ["Pilih Template", "Isi Data", "Preview"];
const EDITABLE = TAGIHAN_EDITABLE_KEYS.SURAT_PERMOHONAN;
const STANDARD = TAGIHAN_TEMPLATE_TAGS.SURAT_PERMOHONAN.standard;
/** Standard key for a template tag, case-insensitive with aliases (e.g. SDIP -> nomor_sdi) */
const canonical = (key: string) => canonicalTagihanKey("SURAT_PERMOHONAN", key);

// Added when the template has no nomor_surat tag: it only numbers the archived
// document, so the label must not clash with template fields labelled "Nomor Surat"
const NOMOR_SURAT_FIELD: PlaceholderField = {
  key: "nomor_surat",
  label: "No. Arsip Dokumen (tidak tercetak)",
  type: "TEXT",
  required: true,
};

export function GenerateSuratPermohonanModal({
  tagihanUuid,
  tagihanType,
  isProcessing,
  onClose,
}: GenerateSuratPermohonanModalProps) {
  const { hasPermission } = useAuthStore();
  const [step, setStep] = useState(0);
  const [templateUuid, setTemplateUuid] = useState("");
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  const { templates, isLoading: templatesLoading } = useTagihanDocumentTemplates(
    tagihanUuid,
    "SURAT_PERMOHONAN",
  );
  const template = templates.find((t) => t.uuid === templateUuid) ?? null;
  const { prefill, isLoading: prefillLoading } = useTagihanDocumentPrefill(
    tagihanUuid,
    "SURAT_PERMOHONAN",
    { templateUuid: templateUuid || undefined, enabled: !!templateUuid },
  );

  // Pre-select when only one template fits this Tagihan type
  useEffect(() => {
    if (!templateUuid && templates.length === 1) setTemplateUuid(templates[0].uuid);
  }, [templates, templateUuid]);

  // Top-level fields of the template; loop children are filled per row.
  // Field keys stay as the template spells them (e.g. "TANGGAL").
  const fields = useMemo<PlaceholderField[]>(() => {
    if (!template) return [];
    const topLevel = template.placeholderSchema.filter(
      (p) => !p.key.includes(".") && !(p.type === "TABLE" && canonical(p.key) === "rincian"),
    );
    // Nomor surat is always needed as the document number
    return topLevel.some((p) => canonical(p.key) === "nomor_surat") ? topLevel : [NOMOR_SURAT_FIELD, ...topLevel];
  }, [template]);

  const lockedKeys = useMemo(
    () =>
      fields
        .filter((f) => {
          const c = canonical(f.key);
          return c !== null && STANDARD.includes(c) && !EDITABLE.includes(c);
        })
        .map((f) => f.key),
    [fields],
  );

  useEffect(() => {
    if (!prefill || !template) return;
    const initial = initialPlaceholderValues(fields);
    for (const f of fields) {
      const c = canonical(f.key);
      if (c && prefill.values[c] !== undefined) initial[f.key] = prefill.values[c];
    }
    setValues(initial);
  }, [prefill, template, fields]);

  const rincian: any[] = Array.isArray(prefill?.values.rincian) ? prefill!.values.rincian : [];
  const hasRincian = template?.placeholderSchema.some((p) => canonical(p.key) === "rincian") ?? false;

  const validate = () => {
    for (const f of fields) {
      if (lockedKeys.includes(f.key) || !f.required) continue;
      const v = values[f.key];
      if (v === undefined || v === null || String(v).trim() === "") {
        toast.error(`Field "${f.label}" wajib diisi.`);
        return false;
      }
    }
    return true;
  };

  const handleGenerate = async () => {
    setSubmitting(true);
    const toastId = toast.loading("Mengantrekan generate Surat Permohonan...");
    try {
      // Only editable + template-specific keys are sent; the server recomputes the rest
      const payload: Record<string, any> = {};
      for (const f of fields) {
        if (!lockedKeys.includes(f.key)) payload[f.key] = values[f.key];
      }
      await generateSuratPermohonan(tagihanUuid, { templateUuid, values: payload });
      toast.success("Surat Permohonan sedang dibuat. Pantau progresnya di Dokumen Tagihan.", { id: toastId });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memulai generate dokumen.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <>
      <button type="button" onClick={step === 0 ? onClose : () => setStep(step - 1)} className={modalButton.secondary}>
        {step === 0 ? "Batal" : "Kembali"}
      </button>
      {step === 0 && (
        <button type="button" disabled={!templateUuid} onClick={() => setStep(1)} className={modalButton.primary}>
          Lanjut
        </button>
      )}
      {step === 1 && (
        <button
          type="button"
          disabled={prefillLoading}
          onClick={() => validate() && setStep(2)}
          className={modalButton.primary}
        >
          Lihat Preview
        </button>
      )}
      {step === 2 && (
        <button
          type="button"
          disabled={submitting || isProcessing}
          onClick={handleGenerate}
          title={isProcessing ? "Masih ada Surat Permohonan yang sedang diproses" : undefined}
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
      title="Generate Dokumen — Surat Permohonan Biaya"
      subtitle={`Tagihan ${tagihanType} · nilai terisi otomatis dari data tagihan`}
      icon={<FileSignature className="h-4 w-4" />}
      steps={STEPS}
      currentStep={step}
      onClose={onClose}
      footer={footer}
    >
      {isProcessing && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Surat Permohonan untuk tagihan ini sedang diproses. Generate baru bisa dimulai setelah selesai.
        </div>
      )}

      {step === 0 && (
        <div className="space-y-3">
          {templatesLoading ? (
            <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Memuat template...
            </div>
          ) : templates.length === 0 ? (
            <div className="p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Belum ada template Surat Permohonan aktif untuk tipe {tagihanType}.
              </p>
              <p>
                Atur <strong>Penggunaan Tagihan = Surat Permohonan Biaya</strong> pada template di menu Generator
                Template.
              </p>
              {hasPermission("update", "DocumentTemplate") && (
                <Link href="/document-templates" className="inline-block font-bold text-emerald-700 dark:text-emerald-400 hover:underline">
                  Buka Generator Template →
                </Link>
              )}
            </div>
          ) : (
            templates.map((t) => (
              <label
                key={t.uuid}
                className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition ${
                  templateUuid === t.uuid
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-emerald-300"
                }`}
              >
                <input
                  type="radio"
                  name="surat-template"
                  checked={templateUuid === t.uuid}
                  onChange={() => setTemplateUuid(t.uuid)}
                  className="mt-0.5"
                />
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-slate-800 dark:text-slate-100">
                    {t.name} <span className="font-mono text-slate-400">v{t.version}</span>
                  </div>
                  <div className="text-slate-500 font-mono">{t.code}</div>
                  <div className="text-slate-500">
                    {t.tagihanType ? `Khusus ${t.tagihanType}` : "Semua tipe tagihan"}
                    {t.isWarehouseSpecific ? " · gudang ini" : " · global"}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>
      )}

      {step === 1 &&
        (prefillLoading || !prefill ? (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Mengisi data otomatis dari tagihan...
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Kolom abu-abu dihitung dari data tagihan dan tidak dapat diubah. Kolom lain boleh disesuaikan.
            </p>
            <PlaceholderFieldsForm
              placeholders={fields}
              values={values}
              onChange={setValues}
              disabledKeys={lockedKeys}
            />
            {hasRincian && <RincianTable rows={rincian} />}
          </div>
        ))}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Periksa data berikut. Dokumen dibuat dengan format template <strong>{template?.name}</strong> dan disimpan ke
            Supporting Files.
          </p>
          <ValuePreviewList
            rows={fields
              .filter((f) => f.type !== "TABLE")
              .map((f) => ({ label: f.label, value: formatPreviewValue(values[f.key]) }))}
          />
          {hasRincian && <RincianTable rows={rincian} />}
        </div>
      )}
    </TagihanDocumentModalShell>
  );
}

function formatPreviewValue(v: any) {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  return v === undefined || v === null ? "" : String(v);
}

function RincianTable({ rows }: { rows: any[] }) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
      <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/40">
        Rincian (dari ringkasan tagihan)
      </div>
      <table className="w-full text-xs">
        <thead className="text-slate-500">
          <tr className="border-b border-slate-100 dark:border-slate-800">
            <th className="px-4 py-2 text-left">Komoditas</th>
            <th className="px-4 py-2 text-right">Kuantum</th>
            <th className="px-4 py-2 text-left">Satuan</th>
            <th className="px-4 py-2 text-right">Biaya</th>
            <th className="px-4 py-2 text-right">Jumlah</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-4 py-2">{r.komoditas}</td>
              <td className="px-4 py-2 text-right">{r.kuantum}</td>
              <td className="px-4 py-2">{r.satuan}</td>
              <td className="px-4 py-2 text-right">Rp {r.biaya}</td>
              <td className="px-4 py-2 text-right">Rp {r.jumlah}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

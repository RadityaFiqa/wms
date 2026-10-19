import { z } from "zod";
import type { TagihanType } from "./index";

// Tagihan Document Generation (Surat Permohonan / Tanda Terima)

export const TagihanDocumentPurposeEnum = z.enum(["SURAT_PERMOHONAN", "TANDA_TERIMA"]);
export type TagihanDocumentPurpose = z.infer<typeof TagihanDocumentPurposeEnum>;

export const TAGIHAN_PURPOSE_LABELS: Record<TagihanDocumentPurpose, string> = {
  SURAT_PERMOHONAN: "Surat Permohonan Biaya",
  TANDA_TERIMA: "Tanda Terima Upah Buruh",
};

// Local copy avoids a runtime circular import with index.ts; the check below
// fails compilation if it drifts from TagihanTypeEnum.
const TAGIHAN_TYPES = ["LOADING", "UNLOADING", "REBAGGING", "REPROSES", "OVERSTAPEL"] as const;
type MissingTagihanTypes = Exclude<TagihanType, (typeof TAGIHAN_TYPES)[number]>;
const _tagihanTypesInSync: [MissingTagihanTypes] extends [never]
  ? (typeof TAGIHAN_TYPES)[number] extends TagihanType
    ? true
    : false
  : false = true;
void _tagihanTypesInSync;

// Multipart forms send "" for an unselected option; treat it as "not set"
const emptyToNull = (v: unknown) => (v === "" ? null : v);

/**
 * Tagihan usage fields for DocumentTemplate create/update.
 * tagihanType null means the template applies to every Tagihan type.
 */
export const TagihanTemplateUsageSchema = z.object({
  tagihanPurpose: z.preprocess(emptyToNull, TagihanDocumentPurposeEnum.nullable()).optional(),
  tagihanType: z.preprocess(emptyToNull, z.enum(TAGIHAN_TYPES).nullable()).optional(),
});
export type TagihanTemplateUsageInput = z.infer<typeof TagihanTemplateUsageSchema>;

// ---------------------------------------------------------------------------
// Formatting helpers (shared so the modal preview matches the generated file)
// ---------------------------------------------------------------------------

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** Whole rupiah; Tagihan amounts are stored as Float. */
export function toRupiahInteger(value: number): number {
  return Math.round(Number(value) || 0);
}

/** 2268000 -> "2.268.000" */
export function formatNumberId(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits }).format(Number(value) || 0);
}

/** 2268000 -> "Rp 2.268.000" */
export function formatRupiah(value: number): string {
  return `Rp ${formatNumberId(toRupiahInteger(value))}`;
}

const SATUAN = [
  "",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
  "sepuluh",
  "sebelas",
];

function terbilangBelowThousand(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  if (n < 100) {
    const rest = n % 10;
    return `${SATUAN[Math.floor(n / 10)]} puluh${rest ? ` ${SATUAN[rest]}` : ""}`;
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundreds === 1 ? "seratus" : `${SATUAN[hundreds]} ratus`;
  return rest ? `${head} ${terbilangBelowThousand(rest)}` : head;
}

const SKALA: Array<[number, string]> = [
  [1_000_000_000_000, "triliun"],
  [1_000_000_000, "miliar"],
  [1_000_000, "juta"],
  [1_000, "ribu"],
];

/**
 * Indonesian number words for the integer part, e.g. 2268000 ->
 * "dua juta dua ratus enam puluh delapan ribu".
 */
export function terbilang(value: number): string {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return "nol";

  const parts: string[] = [];
  for (const [size, name] of SKALA) {
    if (n >= size) {
      const count = Math.floor(n / size);
      n %= size;
      // "seribu", not "satu ribu"; larger scales keep "satu juta"
      parts.push(size === 1_000 && count === 1 ? "seribu" : `${terbilang(count)} ${name}`);
    }
  }
  if (n > 0) parts.push(terbilangBelowThousand(n));

  const words = parts.join(" ");
  return value < 0 ? `minus ${words}` : words;
}

/** "Dua Juta Dua Ratus Enam Puluh Delapan Ribu Rupiah" */
export function terbilangRupiah(value: number): string {
  const words = `${terbilang(toRupiahInteger(value))} rupiah`;
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}

// The schema package compiles against the ES5 lib, so stick to ES5-typed APIs
const toDate = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

function datePartsIn(date: Date, timeZone?: string) {
  // en-US numeric renders as "M/D/YYYY"
  const [month, day, year] = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
    .format(date)
    .split("/")
    .map(Number);
  return { day, month, year };
}

/** "12 Oktober 2026" in the given IANA time zone (defaults to runtime zone). */
export function formatTanggalId(date: Date | string, timeZone?: string): string {
  const { day, month, year } = datePartsIn(toDate(date), timeZone);
  return `${day} ${BULAN[month - 1]} ${year}`;
}

/** "Oktober 2026" */
export function formatBulanTahunId(date: Date | string, timeZone?: string): string {
  const { month, year } = datePartsIn(toDate(date), timeZone);
  return `${BULAN[month - 1]} ${year}`;
}

/**
 * Periode label from a date range:
 * same month -> "Oktober 2026"; same year -> "Agustus - Oktober 2026";
 * otherwise "Desember 2025 - Januari 2026".
 */
export function formatPeriodeId(
  start: Date | string,
  end: Date | string,
  timeZone?: string,
): string {
  const a = datePartsIn(toDate(start), timeZone);
  const b = datePartsIn(toDate(end), timeZone);
  if (a.year === b.year && a.month === b.month) return `${BULAN[a.month - 1]} ${a.year}`;
  if (a.year === b.year) return `${BULAN[a.month - 1]} - ${BULAN[b.month - 1]} ${b.year}`;
  return `${BULAN[a.month - 1]} ${a.year} - ${BULAN[b.month - 1]} ${b.year}`;
}

/**
 * Suggest the next surat number by incrementing the first number group
 * (the running sequence in formats like "045/BLG/KC.BJM/X/2026"), keeping
 * zero padding. Returns "" when there is nothing to increment.
 */
export function suggestNextNomorSurat(last?: string | null): string {
  if (!last) return "";
  const match = last.match(/\d+/);
  if (!match || match.index === undefined) return "";
  let next = String(Number(match[0]) + 1);
  while (next.length < match[0].length) next = `0${next}`;
  return last.slice(0, match.index) + next + last.slice(match.index + match[0].length);
}

// ---------------------------------------------------------------------------
// Tanda Terima payment allocation
// ---------------------------------------------------------------------------

function hasDuplicates(values: string[]): boolean {
  return values.some((v, i) => values.indexOf(v) !== i);
}

export interface WorkerAllocation {
  id: string;
  amount: number;
}

/**
 * Split the total evenly, rounding each share down to the nearest Rp100;
 * the remainder recipient (default: first worker) takes the leftover so the
 * sum always equals the total.
 */
export function allocateWorkerPayments(
  totalPayment: number,
  workerIds: string[],
  remainderId?: string | null,
): WorkerAllocation[] {
  if (workerIds.length === 0) return [];
  if (hasDuplicates(workerIds)) {
    throw new Error("Daftar buruh mengandung duplikat.");
  }

  const total = toRupiahInteger(totalPayment);
  if (total < 0) throw new Error("Total pembayaran tidak boleh negatif.");

  const recipient = remainderId ?? workerIds[0];
  if (workerIds.indexOf(recipient) === -1) {
    throw new Error("Penerima sisa pembayaran harus termasuk buruh yang dipilih.");
  }

  const basePayment = Math.floor(total / workerIds.length / 100) * 100;
  const remainder = total - basePayment * workerIds.length;

  return workerIds.map((id) => ({
    id,
    amount: id === recipient ? basePayment + remainder : basePayment,
  }));
}

/** Difference between the allocated sum and the expected total (0 = valid). */
export function allocationDifference(
  totalPayment: number,
  allocations: Array<{ amount: number }>,
): number {
  const sum = allocations.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
  return sum - toRupiahInteger(totalPayment);
}

// ---------------------------------------------------------------------------
// Template tag contracts
// ---------------------------------------------------------------------------

export interface TagihanTemplateTagContract {
  /** Upload is rejected when any of these keys is missing */
  required: string[];
  /** Keys the system can autofill; unused ones are reported as a warning */
  standard: string[];
}

export const TAGIHAN_TEMPLATE_TAGS: Record<TagihanDocumentPurpose, TagihanTemplateTagContract> = {
  SURAT_PERMOHONAN: {
    required: [],
    standard: [
      "nomor_surat",
      "nomor_sdi",
      "nomor_mo",
      "tanggal_surat",
      "periode",
      "komoditas",
      "kuantum",
      "satuan",
      "biaya",
      "jumlah",
      "total",
      "terbilang",
      "rincian",
      "rincian.komoditas",
      "rincian.kuantum",
      "rincian.satuan",
      "rincian.biaya",
      "rincian.jumlah",
    ],
  },
  TANDA_TERIMA: {
    required: ["buruh", "buruh.nama", "buruh.diterima", "total_upah", "tanggal"],
    standard: [
      "judul",
      "nama_gudang",
      "kanwil",
      "tanggal",
      "tonase",
      "upah_per_kg",
      "total_upah",
      "jumlah_buruh",
      "buruh",
      "buruh.no",
      "buruh.nama",
      "buruh.penyaluran",
      "buruh.diterima",
      "buruh.ganjil",
      "total_penyaluran",
      "total_diterima",
      "kota",
      "tanggal_ttd",
      "kepala_gudang",
      "mandor",
    ],
  },
};

/**
 * Tag names used by existing templates, mapped to standard keys (lowercase,
 * top-level only). Matching is case-insensitive before aliases apply.
 */
export const TAGIHAN_TEMPLATE_KEY_ALIASES: Record<TagihanDocumentPurpose, Record<string, string>> = {
  SURAT_PERMOHONAN: {
    sdip: "nomor_sdi",
    mo: "nomor_mo",
    tanggal: "tanggal_surat",
    nominal: "total",
  },
  TANDA_TERIMA: {},
};

const contains = (list: string[], key: string) => list.indexOf(key) !== -1;

/**
 * Standard key for a template tag ("TANGGAL" -> "tanggal_surat",
 * "RINCIAN.KOMODITAS" -> "rincian.komoditas"), or null when it is custom.
 */
export function canonicalTagihanKey(purpose: TagihanDocumentPurpose, key: string): string | null {
  const contract = TAGIHAN_TEMPLATE_TAGS[purpose];
  const known = contract.required.concat(contract.standard);
  const lower = key.toLowerCase();
  if (contains(known, lower)) return lower;
  const alias = TAGIHAN_TEMPLATE_KEY_ALIASES[purpose][lower];
  return alias && contains(known, alias) ? alias : null;
}

export interface TemplateTagCheckResult {
  isValid: boolean;
  missingRequired: string[];
  unusedStandard: string[];
  /** Template keys outside the contract; shown as manual fields in the modal */
  customKeys: string[];
}

/** Check extracted placeholder keys (loop children are dotted, e.g. "buruh.nama"). */
export function checkTagihanTemplateTags(
  purpose: TagihanDocumentPurpose,
  templateKeys: string[],
): TemplateTagCheckResult {
  const contract = TAGIHAN_TEMPLATE_TAGS[purpose];
  const canonical = templateKeys
    .map((k) => canonicalTagihanKey(purpose, k))
    .filter((k): k is string => k !== null);
  // Keys nested in a known loop (e.g. "buruh.ganjil.no") are filled per row,
  // never entered manually, so they count as known
  const isKnown = (key: string) => {
    const parts = key.split(".");
    for (let i = parts.length; i > 0; i--) {
      if (canonicalTagihanKey(purpose, parts.slice(0, i).join(".")) !== null) return true;
    }
    return false;
  };

  const missingRequired = contract.required.filter((k) => !contains(canonical, k));
  return {
    isValid: missingRequired.length === 0,
    missingRequired,
    unusedStandard: contract.standard.filter(
      (k) => !contains(canonical, k) && !contains(contract.required, k),
    ),
    customKeys: templateKeys.filter((k) => !isKnown(k)),
  };
}

/**
 * Copy standard values onto the template's own tag names (docxtemplater tags
 * are case-sensitive), including field names inside loop rows.
 */
export function expandToTemplateKeys(
  purpose: TagihanDocumentPurpose,
  values: Record<string, any>,
  templateKeys: string[],
): Record<string, any> {
  const out: Record<string, any> = { ...values };
  for (const key of templateKeys) {
    if (key.indexOf(".") !== -1) continue;
    const canonical = canonicalTagihanKey(purpose, key);
    if (!canonical || values[canonical] === undefined) continue;

    const value = values[canonical];
    if (Array.isArray(value)) {
      // Every segment used below this loop, e.g. "BURUH.GANJIL.NO" -> GANJIL, NO
      const segments: string[] = [];
      for (const child of templateKeys) {
        if (child.indexOf(`${key}.`) !== 0) continue;
        child
          .slice(key.length + 1)
          .split(".")
          .forEach((s) => {
            if (!contains(segments, s)) segments.push(s);
          });
      }
      out[key] = value.map((row) => {
        if (!row || typeof row !== "object") return row;
        const mapped: Record<string, any> = { ...row };
        segments.forEach((s) => {
          const lower = s.toLowerCase();
          if (s !== lower && row[lower] !== undefined) mapped[s] = row[lower];
        });
        return mapped;
      });
    } else {
      out[key] = value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

export const TagihanDocumentQuerySchema = z.object({
  purpose: TagihanDocumentPurposeEnum,
  // Narrows the nomor surat suggestion to the chosen template
  templateUuid: z.string().uuid().optional(),
});
export type TagihanDocumentQueryInput = z.infer<typeof TagihanDocumentQuerySchema>;

export const TagihanDocumentHistoryQuerySchema = z.object({
  purpose: TagihanDocumentPurposeEnum.optional(),
});
export type TagihanDocumentHistoryQueryInput = z.infer<typeof TagihanDocumentHistoryQuerySchema>;

/** Standard keys the user may edit; every other standard key is derived from the Tagihan */
export const TAGIHAN_EDITABLE_KEYS: Record<TagihanDocumentPurpose, string[]> = {
  // nomor_mo is prefilled from the ERP documents but stays editable in case refFax is empty
  SURAT_PERMOHONAN: ["nomor_surat", "nomor_mo", "tanggal_surat", "periode", "komoditas"],
  TANDA_TERIMA: ["judul", "nama_gudang", "kanwil", "tanggal", "kota", "tanggal_ttd", "kepala_gudang"],
};

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface TagihanDocumentTemplateOption {
  uuid: string;
  code: string;
  name: string;
  description: string | null;
  version: number;
  tagihanType: string | null;
  isWarehouseSpecific: boolean;
  placeholderSchema: Array<{ key: string; label: string; type: string; required: boolean }>;
  /** Template keys outside the contract, filled manually in the modal */
  customKeys: string[];
}

export interface TagihanDocumentWorker {
  uuid: string;
  name: string;
  isMandor: boolean;
}

export interface TagihanDocumentPrefill {
  purpose: TagihanDocumentPurpose;
  values: Record<string, any>;
  editableKeys: string[];
  /** Tanda Terima only */
  totalPayment?: number;
  workers?: TagihanDocumentWorker[];
  defaultRemainderBuruhUuid?: string | null;
}

export type TagihanGenerationStatus = "PROCESSING" | "GENERATED" | "FAILED";

export interface TagihanGeneratedDocumentItem {
  uuid: string;
  purpose: TagihanDocumentPurpose;
  title: string;
  documentNumber: string;
  status: TagihanGenerationStatus;
  progress: number;
  stage: string | null;
  errorMessage: string | null;
  generatedAt: string;
  template: { name: string; version: number } | null;
  generator: { name: string } | null;
  files: Array<{ uuid: string; fileName: string; mimeType: string }>;
}

export const GenerateSuratPermohonanSchema = z.object({
  templateUuid: z.string().uuid("Template wajib dipilih"),
  values: z
    .record(z.any())
    // Template tags may be upper-case (e.g. NOMOR_SURAT)
    .refine(
      (v) =>
        Object.keys(v).some(
          (k) => k.toLowerCase() === "nomor_surat" && typeof v[k] === "string" && v[k].trim().length > 0,
        ),
      { message: "Nomor surat wajib diisi", path: ["nomor_surat"] },
    ),
});
export type GenerateSuratPermohonanInput = z.infer<typeof GenerateSuratPermohonanSchema>;

export const TandaTerimaRecipientSchema = z.object({
  buruhUuid: z.string().uuid(),
  amount: z.number().int("Nominal harus bilangan bulat").nonnegative("Nominal tidak boleh negatif"),
});
export type TandaTerimaRecipientInput = z.infer<typeof TandaTerimaRecipientSchema>;

export const GenerateTandaTerimaSchema = z
  .object({
    templateUuid: z.string().uuid().optional(),
    recipients: z.array(TandaTerimaRecipientSchema).min(1, "Pilih minimal 1 buruh"),
    remainderBuruhUuid: z.string().uuid(),
    values: z.record(z.any()).optional().default({}),
  })
  .superRefine((data, ctx) => {
    const ids = data.recipients.map((r) => r.buruhUuid);
    if (hasDuplicates(ids)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recipients"], message: "Buruh tidak boleh dipilih dua kali" });
    }
    if (ids.indexOf(data.remainderBuruhUuid) === -1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["remainderBuruhUuid"],
        message: "Penerima sisa pembayaran harus termasuk buruh yang dipilih",
      });
    }
  });
export type GenerateTandaTerimaInput = z.infer<typeof GenerateTandaTerimaSchema>;

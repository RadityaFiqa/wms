import { z } from "zod";
export declare const TagihanDocumentPurposeEnum: z.ZodEnum<["SURAT_PERMOHONAN", "TANDA_TERIMA"]>;
export type TagihanDocumentPurpose = z.infer<typeof TagihanDocumentPurposeEnum>;
export declare const TAGIHAN_PURPOSE_LABELS: Record<TagihanDocumentPurpose, string>;
/**
 * Tagihan usage fields for DocumentTemplate create/update.
 * tagihanType null means the template applies to every Tagihan type.
 */
export declare const TagihanTemplateUsageSchema: z.ZodObject<{
    tagihanPurpose: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodEnum<["SURAT_PERMOHONAN", "TANDA_TERIMA"]>>, "SURAT_PERMOHONAN" | "TANDA_TERIMA" | null, unknown>>;
    tagihanType: z.ZodOptional<z.ZodEffects<z.ZodNullable<z.ZodEnum<["LOADING", "UNLOADING", "REBAGGING", "REPROSES", "OVERSTAPEL"]>>, "LOADING" | "UNLOADING" | "REBAGGING" | "REPROSES" | "OVERSTAPEL" | null, unknown>>;
}, "strip", z.ZodTypeAny, {
    tagihanPurpose?: "SURAT_PERMOHONAN" | "TANDA_TERIMA" | null | undefined;
    tagihanType?: "LOADING" | "UNLOADING" | "REBAGGING" | "REPROSES" | "OVERSTAPEL" | null | undefined;
}, {
    tagihanPurpose?: unknown;
    tagihanType?: unknown;
}>;
export type TagihanTemplateUsageInput = z.infer<typeof TagihanTemplateUsageSchema>;
/** Whole rupiah; Tagihan amounts are stored as Float. */
export declare function toRupiahInteger(value: number): number;
/** 2268000 -> "2.268.000" */
export declare function formatNumberId(value: number, maximumFractionDigits?: number): string;
/** 2268000 -> "Rp 2.268.000" */
export declare function formatRupiah(value: number): string;
/**
 * Indonesian number words for the integer part, e.g. 2268000 ->
 * "dua juta dua ratus enam puluh delapan ribu".
 */
export declare function terbilang(value: number): string;
/** "Dua Juta Dua Ratus Enam Puluh Delapan Ribu Rupiah" */
export declare function terbilangRupiah(value: number): string;
/** "12 Oktober 2026" in the given IANA time zone (defaults to runtime zone). */
export declare function formatTanggalId(date: Date | string, timeZone?: string): string;
/** "Oktober 2026" */
export declare function formatBulanTahunId(date: Date | string, timeZone?: string): string;
/**
 * Periode label from a date range:
 * same month -> "Oktober 2026"; same year -> "Agustus - Oktober 2026";
 * otherwise "Desember 2025 - Januari 2026".
 */
export declare function formatPeriodeId(start: Date | string, end: Date | string, timeZone?: string): string;
/**
 * Suggest the next surat number by incrementing the first number group
 * (the running sequence in formats like "045/BLG/KC.BJM/X/2026"), keeping
 * zero padding. Returns "" when there is nothing to increment.
 */
export declare function suggestNextNomorSurat(last?: string | null): string;
export interface WorkerAllocation {
    id: string;
    amount: number;
}
/**
 * Split the total evenly, rounding each share down to the nearest Rp100;
 * the remainder recipient (default: first worker) takes the leftover so the
 * sum always equals the total.
 */
export declare function allocateWorkerPayments(totalPayment: number, workerIds: string[], remainderId?: string | null): WorkerAllocation[];
/** Difference between the allocated sum and the expected total (0 = valid). */
export declare function allocationDifference(totalPayment: number, allocations: Array<{
    amount: number;
}>): number;
export interface TagihanTemplateTagContract {
    /** Upload is rejected when any of these keys is missing */
    required: string[];
    /** Keys the system can autofill; unused ones are reported as a warning */
    standard: string[];
}
export declare const TAGIHAN_TEMPLATE_TAGS: Record<TagihanDocumentPurpose, TagihanTemplateTagContract>;
/**
 * Tag names used by existing templates, mapped to standard keys (lowercase,
 * top-level only). Matching is case-insensitive before aliases apply.
 */
export declare const TAGIHAN_TEMPLATE_KEY_ALIASES: Record<TagihanDocumentPurpose, Record<string, string>>;
/**
 * Standard key for a template tag ("TANGGAL" -> "tanggal_surat",
 * "RINCIAN.KOMODITAS" -> "rincian.komoditas"), or null when it is custom.
 */
export declare function canonicalTagihanKey(purpose: TagihanDocumentPurpose, key: string): string | null;
export interface TemplateTagCheckResult {
    isValid: boolean;
    missingRequired: string[];
    unusedStandard: string[];
    /** Template keys outside the contract; shown as manual fields in the modal */
    customKeys: string[];
}
/** Check extracted placeholder keys (loop children are dotted, e.g. "buruh.nama"). */
export declare function checkTagihanTemplateTags(purpose: TagihanDocumentPurpose, templateKeys: string[]): TemplateTagCheckResult;
/**
 * Copy standard values onto the template's own tag names (docxtemplater tags
 * are case-sensitive), including field names inside loop rows.
 */
export declare function expandToTemplateKeys(purpose: TagihanDocumentPurpose, values: Record<string, any>, templateKeys: string[]): Record<string, any>;
export declare const TagihanDocumentQuerySchema: z.ZodObject<{
    purpose: z.ZodEnum<["SURAT_PERMOHONAN", "TANDA_TERIMA"]>;
    templateUuid: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    purpose: "SURAT_PERMOHONAN" | "TANDA_TERIMA";
    templateUuid?: string | undefined;
}, {
    purpose: "SURAT_PERMOHONAN" | "TANDA_TERIMA";
    templateUuid?: string | undefined;
}>;
export type TagihanDocumentQueryInput = z.infer<typeof TagihanDocumentQuerySchema>;
export declare const TagihanDocumentHistoryQuerySchema: z.ZodObject<{
    purpose: z.ZodOptional<z.ZodEnum<["SURAT_PERMOHONAN", "TANDA_TERIMA"]>>;
}, "strip", z.ZodTypeAny, {
    purpose?: "SURAT_PERMOHONAN" | "TANDA_TERIMA" | undefined;
}, {
    purpose?: "SURAT_PERMOHONAN" | "TANDA_TERIMA" | undefined;
}>;
export type TagihanDocumentHistoryQueryInput = z.infer<typeof TagihanDocumentHistoryQuerySchema>;
/** Standard keys the user may edit; every other standard key is derived from the Tagihan */
export declare const TAGIHAN_EDITABLE_KEYS: Record<TagihanDocumentPurpose, string[]>;
export interface TagihanDocumentTemplateOption {
    uuid: string;
    code: string;
    name: string;
    description: string | null;
    version: number;
    tagihanType: string | null;
    isWarehouseSpecific: boolean;
    placeholderSchema: Array<{
        key: string;
        label: string;
        type: string;
        required: boolean;
    }>;
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
    template: {
        name: string;
        version: number;
    } | null;
    generator: {
        name: string;
    } | null;
    files: Array<{
        uuid: string;
        fileName: string;
        mimeType: string;
    }>;
}
export declare const GenerateSuratPermohonanSchema: z.ZodObject<{
    templateUuid: z.ZodString;
    values: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodAny>, Record<string, any>, Record<string, any>>;
}, "strip", z.ZodTypeAny, {
    templateUuid: string;
    values: Record<string, any>;
}, {
    templateUuid: string;
    values: Record<string, any>;
}>;
export type GenerateSuratPermohonanInput = z.infer<typeof GenerateSuratPermohonanSchema>;
export declare const TandaTerimaRecipientSchema: z.ZodObject<{
    buruhUuid: z.ZodString;
    amount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    buruhUuid: string;
    amount: number;
}, {
    buruhUuid: string;
    amount: number;
}>;
export type TandaTerimaRecipientInput = z.infer<typeof TandaTerimaRecipientSchema>;
export declare const GenerateTandaTerimaSchema: z.ZodEffects<z.ZodObject<{
    templateUuid: z.ZodOptional<z.ZodString>;
    recipients: z.ZodArray<z.ZodObject<{
        buruhUuid: z.ZodString;
        amount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        buruhUuid: string;
        amount: number;
    }, {
        buruhUuid: string;
        amount: number;
    }>, "many">;
    remainderBuruhUuid: z.ZodString;
    values: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>>;
}, "strip", z.ZodTypeAny, {
    values: Record<string, any>;
    recipients: {
        buruhUuid: string;
        amount: number;
    }[];
    remainderBuruhUuid: string;
    templateUuid?: string | undefined;
}, {
    recipients: {
        buruhUuid: string;
        amount: number;
    }[];
    remainderBuruhUuid: string;
    templateUuid?: string | undefined;
    values?: Record<string, any> | undefined;
}>, {
    values: Record<string, any>;
    recipients: {
        buruhUuid: string;
        amount: number;
    }[];
    remainderBuruhUuid: string;
    templateUuid?: string | undefined;
}, {
    recipients: {
        buruhUuid: string;
        amount: number;
    }[];
    remainderBuruhUuid: string;
    templateUuid?: string | undefined;
    values?: Record<string, any> | undefined;
}>;
export type GenerateTandaTerimaInput = z.infer<typeof GenerateTandaTerimaSchema>;
//# sourceMappingURL=tagihan-document.d.ts.map
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateTandaTerimaSchema = exports.TandaTerimaRecipientSchema = exports.GenerateSuratPermohonanSchema = exports.TAGIHAN_EDITABLE_KEYS = exports.TagihanDocumentHistoryQuerySchema = exports.TagihanDocumentQuerySchema = exports.TAGIHAN_TEMPLATE_KEY_ALIASES = exports.TAGIHAN_TEMPLATE_TAGS = exports.TagihanTemplateUsageSchema = exports.TAGIHAN_PURPOSE_LABELS = exports.TagihanDocumentPurposeEnum = void 0;
exports.toRupiahInteger = toRupiahInteger;
exports.formatNumberId = formatNumberId;
exports.formatRupiah = formatRupiah;
exports.terbilang = terbilang;
exports.terbilangRupiah = terbilangRupiah;
exports.formatTanggalId = formatTanggalId;
exports.formatBulanTahunId = formatBulanTahunId;
exports.formatPeriodeId = formatPeriodeId;
exports.suggestNextNomorSurat = suggestNextNomorSurat;
exports.allocateWorkerPayments = allocateWorkerPayments;
exports.allocationDifference = allocationDifference;
exports.canonicalTagihanKey = canonicalTagihanKey;
exports.checkTagihanTemplateTags = checkTagihanTemplateTags;
exports.expandToTemplateKeys = expandToTemplateKeys;
var zod_1 = require("zod");
// Tagihan Document Generation (Surat Permohonan / Tanda Terima)
exports.TagihanDocumentPurposeEnum = zod_1.z.enum(["SURAT_PERMOHONAN", "TANDA_TERIMA"]);
exports.TAGIHAN_PURPOSE_LABELS = {
    SURAT_PERMOHONAN: "Surat Permohonan Biaya",
    TANDA_TERIMA: "Tanda Terima Upah Buruh",
};
// Local copy avoids a runtime circular import with index.ts; the check below
// fails compilation if it drifts from TagihanTypeEnum.
var TAGIHAN_TYPES = ["LOADING", "UNLOADING", "REBAGGING", "REPROSES", "OVERSTAPEL"];
var _tagihanTypesInSync = true;
void _tagihanTypesInSync;
// Multipart forms send "" for an unselected option; treat it as "not set"
var emptyToNull = function (v) { return (v === "" ? null : v); };
/**
 * Tagihan usage fields for DocumentTemplate create/update.
 * tagihanType null means the template applies to every Tagihan type.
 */
exports.TagihanTemplateUsageSchema = zod_1.z.object({
    tagihanPurpose: zod_1.z.preprocess(emptyToNull, exports.TagihanDocumentPurposeEnum.nullable()).optional(),
    tagihanType: zod_1.z.preprocess(emptyToNull, zod_1.z.enum(TAGIHAN_TYPES).nullable()).optional(),
});
// ---------------------------------------------------------------------------
// Formatting helpers (shared so the modal preview matches the generated file)
// ---------------------------------------------------------------------------
var BULAN = [
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
function toRupiahInteger(value) {
    return Math.round(Number(value) || 0);
}
/** 2268000 -> "2.268.000" */
function formatNumberId(value, maximumFractionDigits) {
    if (maximumFractionDigits === void 0) { maximumFractionDigits = 0; }
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: maximumFractionDigits }).format(Number(value) || 0);
}
/** 2268000 -> "Rp 2.268.000" */
function formatRupiah(value) {
    return "Rp ".concat(formatNumberId(toRupiahInteger(value)));
}
var SATUAN = [
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
function terbilangBelowThousand(n) {
    if (n < 12)
        return SATUAN[n];
    if (n < 20)
        return "".concat(SATUAN[n - 10], " belas");
    if (n < 100) {
        var rest_1 = n % 10;
        return "".concat(SATUAN[Math.floor(n / 10)], " puluh").concat(rest_1 ? " ".concat(SATUAN[rest_1]) : "");
    }
    var hundreds = Math.floor(n / 100);
    var rest = n % 100;
    var head = hundreds === 1 ? "seratus" : "".concat(SATUAN[hundreds], " ratus");
    return rest ? "".concat(head, " ").concat(terbilangBelowThousand(rest)) : head;
}
var SKALA = [
    [1000000000000, "triliun"],
    [1000000000, "miliar"],
    [1000000, "juta"],
    [1000, "ribu"],
];
/**
 * Indonesian number words for the integer part, e.g. 2268000 ->
 * "dua juta dua ratus enam puluh delapan ribu".
 */
function terbilang(value) {
    var n = Math.floor(Math.abs(Number(value) || 0));
    if (n === 0)
        return "nol";
    var parts = [];
    for (var _i = 0, SKALA_1 = SKALA; _i < SKALA_1.length; _i++) {
        var _a = SKALA_1[_i], size = _a[0], name_1 = _a[1];
        if (n >= size) {
            var count = Math.floor(n / size);
            n %= size;
            // "seribu", not "satu ribu"; larger scales keep "satu juta"
            parts.push(size === 1000 && count === 1 ? "seribu" : "".concat(terbilang(count), " ").concat(name_1));
        }
    }
    if (n > 0)
        parts.push(terbilangBelowThousand(n));
    var words = parts.join(" ");
    return value < 0 ? "minus ".concat(words) : words;
}
/** "Dua Juta Dua Ratus Enam Puluh Delapan Ribu Rupiah" */
function terbilangRupiah(value) {
    var words = "".concat(terbilang(toRupiahInteger(value)), " rupiah");
    return words.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}
// The schema package compiles against the ES5 lib, so stick to ES5-typed APIs
var toDate = function (value) {
    return value instanceof Date ? value : new Date(value);
};
function datePartsIn(date, timeZone) {
    // en-US numeric renders as "M/D/YYYY"
    var _a = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
    })
        .format(date)
        .split("/")
        .map(Number), month = _a[0], day = _a[1], year = _a[2];
    return { day: day, month: month, year: year };
}
/** "12 Oktober 2026" in the given IANA time zone (defaults to runtime zone). */
function formatTanggalId(date, timeZone) {
    var _a = datePartsIn(toDate(date), timeZone), day = _a.day, month = _a.month, year = _a.year;
    return "".concat(day, " ").concat(BULAN[month - 1], " ").concat(year);
}
/** "Oktober 2026" */
function formatBulanTahunId(date, timeZone) {
    var _a = datePartsIn(toDate(date), timeZone), month = _a.month, year = _a.year;
    return "".concat(BULAN[month - 1], " ").concat(year);
}
/**
 * Periode label from a date range:
 * same month -> "Oktober 2026"; same year -> "Agustus - Oktober 2026";
 * otherwise "Desember 2025 - Januari 2026".
 */
function formatPeriodeId(start, end, timeZone) {
    var a = datePartsIn(toDate(start), timeZone);
    var b = datePartsIn(toDate(end), timeZone);
    if (a.year === b.year && a.month === b.month)
        return "".concat(BULAN[a.month - 1], " ").concat(a.year);
    if (a.year === b.year)
        return "".concat(BULAN[a.month - 1], " - ").concat(BULAN[b.month - 1], " ").concat(b.year);
    return "".concat(BULAN[a.month - 1], " ").concat(a.year, " - ").concat(BULAN[b.month - 1], " ").concat(b.year);
}
/**
 * Suggest the next surat number by incrementing the first number group
 * (the running sequence in formats like "045/BLG/KC.BJM/X/2026"), keeping
 * zero padding. Returns "" when there is nothing to increment.
 */
function suggestNextNomorSurat(last) {
    if (!last)
        return "";
    var match = last.match(/\d+/);
    if (!match || match.index === undefined)
        return "";
    var next = String(Number(match[0]) + 1);
    while (next.length < match[0].length)
        next = "0".concat(next);
    return last.slice(0, match.index) + next + last.slice(match.index + match[0].length);
}
// ---------------------------------------------------------------------------
// Tanda Terima payment allocation
// ---------------------------------------------------------------------------
function hasDuplicates(values) {
    return values.some(function (v, i) { return values.indexOf(v) !== i; });
}
/**
 * Split the total evenly, rounding each share down to the nearest Rp100;
 * the remainder recipient (default: first worker) takes the leftover so the
 * sum always equals the total.
 */
function allocateWorkerPayments(totalPayment, workerIds, remainderId) {
    if (workerIds.length === 0)
        return [];
    if (hasDuplicates(workerIds)) {
        throw new Error("Daftar buruh mengandung duplikat.");
    }
    var total = toRupiahInteger(totalPayment);
    if (total < 0)
        throw new Error("Total pembayaran tidak boleh negatif.");
    var recipient = remainderId !== null && remainderId !== void 0 ? remainderId : workerIds[0];
    if (workerIds.indexOf(recipient) === -1) {
        throw new Error("Penerima sisa pembayaran harus termasuk buruh yang dipilih.");
    }
    var basePayment = Math.floor(total / workerIds.length / 100) * 100;
    var remainder = total - basePayment * workerIds.length;
    return workerIds.map(function (id) { return ({
        id: id,
        amount: id === recipient ? basePayment + remainder : basePayment,
    }); });
}
/** Difference between the allocated sum and the expected total (0 = valid). */
function allocationDifference(totalPayment, allocations) {
    var sum = allocations.reduce(function (acc, a) { return acc + (Number(a.amount) || 0); }, 0);
    return sum - toRupiahInteger(totalPayment);
}
exports.TAGIHAN_TEMPLATE_TAGS = {
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
exports.TAGIHAN_TEMPLATE_KEY_ALIASES = {
    SURAT_PERMOHONAN: {
        sdip: "nomor_sdi",
        mo: "nomor_mo",
        tanggal: "tanggal_surat",
        nominal: "total",
    },
    TANDA_TERIMA: {},
};
var contains = function (list, key) { return list.indexOf(key) !== -1; };
/**
 * Standard key for a template tag ("TANGGAL" -> "tanggal_surat",
 * "RINCIAN.KOMODITAS" -> "rincian.komoditas"), or null when it is custom.
 */
function canonicalTagihanKey(purpose, key) {
    var contract = exports.TAGIHAN_TEMPLATE_TAGS[purpose];
    var known = contract.required.concat(contract.standard);
    var lower = key.toLowerCase();
    if (contains(known, lower))
        return lower;
    var alias = exports.TAGIHAN_TEMPLATE_KEY_ALIASES[purpose][lower];
    return alias && contains(known, alias) ? alias : null;
}
/** Check extracted placeholder keys (loop children are dotted, e.g. "buruh.nama"). */
function checkTagihanTemplateTags(purpose, templateKeys) {
    var contract = exports.TAGIHAN_TEMPLATE_TAGS[purpose];
    var canonical = templateKeys
        .map(function (k) { return canonicalTagihanKey(purpose, k); })
        .filter(function (k) { return k !== null; });
    // Keys nested in a known loop (e.g. "buruh.ganjil.no") are filled per row,
    // never entered manually, so they count as known
    var isKnown = function (key) {
        var parts = key.split(".");
        for (var i = parts.length; i > 0; i--) {
            if (canonicalTagihanKey(purpose, parts.slice(0, i).join(".")) !== null)
                return true;
        }
        return false;
    };
    var missingRequired = contract.required.filter(function (k) { return !contains(canonical, k); });
    return {
        isValid: missingRequired.length === 0,
        missingRequired: missingRequired,
        unusedStandard: contract.standard.filter(function (k) { return !contains(canonical, k) && !contains(contract.required, k); }),
        customKeys: templateKeys.filter(function (k) { return !isKnown(k); }),
    };
}
/**
 * Copy standard values onto the template's own tag names (docxtemplater tags
 * are case-sensitive), including field names inside loop rows.
 */
function expandToTemplateKeys(purpose, values, templateKeys) {
    var out = __assign({}, values);
    var _loop_1 = function (key) {
        if (key.indexOf(".") !== -1)
            return "continue";
        var canonical = canonicalTagihanKey(purpose, key);
        if (!canonical || values[canonical] === undefined)
            return "continue";
        var value = values[canonical];
        if (Array.isArray(value)) {
            // Every segment used below this loop, e.g. "BURUH.GANJIL.NO" -> GANJIL, NO
            var segments_1 = [];
            for (var _a = 0, templateKeys_2 = templateKeys; _a < templateKeys_2.length; _a++) {
                var child = templateKeys_2[_a];
                if (child.indexOf("".concat(key, ".")) !== 0)
                    continue;
                child
                    .slice(key.length + 1)
                    .split(".")
                    .forEach(function (s) {
                    if (!contains(segments_1, s))
                        segments_1.push(s);
                });
            }
            out[key] = value.map(function (row) {
                if (!row || typeof row !== "object")
                    return row;
                var mapped = __assign({}, row);
                segments_1.forEach(function (s) {
                    var lower = s.toLowerCase();
                    if (s !== lower && row[lower] !== undefined)
                        mapped[s] = row[lower];
                });
                return mapped;
            });
        }
        else {
            out[key] = value;
        }
    };
    for (var _i = 0, templateKeys_1 = templateKeys; _i < templateKeys_1.length; _i++) {
        var key = templateKeys_1[_i];
        _loop_1(key);
    }
    return out;
}
// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------
exports.TagihanDocumentQuerySchema = zod_1.z.object({
    purpose: exports.TagihanDocumentPurposeEnum,
    // Narrows the nomor surat suggestion to the chosen template
    templateUuid: zod_1.z.string().uuid().optional(),
});
exports.TagihanDocumentHistoryQuerySchema = zod_1.z.object({
    purpose: exports.TagihanDocumentPurposeEnum.optional(),
});
/** Standard keys the user may edit; every other standard key is derived from the Tagihan */
exports.TAGIHAN_EDITABLE_KEYS = {
    // nomor_mo is prefilled from the ERP documents but stays editable in case refFax is empty
    SURAT_PERMOHONAN: ["nomor_surat", "nomor_mo", "tanggal_surat", "periode", "komoditas"],
    TANDA_TERIMA: ["judul", "nama_gudang", "kanwil", "tanggal", "kota", "tanggal_ttd", "kepala_gudang"],
};
exports.GenerateSuratPermohonanSchema = zod_1.z.object({
    templateUuid: zod_1.z.string().uuid("Template wajib dipilih"),
    values: zod_1.z
        .record(zod_1.z.any())
        // Template tags may be upper-case (e.g. NOMOR_SURAT)
        .refine(function (v) {
        return Object.keys(v).some(function (k) { return k.toLowerCase() === "nomor_surat" && typeof v[k] === "string" && v[k].trim().length > 0; });
    }, { message: "Nomor surat wajib diisi", path: ["nomor_surat"] }),
});
exports.TandaTerimaRecipientSchema = zod_1.z.object({
    buruhUuid: zod_1.z.string().uuid(),
    amount: zod_1.z.number().int("Nominal harus bilangan bulat").nonnegative("Nominal tidak boleh negatif"),
});
exports.GenerateTandaTerimaSchema = zod_1.z
    .object({
    templateUuid: zod_1.z.string().uuid().optional(),
    recipients: zod_1.z.array(exports.TandaTerimaRecipientSchema).min(1, "Pilih minimal 1 buruh"),
    remainderBuruhUuid: zod_1.z.string().uuid(),
    values: zod_1.z.record(zod_1.z.any()).optional().default({}),
})
    .superRefine(function (data, ctx) {
    var ids = data.recipients.map(function (r) { return r.buruhUuid; });
    if (hasDuplicates(ids)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["recipients"], message: "Buruh tidak boleh dipilih dua kali" });
    }
    if (ids.indexOf(data.remainderBuruhUuid) === -1) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["remainderBuruhUuid"],
            message: "Penerima sisa pembayaran harus termasuk buruh yang dipilih",
        });
    }
});

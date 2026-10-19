import {
  terbilang,
  terbilangRupiah,
  formatRupiah,
  formatTanggalId,
  formatPeriodeId,
  suggestNextNomorSurat,
  allocateWorkerPayments,
  allocationDifference,
  checkTagihanTemplateTags,
  canonicalTagihanKey,
  expandToTemplateKeys,
  GenerateTandaTerimaSchema,
  GenerateSuratPermohonanSchema,
  TagihanTemplateUsageSchema,
} from '@bulog-wms/schema';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('terbilang', () => {
  it.each([
    [0, 'nol'],
    [1, 'satu'],
    [10, 'sepuluh'],
    [11, 'sebelas'],
    [15, 'lima belas'],
    [21, 'dua puluh satu'],
    [100, 'seratus'],
    [115, 'seratus lima belas'],
    [999, 'sembilan ratus sembilan puluh sembilan'],
    [1000, 'seribu'],
    [1500, 'seribu lima ratus'],
    [2000, 'dua ribu'],
    [113400, 'seratus tiga belas ribu empat ratus'],
    [1000000, 'satu juta'],
    [2268000, 'dua juta dua ratus enam puluh delapan ribu'],
    [1001000, 'satu juta seribu'],
    [1000000000, 'satu miliar'],
    [2500000000000, 'dua triliun lima ratus miliar'],
  ])('%d -> %s', (value, words) => {
    expect(terbilang(value)).toBe(words);
  });

  it('handles negatives and ignores fractions', () => {
    expect(terbilang(-25)).toBe('minus dua puluh lima');
    expect(terbilang(12.9)).toBe('dua belas');
  });

  it('terbilangRupiah rounds to whole rupiah and title-cases', () => {
    expect(terbilangRupiah(2268000)).toBe(
      'Dua Juta Dua Ratus Enam Puluh Delapan Ribu Rupiah',
    );
    expect(terbilangRupiah(999.6)).toBe('Seribu Rupiah');
  });
});

describe('formatting', () => {
  it('formats rupiah with Indonesian grouping', () => {
    expect(formatRupiah(2268000)).toBe('Rp 2.268.000');
    expect(formatRupiah(113400.4)).toBe('Rp 113.400');
  });

  it('formats dates in the requested time zone', () => {
    // 2026-10-11T17:30Z is already 12 Oktober in WITA (UTC+8)
    expect(formatTanggalId('2026-10-11T17:30:00Z', 'Asia/Makassar')).toBe('12 Oktober 2026');
    expect(formatTanggalId('2026-10-11T17:30:00Z', 'UTC')).toBe('11 Oktober 2026');
  });

  it('formats periode ranges', () => {
    const tz = 'Asia/Makassar';
    expect(formatPeriodeId('2026-10-01T02:00:00Z', '2026-10-30T02:00:00Z', tz)).toBe('Oktober 2026');
    expect(formatPeriodeId('2026-08-01T02:00:00Z', '2026-10-30T02:00:00Z', tz)).toBe(
      'Agustus - Oktober 2026',
    );
    expect(formatPeriodeId('2025-12-20T02:00:00Z', '2026-01-10T02:00:00Z', tz)).toBe(
      'Desember 2025 - Januari 2026',
    );
  });
});

describe('suggestNextNomorSurat', () => {
  it('increments the leading sequence and keeps padding', () => {
    expect(suggestNextNomorSurat('045/BLG/KC.BJM/X/2026')).toBe('046/BLG/KC.BJM/X/2026');
    expect(suggestNextNomorSurat('099/A/2026')).toBe('100/A/2026');
    expect(suggestNextNomorSurat('B-7/2026')).toBe('B-8/2026');
  });

  it('returns empty when there is nothing to increment', () => {
    expect(suggestNextNomorSurat(null)).toBe('');
    expect(suggestNextNomorSurat('TANPA-NOMOR')).toBe('');
  });
});

describe('allocateWorkerPayments', () => {
  const sum = (a: Array<{ amount: number }>) => a.reduce((s, x) => s + x.amount, 0);

  it('splits evenly when the total divides cleanly', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `w${i}`);
    const result = allocateWorkerPayments(2268000, ids, 'w0');
    expect(result.every((r) => r.amount === 113400)).toBe(true);
    expect(sum(result)).toBe(2268000);
  });

  it('rounds shares down to Rp100 and gives the remainder to the chosen worker', () => {
    const result = allocateWorkerPayments(1000000, ['a', 'b', 'c'], 'c');
    expect(result).toEqual([
      { id: 'a', amount: 333300 },
      { id: 'b', amount: 333300 },
      { id: 'c', amount: 333400 },
    ]);
    expect(sum(result)).toBe(1000000);
  });

  it('defaults the remainder to the first worker', () => {
    const result = allocateWorkerPayments(1000, ['a', 'b', 'c']);
    expect(result[0]).toEqual({ id: 'a', amount: 400 });
    expect(sum(result)).toBe(1000);
  });

  it('handles a total smaller than Rp100 per worker', () => {
    const result = allocateWorkerPayments(250, ['a', 'b', 'c'], 'b');
    expect(result).toEqual([
      { id: 'a', amount: 0 },
      { id: 'b', amount: 250 },
      { id: 'c', amount: 0 },
    ]);
  });

  it('gives a single worker the whole total', () => {
    expect(allocateWorkerPayments(2268000, ['solo'])).toEqual([{ id: 'solo', amount: 2268000 }]);
  });

  it('rounds a fractional total to whole rupiah first', () => {
    const result = allocateWorkerPayments(1000.6, ['a', 'b']);
    expect(sum(result)).toBe(1001);
  });

  it('rejects duplicates and an unselected remainder recipient', () => {
    expect(() => allocateWorkerPayments(1000, ['a', 'a'])).toThrow();
    expect(() => allocateWorkerPayments(1000, ['a', 'b'], 'z')).toThrow();
  });

  it('returns an empty list without workers', () => {
    expect(allocateWorkerPayments(1000, [])).toEqual([]);
  });

  it('reports the allocation difference', () => {
    expect(allocationDifference(1000, [{ amount: 400 }, { amount: 600 }])).toBe(0);
    expect(allocationDifference(1000, [{ amount: 400 }, { amount: 500 }])).toBe(-100);
  });
});

describe('checkTagihanTemplateTags', () => {
  it('accepts a Tanda Terima template with all required tags', () => {
    const result = checkTagihanTemplateTags('TANDA_TERIMA', [
      'buruh',
      'buruh.no',
      'buruh.nama',
      'buruh.diterima',
      'total_upah',
      'tanggal',
      'catatan_khusus',
    ]);
    expect(result.isValid).toBe(true);
    expect(result.missingRequired).toEqual([]);
    expect(result.customKeys).toEqual(['catatan_khusus']);
  });

  it('treats keys nested in a known loop as known', () => {
    const result = checkTagihanTemplateTags('TANDA_TERIMA', [
      'buruh',
      'buruh.nama',
      'buruh.diterima',
      'buruh.ganjil',
      'buruh.ganjil.no',
      'total_upah',
      'tanggal',
    ]);
    expect(result.customKeys).toEqual([]);
  });

  it('lists missing required Tanda Terima tags', () => {
    const result = checkTagihanTemplateTags('TANDA_TERIMA', ['buruh', 'buruh.nama', 'tanggal']);
    expect(result.isValid).toBe(false);
    expect(result.missingRequired).toEqual(['buruh.diterima', 'total_upah']);
  });

  it('never rejects Surat Permohonan but reports unused standard tags', () => {
    const result = checkTagihanTemplateTags('SURAT_PERMOHONAN', ['nomor_surat', 'perihal']);
    expect(result.isValid).toBe(true);
    expect(result.unusedStandard).toContain('terbilang');
    expect(result.customKeys).toEqual(['perihal']);
  });
});

describe('canonical template keys', () => {
  const LOADING_KEYS = ['SDIP', 'TANGGAL', 'KOMODITAS', 'TUJUAN', 'PERIODE', 'KUANTUM', 'BIAYA', 'JUMLAH', 'TERBILANG', 'TUJUAN_PANGGILAN'];
  const REBAGGING_KEYS = ['SDIP', 'TANGGAL', 'MO', 'KUANTUM', 'NOMINAL', 'TERBILANG'];

  it('matches case-insensitively and applies Surat Permohonan aliases', () => {
    expect(canonicalTagihanKey('SURAT_PERMOHONAN', 'KUANTUM')).toBe('kuantum');
    expect(canonicalTagihanKey('SURAT_PERMOHONAN', 'SDIP')).toBe('nomor_sdi');
    expect(canonicalTagihanKey('SURAT_PERMOHONAN', 'MO')).toBe('nomor_mo');
    expect(canonicalTagihanKey('SURAT_PERMOHONAN', 'TANGGAL')).toBe('tanggal_surat');
    expect(canonicalTagihanKey('SURAT_PERMOHONAN', 'NOMINAL')).toBe('total');
    expect(canonicalTagihanKey('SURAT_PERMOHONAN', 'RINCIAN.KOMODITAS')).toBe('rincian.komoditas');
    expect(canonicalTagihanKey('SURAT_PERMOHONAN', 'TUJUAN')).toBeNull();
    // Aliases are per purpose: "tanggal" is its own key on Tanda Terima
    expect(canonicalTagihanKey('TANDA_TERIMA', 'TANGGAL')).toBe('tanggal');
  });

  it('only leaves the genuinely custom tags of the existing templates', () => {
    expect(checkTagihanTemplateTags('SURAT_PERMOHONAN', LOADING_KEYS).customKeys).toEqual([
      'TUJUAN',
      'TUJUAN_PANGGILAN',
    ]);
    expect(checkTagihanTemplateTags('SURAT_PERMOHONAN', REBAGGING_KEYS).customKeys).toEqual([]);
  });

  it('accepts an upper-case Tanda Terima template', () => {
    const result = checkTagihanTemplateTags('TANDA_TERIMA', [
      'BURUH', 'BURUH.NAMA', 'BURUH.DITERIMA', 'TOTAL_UPAH', 'TANGGAL',
    ]);
    expect(result.isValid).toBe(true);
  });

  it('expands values onto the template spelling, including loop rows', () => {
    const out = expandToTemplateKeys(
      'TANDA_TERIMA',
      {
        tanggal: '12 Oktober 2026',
        total_upah: '2.268.000',
        buruh: [{ no: 1, nama: 'AGUS', diterima: '113.400', ganjil: true }],
      },
      ['TANGGAL', 'TOTAL_UPAH', 'BURUH', 'BURUH.NAMA', 'BURUH.DITERIMA', 'BURUH.GANJIL', 'BURUH.GANJIL.NO'],
    );
    expect(out.TANGGAL).toBe('12 Oktober 2026');
    expect(out.TOTAL_UPAH).toBe('2.268.000');
    expect(out.BURUH[0]).toMatchObject({ NAMA: 'AGUS', DITERIMA: '113.400', GANJIL: true, NO: 1, nama: 'AGUS' });
  });

  it('maps aliased Surat Permohonan values', () => {
    const out = expandToTemplateKeys(
      'SURAT_PERMOHONAN',
      { nomor_sdi: 'SDI-7/16200/10/2026', nomor_mo: 'MO/1626/10/2026/16001', total: '1.944.000', tanggal_surat: '19 Oktober 2026' },
      REBAGGING_KEYS,
    );
    expect(out).toMatchObject({
      SDIP: 'SDI-7/16200/10/2026',
      MO: 'MO/1626/10/2026/16001',
      NOMINAL: '1.944.000',
      TANGGAL: '19 Oktober 2026',
    });
  });
});

describe('request schemas', () => {
  it('accepts an upper-case NOMOR_SURAT key', () => {
    expect(
      GenerateSuratPermohonanSchema.safeParse({ templateUuid: uuid(1), values: { NOMOR_SURAT: '001' } }).success,
    ).toBe(true);
  });

  it('requires nomor_surat for Surat Permohonan', () => {
    expect(
      GenerateSuratPermohonanSchema.safeParse({ templateUuid: uuid(1), values: {} }).success,
    ).toBe(false);
    expect(
      GenerateSuratPermohonanSchema.safeParse({
        templateUuid: uuid(1),
        values: { nomor_surat: '001/X/2026' },
      }).success,
    ).toBe(true);
  });

  it('requires the remainder recipient to be a selected, unique worker', () => {
    const recipients = [
      { buruhUuid: uuid(1), amount: 500 },
      { buruhUuid: uuid(2), amount: 500 },
    ];
    expect(
      GenerateTandaTerimaSchema.safeParse({ recipients, remainderBuruhUuid: uuid(2) }).success,
    ).toBe(true);
    expect(
      GenerateTandaTerimaSchema.safeParse({ recipients, remainderBuruhUuid: uuid(3) }).success,
    ).toBe(false);
    expect(
      GenerateTandaTerimaSchema.safeParse({
        recipients: [recipients[0], recipients[0]],
        remainderBuruhUuid: uuid(1),
      }).success,
    ).toBe(false);
  });

  it('treats an empty multipart option as null for template usage', () => {
    expect(TagihanTemplateUsageSchema.parse({ tagihanPurpose: '', tagihanType: '' })).toEqual({
      tagihanPurpose: null,
      tagihanType: null,
    });
    expect(TagihanTemplateUsageSchema.safeParse({ tagihanType: 'LOADING' }).success).toBe(true);
    expect(TagihanTemplateUsageSchema.safeParse({ tagihanType: 'X' }).success).toBe(false);
  });
});

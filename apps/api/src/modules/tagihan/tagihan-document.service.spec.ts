import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TagihanDocumentService } from '@/modules/tagihan/tagihan-document.service';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const TAGIHAN = {
  id: 7,
  uuid: uuid(700),
  warehouseId: 1,
  documentNumber: 'SDI-001',
  type: 'LOADING',
  totalAmount: 2268000,
  tagihanDate: new Date('2026-10-12T02:00:00Z'),
  warehouse: { name: 'Gudang Landasan Ulin' },
  summaries: [
    { documentType: 'OUT', uom: 'KG', quantity: 84000, costPerUnit: 27, subtotal: 2268000 },
  ],
  documentReferences: [
    {
      documentReference: {
        dateDone: new Date('2026-10-05T02:00:00Z'),
        scheduledDate: null,
        refFax: 'MO/1626/10/2026/16001',
        items: [{ productName: 'BERAS MEDIUM', uom: 'KG' }],
      },
    },
  ],
};

const TEMPLATE = (purpose: string, extra: Partial<any> = {}) => ({
  id: 3,
  uuid: uuid(300),
  code: 'TT',
  name: 'Tanda Terima',
  description: null,
  version: 2,
  categoryId: 1,
  warehouseId: 1,
  tagihanType: null,
  tagihanPurpose: purpose,
  placeholderSchema: [
    { key: 'nomor_surat' },
    { key: 'catatan' },
    { key: 'buruh' },
    { key: 'buruh.nama' },
  ],
  ...extra,
});

function setup(opts: { running?: boolean; buruhs?: any[]; tagihan?: any; template?: any } = {}) {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    documentGenerated: {
      findFirst: jest.fn().mockResolvedValue(opts.running ? { id: 99 } : null),
    },
  };
  const prisma: any = {
    tagihan: { findFirst: jest.fn().mockResolvedValue(opts.tagihan ?? TAGIHAN) },
    buruh: {
      findMany: jest.fn().mockResolvedValue(
        opts.buruhs ?? [
          { uuid: uuid(1), name: 'AGUS HERMAN', isMandor: true },
          { uuid: uuid(2), name: 'JUHRANI', isMandor: false },
        ],
      ),
    },
    documentTemplate: {
      findMany: jest.fn().mockResolvedValue([opts.template ?? TEMPLATE('TANDA_TERIMA')]),
    },
    documentGenerated: {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((cb: any) => cb(tx)),
  };
  const documentGeneration: any = {
    createGenerationRecord: jest
      .fn()
      .mockResolvedValue({ id: 50, uuid: uuid(50), status: 'PROCESSING' }),
    enqueueGeneration: jest.fn().mockResolvedValue(undefined),
  };
  const service = new TagihanDocumentService(prisma, {} as any, documentGeneration);
  return { service, prisma, tx, documentGeneration };
}

const ttBody = (amounts: [number, number]) => ({
  recipients: [
    { buruhUuid: uuid(1), amount: amounts[0] },
    { buruhUuid: uuid(2), amount: amounts[1] },
  ],
  remainderBuruhUuid: uuid(1),
  values: {},
});

describe('TagihanDocumentService.generateTandaTerima', () => {
  it('enqueues with per-row values, totals and the mandor', async () => {
    const { service, documentGeneration, tx } = setup();
    const result = await service.generateTandaTerima(
      1,
      TAGIHAN.uuid,
      ttBody([1134000, 1134000]),
      10,
      'Asia/Makassar',
    );

    expect(result).toEqual({ uuid: uuid(50), status: 'PROCESSING' });
    expect(tx.$executeRaw).toHaveBeenCalled();
    const job = documentGeneration.enqueueGeneration.mock.calls[0][0];
    expect(job.placeholder.buruh).toEqual([
      { no: 1, nama: 'AGUS HERMAN', penyaluran: '1.134.000', diterima: '1.134.000', ganjil: true },
      { no: 2, nama: 'JUHRANI', penyaluran: '1.134.000', diterima: '1.134.000', ganjil: false },
    ]);
    expect(job.placeholder.total_upah).toBe('2.268.000');
    expect(job.placeholder.tonase).toBe('84.000');
    expect(job.placeholder.upah_per_kg).toBe('27');
    expect(job.placeholder.mandor).toBe('AGUS HERMAN');
    expect(job.tagihanAttachment).toMatchObject({ tagihanId: 7, fileType: 'TANDA_TERIMA' });
  });

  it('lists rows in the Buruh Management order, not the submitted order', async () => {
    const { service, prisma, documentGeneration } = setup({
      buruhs: [
        { uuid: uuid(2), name: 'JUHRANI', isMandor: false },
        { uuid: uuid(1), name: 'AGUS HERMAN', isMandor: true },
      ],
    });
    await service.generateTandaTerima(1, TAGIHAN.uuid, ttBody([1134100, 1133900]), 10, 'UTC');

    expect(prisma.buruh.findMany.mock.calls[0][0].orderBy).toEqual([
      { sortOrder: 'asc' },
      { name: 'asc' },
      { id: 'asc' },
    ]);
    const job = documentGeneration.enqueueGeneration.mock.calls[0][0];
    expect(job.placeholder.buruh.map((r: any) => [r.no, r.nama, r.penyaluran])).toEqual([
      [1, 'JUHRANI', '1.133.900'],
      [2, 'AGUS HERMAN', '1.134.100'],
    ]);
  });

  it('rejects allocations that do not sum to the Tagihan total', async () => {
    const { service, documentGeneration } = setup();
    await expect(
      service.generateTandaTerima(1, TAGIHAN.uuid, ttBody([1134000, 1133900]), 10, 'UTC'),
    ).rejects.toThrow(/selisih Rp -100/);
    expect(documentGeneration.createGenerationRecord).not.toHaveBeenCalled();
  });

  it('rejects buruh that are not active in this warehouse', async () => {
    const { service } = setup({ buruhs: [{ uuid: uuid(1), name: 'AGUS HERMAN', isMandor: true }] });
    await expect(
      service.generateTandaTerima(1, TAGIHAN.uuid, ttBody([1134000, 1134000]), 10, 'UTC'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a Tagihan with a zero total', async () => {
    const { service } = setup({ tagihan: { ...TAGIHAN, totalAmount: 0 } });
    await expect(
      service.generateTandaTerima(1, TAGIHAN.uuid, ttBody([0, 0]), 10, 'UTC'),
    ).rejects.toThrow(/Rp 0/);
  });

  it('blocks a concurrent generation for the same Tagihan and purpose', async () => {
    const { service, documentGeneration } = setup({ running: true });
    await expect(
      service.generateTandaTerima(1, TAGIHAN.uuid, ttBody([1134000, 1134000]), 10, 'UTC'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(documentGeneration.createGenerationRecord).not.toHaveBeenCalled();
  });

  it('marks the record FAILED when enqueueing fails', async () => {
    const { service, prisma, documentGeneration } = setup();
    documentGeneration.enqueueGeneration.mockRejectedValue(new Error('redis down'));
    await expect(
      service.generateTandaTerima(1, TAGIHAN.uuid, ttBody([1134000, 1134000]), 10, 'UTC'),
    ).rejects.toThrow('redis down');
    expect(prisma.documentGenerated.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });
});

describe('TagihanDocumentService.generateSuratPermohonan', () => {
  it('keeps derived values locked and accepts editable and custom keys', async () => {
    const { service, documentGeneration } = setup({ template: TEMPLATE('SURAT_PERMOHONAN') });
    await service.generateSuratPermohonan(
      1,
      TAGIHAN.uuid,
      {
        templateUuid: uuid(300),
        values: {
          nomor_surat: ' 045/BLG/X/2026 ',
          periode: 'Oktober 2026 (revisi)',
          total: '1',
          terbilang: 'nol',
          catatan: 'Mohon segera diproses',
          tidak_ada: 'ignored',
        },
      },
      10,
      'Asia/Makassar',
    );

    const job = documentGeneration.enqueueGeneration.mock.calls[0][0];
    expect(job.placeholder.nomor_surat).toBe('045/BLG/X/2026');
    expect(job.placeholder.periode).toBe('Oktober 2026 (revisi)');
    expect(job.placeholder.total).toBe('2.268.000');
    expect(job.placeholder.terbilang).toBe('Dua Juta Dua Ratus Enam Puluh Delapan Ribu Rupiah');
    expect(job.placeholder.catatan).toBe('Mohon segera diproses');
    expect(job.placeholder.tidak_ada).toBeUndefined();
    expect(documentGeneration.createGenerationRecord.mock.calls[0][1].documentNumber).toBe(
      '045/BLG/X/2026',
    );
  });

  it('fills an existing upper-case template through aliases', async () => {
    const legacy = TEMPLATE('SURAT_PERMOHONAN', {
      placeholderSchema: ['SDIP', 'TANGGAL', 'MO', 'KUANTUM', 'NOMINAL', 'TERBILANG', 'TUJUAN'].map((key) => ({ key })),
    });
    const { service, documentGeneration } = setup({ template: legacy });
    await service.generateSuratPermohonan(
      1,
      TAGIHAN.uuid,
      {
        templateUuid: uuid(300),
        values: { nomor_surat: '045/X/2026', TANGGAL: '20 Oktober 2026', NOMINAL: '1', TUJUAN: 'Kanwil' },
      },
      10,
      'Asia/Makassar',
    );

    const job = documentGeneration.enqueueGeneration.mock.calls[0][0];
    expect(job.placeholder).toMatchObject({
      SDIP: 'SDI-001',
      MO: 'MO/1626/10/2026/16001',
      KUANTUM: '84.000',
      // TANGGAL is editable (tanggal_surat); NOMINAL is derived (total) and stays locked
      TANGGAL: '20 Oktober 2026',
      NOMINAL: '2.268.000',
      TERBILANG: 'Dua Juta Dua Ratus Enam Puluh Delapan Ribu Rupiah',
      TUJUAN: 'Kanwil',
    });
  });

  it('rejects a template that is not available for this Tagihan', async () => {
    const { service } = setup({ template: TEMPLATE('SURAT_PERMOHONAN') });
    await expect(
      service.generateSuratPermohonan(
        1,
        TAGIHAN.uuid,
        { templateUuid: uuid(301), values: { nomor_surat: '1' } },
        10,
        'UTC',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

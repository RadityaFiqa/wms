import {
  groupBanpangRealization,
  NO_DESTINATION,
  NO_SALES_ORDER,
  normalizePickingRef,
  placementKey,
  type BanpangDocumentRow,
} from '@/modules/reports/banpang-realization.utils';

const rice = (qty: number) => ({
  productUuid: 'p-rice',
  sku: 'B0010152Z',
  name: 'BERAS MEDIUM 10 KG',
  uom: 'Pack 10 KG',
  qty,
});

const doc = (
  documentNumber: string,
  origin: string | null,
  pickingRef: string | null,
  date: string,
  items: BanpangDocumentRow['items'],
  state = 'done',
): BanpangDocumentRow => ({
  uuid: `uuid-${documentNumber}`,
  documentNumber,
  state,
  origin,
  pickingRef,
  date: new Date(date),
  items,
});

describe('groupBanpangRealization', () => {
  const rows = [
    doc('OUT/1', 'SO/1', 'KEC LANDASAN ULIN', '2026-11-01T02:00:00Z', [
      rice(100),
    ]),
    doc('OUT/2', 'SO/1', 'KEC LANDASAN ULIN', '2026-11-03T02:00:00Z', [
      rice(50),
    ]),
    doc('OUT/3', 'SO/1', 'KEC BANJARBARU UTARA', '2026-11-02T02:00:00Z', [
      rice(300),
    ]),
    doc('OUT/4', 'SO/2', null, '2026-11-05T02:00:00Z', [
      rice(10),
      {
        productUuid: 'p-sheet',
        sku: 'L001',
        name: 'KARUNG',
        uom: 'Lembar',
        qty: 5,
      },
    ]),
  ];

  it('makes one row per kecamatan + sales order, with its summary', () => {
    const res = groupBanpangRealization(rows);

    expect(res.totals).toMatchObject({
      documentCount: 4,
      kg: 4600,
      salesOrderCount: 2,
      destinationCount: 3,
      pendingDocumentCount: 0,
      firstDate: '2026-11-01T02:00:00.000Z',
      lastDate: '2026-11-05T02:00:00.000Z',
    });

    // Without folders everything is in the single ungrouped group
    expect(res.groups).toHaveLength(1);
    const [ungrouped] = res.groups;
    expect(ungrouped.folder).toBeNull();
    expect(ungrouped.summary).toMatchObject({
      rowCount: 3,
      salesOrderCount: 2,
      destinationCount: 3,
    });

    // Latest document first; one SO split over two kecamatan gives two rows
    expect(
      ungrouped.rows.map((r) => [r.destination, r.soNumber, r.summary.kg]),
    ).toEqual([
      [NO_DESTINATION, 'SO/2', 100],
      ['KEC LANDASAN ULIN', 'SO/1', 1500],
      ['KEC BANJARBARU UTARA', 'SO/1', 3000],
    ]);

    const landasan = ungrouped.rows[1];
    expect(landasan.summary).toMatchObject({
      documentCount: 2,
      firstDate: '2026-11-01T02:00:00.000Z',
      lastDate: '2026-11-03T02:00:00.000Z',
    });
    expect(landasan.summary.products).toEqual([{ ...rice(150), kg: 1500 }]);
    // Documents newest first
    expect(landasan.documents.map((d) => d.documentNumber)).toEqual([
      'OUT/2',
      'OUT/1',
    ]);
  });

  it('keeps non-weight products out of Kg and labels missing values', () => {
    const res = groupBanpangRealization([
      ...rows,
      doc('OUT/5', null, 'KEC X', '2026-11-04T02:00:00Z', [rice(1)]),
    ]);
    const all = res.groups[0].rows;
    const so2 = all.find((r) => r.soNumber === 'SO/2')!;
    expect(so2.destination).toBe(NO_DESTINATION);
    expect(so2.summary.kg).toBe(100);
    expect(so2.summary.products).toEqual([
      { ...rice(10), kg: 100 },
      {
        productUuid: 'p-sheet',
        sku: 'L001',
        name: 'KARUNG',
        uom: 'Lembar',
        qty: 5,
        kg: null,
      },
    ]);
    expect(all.find((r) => r.destination === 'KEC X')?.soNumber).toBe(
      NO_SALES_ORDER,
    );
  });

  it('counts documents not done yet, on their scheduled date', () => {
    const res = groupBanpangRealization([
      ...rows,
      doc(
        'OUT/6',
        'SO/3',
        'KEC X',
        '2026-11-08T00:00:00Z',
        [rice(20)],
        'assigned',
      ),
    ]);
    expect(res.totals).toMatchObject({
      documentCount: 5,
      kg: 4800,
      pendingDocumentCount: 1,
      pendingKg: 200,
      lastDate: '2026-11-08T00:00:00.000Z',
    });
    const row = res.groups[0].rows[0];
    expect([row.destination, row.soNumber]).toEqual(['KEC X', 'SO/3']);
    expect(row.summary).toMatchObject({
      pendingDocumentCount: 1,
      pendingKg: 200,
    });
    expect(row.documents[0]).toMatchObject({
      state: 'assigned',
      date: '2026-11-08T00:00:00.000Z',
      kg: 200,
    });
  });

  it('splits rows over folders by kecamatan + sales order, keeping empty folders', () => {
    const kabBanjar = { uuid: 'f-1', name: 'KAB.BANJAR' };
    const banjarbaru = { uuid: 'f-2', name: 'BANJARBARU' };
    const empty = { uuid: 'f-3', name: 'KAB TANAH LAUT' };
    const res = groupBanpangRealization(rows, {
      folders: [kabBanjar, banjarbaru, empty],
      placements: new Map([
        // The two kecamatan of SO/1 go to different folders
        [placementKey('SO/1', 'KEC LANDASAN ULIN'), 'f-1'],
        [placementKey('SO/1', 'KEC BANJARBARU UTARA'), 'f-2'],
        // Placement in a folder that no longer exists counts as ungrouped
        [placementKey('SO/2', NO_DESTINATION), 'f-deleted'],
      ]),
    });

    expect(res.groups.map((g) => g.folder?.name ?? null)).toEqual([
      'KAB.BANJAR',
      'BANJARBARU',
      'KAB TANAH LAUT',
      null,
    ]);
    const [g1, g2, g3, ungrouped] = res.groups;
    expect(g1.rows.map((r) => r.destination)).toEqual(['KEC LANDASAN ULIN']);
    expect(g1.summary).toMatchObject({
      rowCount: 1,
      salesOrderCount: 1,
      destinationCount: 1,
      documentCount: 2,
      kg: 1500,
      sharePct: 32.609,
    });
    expect(g2.rows.map((r) => r.destination)).toEqual(['KEC BANJARBARU UTARA']);
    expect(g2.summary.sharePct).toBe(65.217);
    expect(g3.rows).toEqual([]);
    expect(g3.summary).toMatchObject({ rowCount: 0, kg: 0, sharePct: 0 });
    expect(ungrouped.rows.map((r) => r.soNumber)).toEqual(['SO/2']);
    // Totals stay over everything
    expect(res.totals.kg).toBe(4600);
  });

  it('returns empty totals without documents', () => {
    const empty = {
      documentCount: 0,
      kg: 0,
      pendingDocumentCount: 0,
      pendingKg: 0,
      products: [],
      firstDate: null,
      lastDate: null,
    };
    expect(groupBanpangRealization([])).toEqual({
      totals: { ...empty, salesOrderCount: 0, destinationCount: 0 },
      groups: [
        {
          folder: null,
          summary: {
            ...empty,
            rowCount: 0,
            salesOrderCount: 0,
            destinationCount: 0,
            sharePct: 0,
          },
          rows: [],
        },
      ],
    });
  });
});

describe('normalizePickingRef', () => {
  it('keeps trimmed text and drops the Odoo false', () => {
    expect(normalizePickingRef('  KEC LANDASAN ULIN ')).toBe(
      'KEC LANDASAN ULIN',
    );
    expect(normalizePickingRef(false)).toBeNull();
    expect(normalizePickingRef(null)).toBeNull();
    expect(normalizePickingRef('   ')).toBeNull();
  });
});

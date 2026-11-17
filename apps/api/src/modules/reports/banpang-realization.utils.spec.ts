import {
  groupBanpangRealization,
  NO_DESTINATION,
  NO_SALES_ORDER,
  normalizePickingRef,
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
  dateDone: string,
  items: BanpangDocumentRow['items'],
): BanpangDocumentRow => ({
  uuid: `uuid-${documentNumber}`,
  documentNumber,
  origin,
  pickingRef,
  dateDone: new Date(dateDone),
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

  it('groups by sales order, then destination, with summaries', () => {
    const res = groupBanpangRealization(rows);

    expect(res.totals).toMatchObject({
      documentCount: 4,
      kg: 4600,
      salesOrderCount: 2,
      destinationCount: 3,
      firstDoneAt: '2026-11-01T02:00:00.000Z',
      lastDoneAt: '2026-11-05T02:00:00.000Z',
    });

    // Without folders everything is in the single ungrouped group
    expect(res.groups).toHaveLength(1);
    expect(res.groups[0].folder).toBeNull();
    const salesOrders = res.groups[0].salesOrders;

    // Latest realization first
    expect(salesOrders.map((so) => so.soNumber)).toEqual(['SO/2', 'SO/1']);

    const so1 = salesOrders[1];
    expect(so1.summary).toMatchObject({
      documentCount: 3,
      kg: 4500,
      destinationCount: 2,
      firstDoneAt: '2026-11-01T02:00:00.000Z',
      lastDoneAt: '2026-11-03T02:00:00.000Z',
    });
    expect(so1.summary.products).toEqual([{ ...rice(450), kg: 4500 }]);

    // Destinations by Kg, documents newest first
    expect(so1.destinations.map((d) => [d.name, d.summary.kg])).toEqual([
      ['KEC BANJARBARU UTARA', 3000],
      ['KEC LANDASAN ULIN', 1500],
    ]);
    expect(so1.destinations[1].documents.map((d) => d.documentNumber)).toEqual([
      'OUT/2',
      'OUT/1',
    ]);
  });

  it('keeps non-weight products out of Kg and labels missing values', () => {
    const res = groupBanpangRealization([
      ...rows,
      doc('OUT/5', null, 'KEC X', '2026-11-04T02:00:00Z', [rice(1)]),
    ]);
    const salesOrders = res.groups[0].salesOrders;
    const so2 = salesOrders.find((so) => so.soNumber === 'SO/2')!;
    expect(so2.destinations[0].name).toBe(NO_DESTINATION);
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
    expect(salesOrders.map((so) => so.soNumber)).toContain(NO_SALES_ORDER);
  });

  it('splits sales orders over folders, keeping empty folders', () => {
    const tahap1 = { uuid: 'f-1', name: 'Tahap 1' };
    const tahap2 = { uuid: 'f-2', name: 'Tahap 2' };
    const res = groupBanpangRealization(rows, {
      folders: [tahap1, tahap2],
      placements: new Map([
        ['SO/1', 'f-1'],
        // Placement in a folder that no longer exists counts as ungrouped
        ['SO/2', 'f-deleted'],
      ]),
    });

    expect(res.groups.map((g) => g.folder?.name ?? null)).toEqual([
      'Tahap 1',
      'Tahap 2',
      null,
    ]);
    const [g1, g2, ungrouped] = res.groups;
    expect(g1.salesOrders.map((so) => so.soNumber)).toEqual(['SO/1']);
    expect(g1.summary).toMatchObject({
      salesOrderCount: 1,
      destinationCount: 2,
      documentCount: 3,
      kg: 4500,
      sharePct: 97.826,
    });
    expect(g2.salesOrders).toEqual([]);
    expect(g2.summary).toMatchObject({
      salesOrderCount: 0,
      kg: 0,
      sharePct: 0,
    });
    expect(ungrouped.salesOrders.map((so) => so.soNumber)).toEqual(['SO/2']);
    // Totals stay over everything
    expect(res.totals.kg).toBe(4600);
  });

  it('returns empty totals without documents', () => {
    expect(groupBanpangRealization([])).toEqual({
      totals: {
        documentCount: 0,
        kg: 0,
        products: [],
        firstDoneAt: null,
        lastDoneAt: null,
        salesOrderCount: 0,
        destinationCount: 0,
      },
      groups: [
        {
          folder: null,
          summary: {
            documentCount: 0,
            kg: 0,
            products: [],
            firstDoneAt: null,
            lastDoneAt: null,
            salesOrderCount: 0,
            destinationCount: 0,
            sharePct: 0,
          },
          salesOrders: [],
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

import type { InboundSender } from '@bulog-wms/schema';
import {
  groupSendersByFolder,
  placementKey,
  resolveFolderId,
} from '@/modules/reports/stock-folder.utils';

const doc = (dateDone: string) => ({
  documentUuid: dateDone,
  documentNumber: `IN/${dateDone}`,
  dateDone,
});

const senders: InboundSender[] = [
  {
    name: 'Manager Pengolahan Kalsel',
    originCategory: 'Pengolahan',
    displayQty: 3000,
    pendingDisplayQty: 0,
    pendingGateCount: 0,
    stacks: [
      {
        locationUuid: 'a01',
        locationName: 'GBB 01/A01.1.1',
        displayQty: 3000,
        lots: [
          {
            lotName: 'LOT-1',
            qty: 200,
            displayQty: 2000,
            documents: [doc('2026-10-19')],
            pendingGate: null,
          },
          {
            lotName: 'LOT-2',
            qty: 100,
            displayQty: 1000,
            documents: [doc('2026-10-01')],
            pendingGate: null,
          },
        ],
      },
    ],
  },
  {
    name: 'Badan Pangan Nasional',
    originCategory: 'Lainnya',
    displayQty: 1000,
    pendingDisplayQty: 0,
    pendingGateCount: 0,
    stacks: [
      {
        locationUuid: 'a02',
        locationName: 'GBB 01/A02.1.1',
        displayQty: 1000,
        lots: [
          {
            lotName: 'LOT-3',
            qty: 100,
            displayQty: 1000,
            documents: [],
            pendingGate: null,
          },
        ],
      },
    ],
  },
];

const folders = [
  { id: 1, uuid: 'f1', name: 'HGL KALSEL' },
  { id: 2, uuid: 'f2', name: 'KOSONG' },
];

describe('resolveFolderId', () => {
  it('uses the lot placement first, then the sender placement', () => {
    const placements = new Map<string, number | null>([
      [placementKey('S', null), 1],
      [placementKey('S', 'LOT-2'), null],
      [placementKey('S', 'LOT-3'), 2],
    ]);
    expect(resolveFolderId(placements, 'S', 'LOT-1')).toBe(1);
    expect(resolveFolderId(placements, 'S', 'LOT-2')).toBeNull();
    expect(resolveFolderId(placements, 'S', 'LOT-3')).toBe(2);
    expect(resolveFolderId(placements, 'S', null)).toBe(1);
    expect(resolveFolderId(placements, 'Other', 'LOT-1')).toBeNull();
  });
});

describe('groupSendersByFolder', () => {
  it('splits a sender over folders by lot and summarises each folder', () => {
    const placements = new Map<string, number | null>([
      [placementKey('Manager Pengolahan Kalsel', null), 1],
      [placementKey('Manager Pengolahan Kalsel', 'LOT-2'), null],
    ]);
    const groups = groupSendersByFolder(senders, folders, placements, 4000);

    expect(groups.map((g) => g.folder?.name ?? null)).toEqual([
      'HGL KALSEL',
      'KOSONG',
      null,
    ]);

    const [hgl, empty, rest] = groups;
    expect(hgl.summary).toEqual({
      displayQty: 2000,
      sharePct: 50,
      senderCount: 1,
      stackCount: 1,
      lotCount: 1,
      lastReceivedAt: '2026-10-19',
      pendingDisplayQty: 0,
      pendingGateCount: 0,
    });
    expect(hgl.senders[0].stacks[0].lots.map((l) => l.lotName)).toEqual([
      'LOT-1',
    ]);

    expect(empty.senders).toEqual([]);
    expect(empty.summary.displayQty).toBe(0);

    expect(rest.senders.map((s) => s.name)).toEqual([
      'Manager Pengolahan Kalsel',
      'Badan Pangan Nasional',
    ]);
    expect(rest.summary.displayQty).toBe(2000);
    expect(rest.summary.lotCount).toBe(2);
    expect(rest.summary.senderCount).toBe(2);
  });

  it('ignores placements pointing at a folder that no longer exists', () => {
    const placements = new Map<string, number | null>([
      [placementKey('Badan Pangan Nasional', null), 99],
    ]);
    const groups = groupSendersByFolder(senders, [], placements, 4000);
    expect(groups).toHaveLength(1);
    expect(groups[0].folder).toBeNull();
    expect(groups[0].summary.sharePct).toBe(100);
  });

  it('keeps gate lines not yet administered out of the lot count', () => {
    const withPending: InboundSender[] = [
      {
        ...senders[1],
        displayQty: 2400,
        stacks: [
          {
            ...senders[1].stacks[0],
            displayQty: 2400,
            lots: [
              ...senders[1].stacks[0].lots,
              {
                lotName: null,
                qty: 140,
                displayQty: 1400,
                documents: [],
                pendingGate: {
                  gateOperationUuid: 'g1',
                  opNumber: 'IN-000001/16/11/2026',
                  cardType: 'IN',
                  date: '2026-11-16T00:00:00.000Z',
                },
              },
            ],
          },
        ],
      },
    ];
    const [group] = groupSendersByFolder(withPending, [], new Map(), 2400);
    expect(group.summary.displayQty).toBe(2400);
    expect(group.summary.lotCount).toBe(1);
    expect(group.summary.lastReceivedAt).toBe('2026-11-16T00:00:00.000Z');
    expect(group.summary.pendingDisplayQty).toBe(1400);
    expect(group.summary.pendingGateCount).toBe(1);
    expect(group.senders[0].pendingDisplayQty).toBe(1400);
    expect(group.senders[0].pendingGateCount).toBe(1);
  });
});

import {
  classifyLocationMovement,
  sameCalculationRows,
  type MovementCurrentStack,
  type MovementPreviousStack,
} from '@/modules/inventory/stock-opname-movement';

const beras: MovementCurrentStack = {
  inventoryId: 1,
  productSku: 'BRS-01',
  productName: 'Beras Medium',
  erpQty: 1000,
  calculatedPhysical: 1000,
};
const gula: MovementCurrentStack = {
  inventoryId: 2,
  productSku: 'GL-01',
  productName: 'Gula Pasir',
  erpQty: 200,
  calculatedPhysical: 200,
};

const counted = (
  stack: MovementCurrentStack,
  values: Partial<MovementPreviousStack> = {},
): MovementPreviousStack => ({
  ...stack,
  actualQty: stack.erpQty,
  calculationRows: [{ expression: '20x50', result: 1000 }],
  note: 'Tumpukan rapi',
  ...values,
});

describe('classifyLocationMovement', () => {
  it('compares nothing when there is no previous completed opname', () => {
    const res = classifyLocationMovement({
      hasPreviousOpname: false,
      current: [beras],
      previous: [],
      movementReferences: [],
    });
    expect(res).toEqual({ status: null, reasons: [], prefill: null });
  });

  it('prefills an unmoved tumpukan with the previous rows and note', () => {
    const res = classifyLocationMovement({
      hasPreviousOpname: true,
      current: [beras],
      previous: [counted(beras)],
      movementReferences: [],
    });
    expect(res.status).toBe('UNCHANGED');
    expect(res.reasons).toEqual([]);
    expect(res.prefill?.get(beras.inventoryId)).toEqual({
      actualQty: 1000,
      calculationRows: [{ expression: '20x50', result: 1000 }],
      note: 'Tumpukan rapi',
    });
  });

  it('treats quantities equal after rounding as unmoved', () => {
    const res = classifyLocationMovement({
      hasPreviousOpname: true,
      current: [{ ...beras, erpQty: 1000.0000001 }],
      previous: [counted(beras)],
      movementReferences: [],
    });
    expect(res.status).toBe('UNCHANGED');
  });

  it('marks a tumpukan with a recorded mutation as changed, even at the same qty', () => {
    const res = classifyLocationMovement({
      hasPreviousOpname: true,
      current: [beras],
      previous: [counted(beras)],
      movementReferences: ['GO-0001', 'WH/IN/0005', 'GO-0001'],
    });
    expect(res.status).toBe('CHANGED');
    expect(res.prefill).toBeNull();
    expect(res.reasons).toEqual([
      'Ada mutasi sejak opname terakhir: GO-0001, WH/IN/0005',
    ]);
  });

  it('lists at most five references', () => {
    const res = classifyLocationMovement({
      hasPreviousOpname: true,
      current: [beras],
      previous: [counted(beras)],
      movementReferences: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    });
    expect(res.reasons[0]).toBe(
      'Ada mutasi sejak opname terakhir: A, B, C, D, E dan 2 lainnya',
    );
  });

  it('marks a changed ERP qty as changed', () => {
    const res = classifyLocationMovement({
      hasPreviousOpname: true,
      current: [{ ...beras, erpQty: 800 }],
      previous: [counted(beras)],
      movementReferences: [],
    });
    expect(res.status).toBe('CHANGED');
    expect(res.reasons).toHaveLength(1);
    expect(res.reasons[0]).toContain('BRS-01: stok ERP');
  });

  it('marks a changed reconciled qty as changed', () => {
    const res = classifyLocationMovement({
      hasPreviousOpname: true,
      current: [{ ...beras, calculatedPhysical: 950 }],
      previous: [counted(beras)],
      movementReferences: [],
    });
    expect(res.status).toBe('CHANGED');
    expect(res.reasons[0]).toContain('BRS-01: stok rekonsiliasi');
  });

  it('marks a new tumpukan as changed', () => {
    const res = classifyLocationMovement({
      hasPreviousOpname: true,
      current: [beras],
      previous: [],
      movementReferences: [],
    });
    expect(res.status).toBe('CHANGED');
    expect(res.reasons).toEqual(['Tumpukan baru sejak opname terakhir']);
  });

  it('marks an added or removed SKU as changed', () => {
    const added = classifyLocationMovement({
      hasPreviousOpname: true,
      current: [beras, gula],
      previous: [counted(beras)],
      movementReferences: [],
    });
    expect(added.status).toBe('CHANGED');
    expect(added.reasons).toEqual(['GL-01: SKU baru di tumpukan']);

    const removed = classifyLocationMovement({
      hasPreviousOpname: true,
      current: [beras],
      previous: [counted(beras), counted(gula, { actualQty: 0 })],
      movementReferences: [],
    });
    expect(removed.status).toBe('CHANGED');
    expect(removed.reasons).toEqual(['GL-01: tidak ada lagi di tumpukan']);
  });

  it('ignores zero-stock stacks when comparing', () => {
    const res = classifyLocationMovement({
      hasPreviousOpname: true,
      current: [beras, { ...gula, erpQty: 0, calculatedPhysical: 0 }],
      previous: [counted(beras)],
      movementReferences: [],
    });
    expect(res.status).toBe('UNCHANGED');
  });

  it('puts the merged tumpukan count on the first SKU by name, 0 on the others', () => {
    const res = classifyLocationMovement({
      hasPreviousOpname: true,
      current: [gula, beras],
      previous: [
        counted(beras, {
          actualQty: 1150,
          calculationRows: [{ expression: '23x50', result: 1150 }],
        }),
        counted(gula, { actualQty: 0, calculationRows: null, note: null }),
      ],
      movementReferences: [],
    });
    expect(res.status).toBe('UNCHANGED');
    expect(res.prefill?.get(beras.inventoryId)).toEqual({
      actualQty: 1150,
      calculationRows: [{ expression: '23x50', result: 1150 }],
      note: 'Tumpukan rapi',
    });
    expect(res.prefill?.get(gula.inventoryId)).toEqual({
      actualQty: 0,
      calculationRows: null,
      note: null,
    });
  });

  it('turns a legacy count without calculator rows into a row', () => {
    const res = classifyLocationMovement({
      hasPreviousOpname: true,
      current: [beras],
      previous: [
        counted(beras, { actualQty: 990, calculationRows: null, note: null }),
      ],
      movementReferences: [],
    });
    expect(res.prefill?.get(beras.inventoryId)).toEqual({
      actualQty: 990,
      calculationRows: [{ expression: '990', result: 990 }],
      note: null,
    });
  });

  it('prefills nothing when the unmoved tumpukan was not counted last time', () => {
    const res = classifyLocationMovement({
      hasPreviousOpname: true,
      current: [beras],
      previous: [
        counted(beras, { actualQty: null, calculationRows: null, note: null }),
      ],
      movementReferences: [],
    });
    expect(res.status).toBe('UNCHANGED');
    expect(res.prefill).toBeNull();
  });

  it('prefills only the note when the tumpukan was noted but not counted', () => {
    const res = classifyLocationMovement({
      hasPreviousOpname: true,
      current: [beras],
      previous: [counted(beras, { actualQty: null, calculationRows: null })],
      movementReferences: [],
    });
    expect(res.prefill?.get(beras.inventoryId)).toEqual({
      actualQty: null,
      calculationRows: null,
      note: 'Tumpukan rapi',
    });
  });
});

describe('sameCalculationRows', () => {
  it('treats null and empty as equal', () => {
    expect(sameCalculationRows(null, [])).toBe(true);
  });

  it('compares expressions and rounded results in order', () => {
    const rows = [
      { expression: '20x50', result: 1000 },
      { expression: '5', result: 5 },
    ];
    expect(sameCalculationRows(rows, [...rows])).toBe(true);
    expect(sameCalculationRows(rows, [...rows].reverse())).toBe(false);
    expect(
      sameCalculationRows(rows, [{ expression: '20x50', result: 1000 }]),
    ).toBe(false);
  });
});

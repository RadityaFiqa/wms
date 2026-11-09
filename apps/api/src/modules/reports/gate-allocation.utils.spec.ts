import { matchGateProductsToStacks } from '@/modules/reports/gate-allocation.utils';

const B01 = 1;
const B02 = 2;
const C03 = 3;

const stack = (locationId: number, qty: number) => ({
  locationId,
  qty,
  referenceDocument: `DOC (PICK-${locationId})`,
});

const qtyByLocation = (allocations: { locationId: number; qty: number }[]) =>
  Object.fromEntries(allocations.map((a) => [a.locationId, a.qty]));

describe('matchGateProductsToStacks', () => {
  it('keeps the gate stack first and moves only the rest (no fractional split)', () => {
    // Gate: 370 @B01 + 30 @B02, ERP picked 270 @B01 + 130 @B02
    const result = matchGateProductsToStacks(
      [
        { id: 10, quantity: 30, locationId: B02 },
        { id: 11, quantity: 370, locationId: B01 },
      ],
      [stack(B02, 130), stack(B01, 270)],
    );

    expect(qtyByLocation(result.byProductId.get(10)!)).toEqual({ [B02]: 30 });
    expect(qtyByLocation(result.byProductId.get(11)!)).toEqual({
      [B01]: 270,
      [B02]: 100,
    });
    expect(result.uncovered.size).toBe(0);
    expect(result.overflow.size).toBe(0);
  });

  it('uses the stack from the move lines when the gate stack is not in them', () => {
    const result = matchGateProductsToStacks(
      [{ id: 1, quantity: 400, locationId: C03 }],
      [stack(B02, 400)],
    );

    expect(result.byProductId.get(1)).toEqual([
      { locationId: B02, qty: 400, referenceDocument: 'DOC (PICK-2)' },
    ]);
  });

  it('reports the move line qty not covered by the gate (partial realization)', () => {
    const result = matchGateProductsToStacks(
      [{ id: 1, quantity: 200, locationId: B01 }],
      [stack(B01, 270), stack(B02, 130)],
    );

    expect(qtyByLocation(result.byProductId.get(1)!)).toEqual({ [B01]: 200 });
    expect(Object.fromEntries(result.uncovered)).toEqual({
      [B01]: 70,
      [B02]: 130,
    });
  });

  it('keeps gate qty beyond the move lines on the gate stack as overflow', () => {
    const result = matchGateProductsToStacks(
      [{ id: 1, quantity: 450, locationId: B02 }],
      [stack(B01, 270), stack(B02, 130)],
    );

    expect(qtyByLocation(result.byProductId.get(1)!)).toEqual({
      [B02]: 180,
      [B01]: 270,
    });
    expect(Object.fromEntries(result.overflow)).toEqual({ [B02]: 50 });
  });
});

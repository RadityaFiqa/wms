import { getSecondaryQty } from '@/core/utils/uom';

describe('getSecondaryQty', () => {
  it('prefers the ERP secondary quantity', () => {
    expect(getSecondaryQty(13430, 67150, 'Pack 5 KG')).toEqual({
      unit: 'Kg',
      qty: 67150,
    });
  });

  it('converts from the UoM when the ERP value is missing', () => {
    expect(getSecondaryQty(100, 0, 'Pack 2 L')).toEqual({
      unit: 'L',
      qty: 200,
    });
    expect(getSecondaryQty(10, null, 'Pack 50 KG')).toEqual({
      unit: 'Kg',
      qty: 500,
    });
  });

  it('returns null for units that are neither weight nor volume', () => {
    expect(getSecondaryQty(500, 500, 'Lembar')).toBeNull();
  });
});

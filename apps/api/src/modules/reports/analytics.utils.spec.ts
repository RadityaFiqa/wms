import {
  classifyOrigin,
  cleanPartnerName,
  compareUnitGroups,
  getProductPrograms,
  getUnitGroup,
  isProductProgram,
  getCommodityCategory,
  parseUom,
  toDisplayQty,
} from '@/modules/reports/analytics.utils';

describe('parseUom', () => {
  it.each([
    ['Pack 5 KG', 'Kg', 5],
    ['Pack 50 KG', 'Kg', 50],
    ['Kg.', 'Kg', 1],
    ['Kg', 'Kg', 1],
    ['Pack 350 GR', 'Kg', 0.35],
    ['Pack 1 L', 'L', 1],
    ['Pack 2 L', 'L', 2],
    ['Pack 460 ML', 'L', 0.46],
    ['Lembar', 'OTHER', 0],
    [null, 'OTHER', 0],
  ])('%s → %s × %d', (uom, unit, factor) => {
    const result = parseUom(uom);
    expect(result.unit).toBe(unit);
    expect(result.factor).toBeCloseTo(factor, 6);
  });
});

describe('toDisplayQty', () => {
  it('converts packs to Ton and KL', () => {
    expect(toDisplayQty(13430, 'Pack 5 KG')).toBeCloseTo(67.15, 6);
    expect(toDisplayQty(2000, 'Pack 2 L')).toBeCloseTo(4, 6);
  });

  it('returns null for units that are neither weight nor volume', () => {
    expect(toDisplayQty(500, 'Lembar')).toBeNull();
  });
});

describe('getUnitGroup', () => {
  it('groups weight in Ton, volume in KL and keeps other UoMs as they are', () => {
    const kg = getUnitGroup('Pack 50 KG');
    expect(kg.group.displayUnit).toBe('Ton');
    expect(kg.toDisplay).toBeCloseTo(0.05, 6);

    const l = getUnitGroup('Pack 2 L');
    expect(l.group.displayUnit).toBe('KL');
    expect(l.toDisplay).toBeCloseTo(0.002, 6);

    const sheet = getUnitGroup('Lembar');
    expect(sheet.group).toEqual({
      key: 'Lembar',
      label: 'Lembar',
      baseUnit: 'Lembar',
      displayUnit: 'Lembar',
    });
    expect(sheet.toDisplay).toBe(1);
  });

  it('orders Kg, then L, then other units', () => {
    const keys = [{ key: 'Lembar' }, { key: 'L' }, { key: 'Kg' }]
      .sort(compareUnitGroups)
      .map((g) => g.key);
    expect(keys).toEqual(['Kg', 'L', 'Lembar']);
  });
});

describe('cleanPartnerName', () => {
  it('drops the numeric partner code', () => {
    expect(cleanPartnerName('4755 - Manager Pengolahan Kalsel')).toBe(
      'Manager Pengolahan Kalsel',
    );
    expect(cleanPartnerName('PT Asianagro')).toBe('PT Asianagro');
    expect(cleanPartnerName(null)).toBeNull();
  });
});

describe('getProductPrograms', () => {
  it('finds SPHP and Bantuan Pangan as whole words', () => {
    expect(
      getProductPrograms(
        '[B0010163Z] BERAS MEDIUM HASIL REPROSES LOGO SPHP 5 KG PSO DN',
      ),
    ).toEqual(['SPHP']);
    expect(
      getProductPrograms(
        'BERAS MEDIUM HASIL REPROSES LOGO BANTUAN  PANGAN 10 KG',
      ),
    ).toEqual(['BANTUAN PANGAN']);
    expect(getProductPrograms('BERAS MEDIUM POLOS 50 KG SPHPX')).toEqual([]);
  });

  it('recognises program filter values', () => {
    expect(isProductProgram('sphp')).toBe(true);
    expect(isProductProgram('BERAS')).toBe(false);
  });
});

describe('getCommodityCategory', () => {
  it('takes the first word after the SKU prefix', () => {
    expect(
      getCommodityCategory('[B0010163Z] BERAS MEDIUM HASIL REPROSES 5 KG'),
    ).toBe('BERAS');
    expect(getCommodityCategory('Gula GKP Maniskita 1 KG')).toBe('GULA');
  });
});

describe('classifyOrigin', () => {
  const base = {
    partnerName: null,
    purchaseName: null,
    origin: null,
    sourceLocationName: null,
  };

  it('recognizes processing, procurement and inter-warehouse transfers', () => {
    expect(
      classifyOrigin({
        ...base,
        partnerName: '4755 - Manager Pengolahan Kalsel',
        sourceLocationName: 'Virtual Locations/Inter Company Transit',
      }),
    ).toBe('Pengolahan');
    expect(
      classifyOrigin({
        ...base,
        partnerName: '489786 - PT ASIANAGRO AGUNGJAYA',
        origin: 'PO/2210/10/2026/16001',
        sourceLocationName: 'Partner Locations/Vendors',
      }),
    ).toBe('Pengadaan');
    expect(
      classifyOrigin({
        ...base,
        partnerName: '12192 - Kepala Gudang GBM. B.Kemantren 2',
        sourceLocationName: 'Virtual Locations/Inter Company Transit',
      }),
    ).toBe('Antar gudang');
    expect(classifyOrigin(base)).toBe('Lainnya');
  });
});

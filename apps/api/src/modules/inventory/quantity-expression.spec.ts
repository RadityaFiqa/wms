import {
  evaluateQuantityExpression,
  evaluateQuantityCalculation,
  UpdateStockOpnameSchema,
  QUANTITY_EXPRESSION_MAX_LENGTH,
} from '@bulog-wms/schema';

const value = (expr: string) => {
  const res = evaluateQuantityExpression(expr);
  if (res.status !== 'ok') throw new Error(`${expr} -> ${JSON.stringify(res)}`);
  return res.value;
};

const errorOf = (expr: string) => {
  const res = evaluateQuantityExpression(expr);
  return res.status === 'error' ? res.message : null;
};

describe('evaluateQuantityExpression', () => {
  it.each([
    ['20x2x5', 200],
    ['(20+5)x2', 50],
    ['20x(2+5)', 140],
    ['(10+5)x(2+3)', 75],
    ['((10+5)x2)+5', 35],
    ['100/(2+3)', 20],
    ['5x(10+2)', 60],
    ['10.5x2', 21],
    ['(20x2x5)+5', 205],
    ['10x(5+(2x3))', 110],
    ['20X2*5', 200],
    ['2+3x4', 14],
    ['20-5-3', 12],
    ['100/5/2', 10],
    [' 20 x 2 ', 40],
    ['-5', -5],
    ['10+-5', 5],
    ['5x-2', -10],
    ['-(5+2)x2', -14],
    ['(-5)', -5],
    ['0.1+0.2', 0.3],
    ['100/3', 33.333],
    ['1.0005x1', 1.001],
  ])('%s = %d', (expr, expected) => {
    expect(value(expr)).toBe(expected);
  });

  it('treats blank input as empty', () => {
    expect(evaluateQuantityExpression('')).toEqual({ status: 'empty' });
    expect(evaluateQuantityExpression('   ')).toEqual({ status: 'empty' });
  });

  it.each([
    '20x',
    '(20+5',
    '20/0',
    '10/(5-5)',
    '10++',
    '--5',
    'abc',
    '()',
    '20x()',
    '5(2)',
    '(5))',
    '10,5',
    '1.000.000',
    '10.',
    'x5',
    'alert(1)',
    '2**3',
  ])('rejects %s', (expr) => {
    expect(errorOf(expr)).toEqual(expect.any(String));
  });

  it('returns specific messages for common mistakes', () => {
    expect(errorOf('(20+5')).toBe('Tanda kurung belum ditutup');
    expect(errorOf('20/0')).toBe('Pembagian dengan nol');
    expect(errorOf('()')).toBe('Tanda kurung kosong');
    expect(errorOf('20x')).toBe('Ekspresi tidak lengkap');
    expect(errorOf('abc')).toBe('Karakter tidak didukung: "a"');
  });

  it('rejects overly long and overly nested input', () => {
    expect(
      errorOf('1+'.repeat(QUANTITY_EXPRESSION_MAX_LENGTH) + '1'),
    ).not.toBeNull();
    expect(errorOf('('.repeat(40) + '1' + ')'.repeat(40))).not.toBeNull();
  });
});

describe('evaluateQuantityCalculation', () => {
  it('sums valid rows', () => {
    const res = evaluateQuantityCalculation(['(20+5)x2', '5x(10+2)', '10']);
    expect(res.total).toBe(120);
    expect(res.hasError).toBe(false);
  });

  it('ignores blank rows and excludes invalid rows from the total', () => {
    const res = evaluateQuantityCalculation(['20x2x5', '', '5', '20x']);
    expect(res.total).toBe(205);
    expect(res.hasError).toBe(true);
    expect(res.rows[1]).toEqual({ status: 'empty' });
  });

  it('returns null total when every row is blank', () => {
    expect(evaluateQuantityCalculation(['', ' ']).total).toBeNull();
    expect(evaluateQuantityCalculation([]).total).toBeNull();
  });
});

describe('UpdateStockOpnameSchema', () => {
  const uuid = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b';

  it('accepts valid calculation rows', () => {
    const parsed = UpdateStockOpnameSchema.parse({
      stacks: [{ uuid, actualQty: 205, calculationRows: ['20x2x5', '5'] }],
    });
    expect(parsed.stacks?.[0].calculationRows).toEqual(['20x2x5', '5']);
  });

  it('accepts legacy payloads without calculation rows', () => {
    expect(() =>
      UpdateStockOpnameSchema.parse({ stacks: [{ uuid, actualQty: null }] }),
    ).not.toThrow();
  });

  it('rejects invalid expressions', () => {
    expect(() =>
      UpdateStockOpnameSchema.parse({
        stacks: [{ uuid, actualQty: 1, calculationRows: ['20/0'] }],
      }),
    ).toThrow();
  });
});

import {
  listPeriods,
  periodStart,
  shiftMonth,
} from '@/modules/reports/analytics-periods';

describe('analytics periods', () => {
  it('lists month starts across a year boundary', () => {
    expect(listPeriods('2025-11-15', '2026-02-03', 'month')).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ]);
  });

  it('starts weeks on Monday', () => {
    expect(periodStart('2026-11-09', 'week')).toBe('2026-11-09');
    expect(periodStart('2026-11-15', 'week')).toBe('2026-11-09');
    expect(listPeriods('2026-11-01', '2026-11-16', 'week')).toEqual([
      '2026-10-26',
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
    ]);
  });

  it('lists days inclusive', () => {
    expect(listPeriods('2026-02-27', '2026-03-01', 'day')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
  });

  it('shifts months', () => {
    expect(shiftMonth('2026-01-01', -1)).toBe('2025-12-01');
  });
});

import type { FlowGranularity } from '@bulog-wms/schema';

const toDate = (value: string) => new Date(`${value}T00:00:00Z`);
const toStr = (date: Date) => date.toISOString().slice(0, 10);

/** Start of the period containing `value` (weeks start on Monday, like Postgres date_trunc) */
export function periodStart(value: string, granularity: FlowGranularity) {
  const date = toDate(value);
  if (granularity === 'month') return `${value.slice(0, 7)}-01`;
  if (granularity === 'week') {
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  }
  return toStr(date);
}

export function shiftMonth(monthStart: string, months: number) {
  const date = toDate(monthStart);
  date.setUTCMonth(date.getUTCMonth() + months);
  return toStr(date);
}

/** Every period start between two YYYY-MM-DD dates, inclusive */
export function listPeriods(
  startDate: string,
  endDate: string,
  granularity: FlowGranularity,
): string[] {
  const periods: string[] = [];
  let current = periodStart(startDate, granularity);
  const last = periodStart(endDate, granularity);
  while (current <= last && periods.length < 2000) {
    periods.push(current);
    if (granularity === 'month') {
      current = shiftMonth(current, 1);
    } else {
      const date = toDate(current);
      date.setUTCDate(date.getUTCDate() + (granularity === 'week' ? 7 : 1));
      current = toStr(date);
    }
  }
  return periods;
}

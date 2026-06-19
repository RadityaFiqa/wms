/**
 * Given a "YYYY-MM-DD" date string and a timezone (e.g. "Asia/Jakarta"),
 * returns the UTC Date object corresponding to the start of that day (00:00:00.000) in the timezone.
 */
export function getLocalStartOfDay(dateStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcMillis = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offsetMinutes = getTimezoneOffset(timezone, new Date(utcMillis));
  return new Date(utcMillis - offsetMinutes * 60 * 1000);
}

/**
 * Given a "YYYY-MM-DD" date string and a timezone,
 * returns the UTC Date object corresponding to the end of that day (23:59:59.999) in the timezone.
 */
export function getLocalEndOfDay(dateStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcMillis = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  const offsetMinutes = getTimezoneOffset(timezone, new Date(utcMillis));
  return new Date(utcMillis - offsetMinutes * 60 * 1000);
}

/**
 * Gets timezone offset in minutes for a specific date in a timezone.
 * E.g., Asia/Jakarta returns 420.
 */
function getTimezoneOffset(timeZone: string, date: Date): number {
  try {
    const tzString = date.toLocaleString('en-US', { timeZone, timeZoneName: 'longOffset' });
    const match = tzString.match(/GMT([-+])(\d{1,2})(?::(\d{2}))?$/);
    if (!match) return 0;
    const [_, sign, hours, minutes = '0'] = match;
    const offset = parseInt(hours, 10) * 60 + parseInt(minutes, 10);
    return sign === '+' ? offset : -offset;
  } catch (e) {
    return 0;
  }
}

/**
 * Formats a Date object as YYYY-MM-DD in a specific timezone.
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  } catch (e) {
    // Fallback to local server time format
    const YYYY = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const DD = String(date.getDate()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD}`;
  }
}

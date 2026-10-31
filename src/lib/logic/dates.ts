import { DayPlan, Routine, UserSettings } from '../types';

/**
 * Extracts local year, month, day, hour, minute in the specified IANA timezone.
 * NEVER uses Date.toISOString().slice(0, 10) to avoid UTC bugs.
 */
export function getLocalParts(tz: string, dateObj: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const safeTz = tz || 'Asia/Kolkata';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(dateObj);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = parseInt(part.value, 10);
    }
  }
  // Intl hour12: false can occasionally return 24 for midnight
  const hour = map.hour === 24 ? 0 : map.hour;
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour,
    minute: map.minute,
  };
}

export function formatYMD(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return formatYMD(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

export function formatIsoToDisplayDate(ymd: string): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * R2: "Aaj" means local date after subtracting dayRolloverHour (default 4).
 * Example: If local time is 02:30 and rolloverHour = 4, "aaj" is yesterday's date.
 */
export function todayLocal(
  tz: string = 'Asia/Kolkata',
  rolloverHour: number = 4,
  nowDate: Date = new Date()
): string {
  const parts = getLocalParts(tz, nowDate);
  const calendarDate = formatYMD(parts.year, parts.month, parts.day);
  if (parts.hour < rolloverHour) {
    return addDays(calendarDate, -1);
  }
  return calendarDate;
}

/**
 * Returns minutes since local midnight (0..1439).
 */
export function nowMinutes(
  tz: string = 'Asia/Kolkata',
  nowDate: Date = new Date()
): number {
  const parts = getLocalParts(tz, nowDate);
  return parts.hour * 60 + parts.minute;
}

/**
 * Parses 'HH:MM' into minutes since midnight (0..1439).
 */
export function parseTimeMinutes(hhmm?: string | null): number | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Formats minutes since midnight (wrapping modulo 1440) into 'HH:MM'.
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * ISO day of week: 1 = Monday .. 7 = Sunday
 */
export function isoDow(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

/**
 * Returns Monday 'YYYY-MM-DD' for the given date's ISO week.
 */
export function weekStartMonday(ymd: string): string {
  const dow = isoDow(ymd);
  return addDays(ymd, -(dow - 1));
}

/**
 * Returns integer days between two 'YYYY-MM-DD' strings (b - a).
 */
export function daysBetween(ymdA: string, ymdB: string): number {
  const [yA, mA, dA] = ymdA.split('-').map(Number);
  const [yB, mB, dB] = ymdB.split('-').map(Number);
  const msA = Date.UTC(yA, mA - 1, dA);
  const msB = Date.UTC(yB, mB - 1, dB);
  return Math.round((msB - msA) / (1000 * 60 * 60 * 24));
}

/**
 * R6: Quiet hours can cross midnight (e.g. 23:00 to 06:00).
 */
export function isInQuietHours(
  currentMin: number,
  quietStart: string,
  quietEnd: string
): boolean {
  const startMin = parseTimeMinutes(quietStart);
  const endMin = parseTimeMinutes(quietEnd);
  if (startMin === null || endMin === null) return false;
  if (startMin === endMin) return false;
  if (startMin < endMin) {
    return currentMin >= startMin && currentMin < endMin;
  }
  // Crosses midnight (e.g. 23:00 = 1380 to 06:00 = 360)
  return currentMin >= startMin || currentMin < endMin;
}

/**
 * R5: Computes a routine's due time in minutes from local midnight.
 * Returns null if anchor is 'duty_start' and duty_start is not set (or off day).
 */
export function computeRoutineDueMinutes(
  routine: Pick<Routine, 'anchorType' | 'clockTime' | 'anchorOffsetMin'>,
  settings: Pick<UserSettings, 'wakeTime'>,
  dayPlan?: Pick<DayPlan, 'dutyStart' | 'isOff'> | null
): number | null {
  let baseMin: number | null = null;
  if (routine.anchorType === 'clock') {
    baseMin = parseTimeMinutes(routine.clockTime);
  } else if (routine.anchorType === 'wake') {
    baseMin = parseTimeMinutes(settings.wakeTime);
  } else if (routine.anchorType === 'duty_start') {
    if (!dayPlan || dayPlan.isOff || !dayPlan.dutyStart) {
      return null;
    }
    baseMin = parseTimeMinutes(dayPlan.dutyStart);
  }

  if (baseMin === null) return null;
  const result = baseMin + (routine.anchorOffsetMin || 0);
  return ((result % 1440) + 1440) % 1440;
}

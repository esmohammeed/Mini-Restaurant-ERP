// lib/timezone.ts
//
// Computes the start/end of "today" in Africa/Cairo as UTC ISO
// strings, so dashboard queries (stored as timestamptz/UTC) can
// filter by the correct local business day without adding a
// timezone library dependency. Uses Intl to read Cairo's current
// offset, so it stays correct even if Egypt's DST rules change.
//
// Phase 1 additions (bottom of file): Cairo calendar-day keys,
// per-day UTC boundaries, and the Today / 7 days / 30 days range
// windows (with the matching previous period) used by the
// dashboard and the AI Assistant. getCairoTodayBoundsUtc is kept
// unchanged for existing callers.

const CAIRO_TZ = 'Africa/Cairo';

function getCairoParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CAIRO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '0';

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
  };
}

export function getCairoTodayBoundsUtc(now: Date = new Date()): {
  startUtcIso: string;
  endUtcIso: string;
} {
  const cairo = getCairoParts(now);

  // "Wall clock" in Cairo expressed as a UTC timestamp, used only
  // to derive Cairo's current offset from UTC at this instant.
  const cairoAsUtcMillis = Date.UTC(
    cairo.year,
    cairo.month - 1,
    cairo.day,
    cairo.hour,
    cairo.minute,
    cairo.second
  );
  const offsetMs = cairoAsUtcMillis - now.getTime();

  const startOfCairoDayAsUtcMillis =
    Date.UTC(cairo.year, cairo.month - 1, cairo.day, 0, 0, 0) - offsetMs;
  const endOfCairoDayAsUtcMillis =
    startOfCairoDayAsUtcMillis + 24 * 60 * 60 * 1000;

  return {
    startUtcIso: new Date(startOfCairoDayAsUtcMillis).toISOString(),
    endUtcIso: new Date(endOfCairoDayAsUtcMillis).toISOString(),
  };
}

// ---------------------------------------------------------
// Phase 1: calendar-day keys and range windows
// ---------------------------------------------------------

const HOUR_MS = 3600000;

let dateKeyFormatter: Intl.DateTimeFormat | null = null;

function getDateKeyFormatter(): Intl.DateTimeFormat {
  if (!dateKeyFormatter) {
    dateKeyFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: CAIRO_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  return dateKeyFormatter;
}

/** Cairo calendar date of an instant, as "YYYY-MM-DD". */
export function cairoDateKey(date: Date): string {
  const parts = getDateKeyFormatter().formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Adds (or subtracts) whole calendar days to a "YYYY-MM-DD" key. */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * First instant (UTC milliseconds) of a Cairo calendar day.
 *
 * Instead of assuming midnight exists and days last 24 hours, this
 * walks forward hour by hour from a point that is certainly still on
 * the previous Cairo day until the Cairo date reaches `key`. Cairo's
 * UTC offset is always a whole number of hours, so this lands exactly
 * on the day's first instant, including days where DST skips
 * 00:00-01:00 (23-hour day) or repeats an hour (25-hour day).
 */
export function cairoDayStartUtcMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  let t = Date.UTC(y, m - 1, d) - 4 * HOUR_MS;
  for (let i = 0; i < 12; i++) {
    if (cairoDateKey(new Date(t)) >= key) break;
    t += HOUR_MS;
  }
  return t;
}

export type RangeKey = 'today' | '7d' | '30d';

export const RANGE_DAYS: Record<RangeKey, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
};

/** Parses the ?range= URL value. Anything unrecognised becomes "today". */
export function parseRange(value: string | null | undefined): RangeKey {
  return value === '7d' || value === '30d' ? value : 'today';
}

export type DayWindow = {
  /** First Cairo day in the window, "YYYY-MM-DD". */
  startKey: string;
  /** Last Cairo day in the window (inclusive), "YYYY-MM-DD". */
  endKey: string;
  /** Every Cairo day in the window, oldest first. */
  dayKeys: string[];
  /** Half-open interval [startUtcIso, endUtcIso) in UTC. */
  startUtcIso: string;
  endUtcIso: string;
};

export type RangeWindows = {
  range: RangeKey;
  days: number;
  current: DayWindow;
  /** The same number of days immediately before `current`. */
  previous: DayWindow;
};

function buildWindow(startKey: string, endKey: string): DayWindow {
  const dayKeys: string[] = [];
  for (let k = startKey; k <= endKey; k = addDaysToKey(k, 1)) {
    dayKeys.push(k);
  }
  return {
    startKey,
    endKey,
    dayKeys,
    startUtcIso: new Date(cairoDayStartUtcMs(startKey)).toISOString(),
    endUtcIso: new Date(
      cairoDayStartUtcMs(addDaysToKey(endKey, 1))
    ).toISOString(),
  };
}

/**
 * Current and previous windows for a range, as whole Cairo calendar
 * days ending today. "Today" is the full Cairo day (00:00 to the next
 * 00:00), not "up to now".
 */
export function getRangeWindows(
  range: RangeKey,
  now: Date = new Date()
): RangeWindows {
  const days = RANGE_DAYS[range];
  const todayKey = cairoDateKey(now);

  const currentStart = addDaysToKey(todayKey, -(days - 1));
  const previousEnd = addDaysToKey(currentStart, -1);
  const previousStart = addDaysToKey(previousEnd, -(days - 1));

  return {
    range,
    days,
    current: buildWindow(currentStart, todayKey),
    previous: buildWindow(previousStart, previousEnd),
  };
}

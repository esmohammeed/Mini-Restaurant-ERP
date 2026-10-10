// lib/timezone.ts
//
// Computes the start/end of "today" in Africa/Cairo as UTC ISO
// strings, so dashboard queries (stored as timestamptz/UTC) can
// filter by the correct local business day without adding a
// timezone library dependency. Uses Intl to read Cairo's current
// offset, so it stays correct even if Egypt's DST rules change.

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

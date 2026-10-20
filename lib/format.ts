// lib/format.ts
// Small, dependency-free formatting helpers.

export function formatCurrency(amount: number | string): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  // Display only: thousands separators, always 2 decimals ("EGP 12,345.60").
  // `value === 0 ? 0 : value` avoids printing "-0.00".
  const shown = value === 0 ? 0 : value;
  return `EGP ${shown.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Africa/Cairo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------
// Phase 1 additions
// ---------------------------------------------------------

/**
 * Percent change from `previous` to `current`.
 * Returns null when `previous` is 0, because a percentage is undefined.
 */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/** "+12.5%", "-3.0%", "0.0%", or an em dash when there is no value. */
export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(1)}%`;
}

/** "YYYY-MM-DD" calendar key -> "11 Oct" (no timezone shifting). */
export function formatShortDate(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
  });
}

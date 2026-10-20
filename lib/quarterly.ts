// lib/quarterly.ts
//
// Quarterly sales, using the SAME definitions as every other dashboard KPI:
//   - revenue = completed orders only (orders.status = 'completed')
//   - dated by orders.created_at, as an Africa/Cairo calendar date
//   - sales are gross (the schema has no discounts, taxes or refunds)
//   - quarters are calendar quarters: Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep,
//     Q4 Oct-Dec (by Cairo date)
//
// Nothing here is invented: a quarter appears only if it falls between the
// first quarter that has completed sales and the current quarter, its total
// is the sum of real (or, in Demo Mode, simulated) completed orders, and a
// percentage change is shown only when both quarters are comparable.
//
//   computeQuarterlySales  - pure; used by Live (database rows) and Demo
//                            (in-memory simulated rows)
//   getQuarterlySales      - Live only; read-only queries as the signed-in
//                            user, so RLS applies. Demo code never calls it.

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/kpi';
import type { KpiError } from '@/lib/kpi';
import { percentChange } from '@/lib/format';
import { addDaysToKey, cairoDateKey, cairoDayStartUtcMs } from '@/lib/timezone';

/** Most quarters shown (the current one plus earlier ones). */
export const QUARTERS_SHOWN = 6;

export type QuarterStatus = 'complete' | 'in_progress' | 'partial_start';

export type QuarterSales = {
  /** "2026-Q3" */
  key: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  /** "Q3 2026" */
  label: string;
  /** First and last Cairo day of the quarter, "YYYY-MM-DD". */
  startKey: string;
  endKey: string;
  /** Gross sales of completed orders in the quarter. */
  sales: number;
  completedCount: number;
  /**
   * complete       the quarter has ended and its data is whole
   * in_progress    the quarter contains today (quarter to date)
   * partial_start  the available data begins inside this quarter
   */
  status: QuarterStatus;
  /** For partial_start: the first day of available data. */
  coverageFrom: string | null;
  /** True when not every order of the quarter could be loaded (row cap). */
  truncated: boolean;
  /** Percent change vs the previous quarter, or null when not comparable. */
  changePct: number | null;
  /** Why changePct is null (null when there is a comparison). */
  changeNote: string | null;
};

export type QuarterlySalesResult = {
  quarters: QuarterSales[];
  /** True if any quarter hit the row cap. */
  truncated: boolean;
  error: KpiError | null;
};

// ---------------------------------------------------------
// Quarter arithmetic on "YYYY-MM-DD" Cairo date keys
// ---------------------------------------------------------

/** year * 4 + (quarter - 1): consecutive quarters differ by exactly 1. */
export function quarterIndexOfKey(dayKey: string): number {
  const [y, m] = dayKey.split('-').map(Number);
  return y * 4 + Math.floor((m - 1) / 3);
}

export function quarterInfo(index: number): {
  key: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  label: string;
  startKey: string;
  endKey: string;
} {
  const year = Math.floor(index / 4);
  const quarter = ((index % 4) + 1) as 1 | 2 | 3 | 4;
  const startMonth = (quarter - 1) * 3 + 1;
  const startKey = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const nextStart =
    quarter === 4
      ? `${year + 1}-01-01`
      : `${year}-${String(startMonth + 3).padStart(2, '0')}-01`;
  return {
    key: `${year}-Q${quarter}`,
    year,
    quarter,
    label: `Q${quarter} ${year}`,
    startKey,
    endKey: addDaysToKey(nextStart, -1),
  };
}

// ---------------------------------------------------------
// Pure calculation
// ---------------------------------------------------------

export function computeQuarterlySales(
  rows: any[],
  opts: {
    /** Today, as a Cairo date key. */
    asOfKey: string;
    /** First day for which data exists (Demo); null/undefined when unknown (Live). */
    dataStartKey?: string | null;
    shown?: number;
    /** Quarter keys whose rows were cut short by the row cap. */
    truncatedKeys?: Set<string>;
  }
): QuarterSales[] {
  const shown = opts.shown ?? QUARTERS_SHOWN;
  const dataStartKey = opts.dataStartKey ?? null;
  const truncatedKeys = opts.truncatedKeys ?? new Set<string>();

  const asOfIdx = quarterIndexOfKey(opts.asOfKey);
  const minIdx = asOfIdx - shown; // one extra quarter: the comparison base
  const firstShownIdx = asOfIdx - shown + 1;

  // Bucket completed orders by Cairo calendar quarter (in whole cents).
  const totals = new Map<number, { cents: number; count: number }>();
  for (const row of rows) {
    if (row.status !== undefined && row.status !== 'completed') continue;
    const t = Date.parse(row.created_at);
    if (Number.isNaN(t)) continue;
    const idx = quarterIndexOfKey(cairoDateKey(new Date(t)));
    if (idx < minIdx || idx > asOfIdx) continue;
    const cents = Math.round(Number(row.total_amount) * 100);
    const entry = totals.get(idx) ?? { cents: 0, count: 0 };
    entry.cents += Number.isFinite(cents) ? cents : 0;
    entry.count += 1;
    totals.set(idx, entry);
  }

  // Start at the first quarter (within the shown window) that has sales.
  let startIdx = Infinity;
  for (const idx of totals.keys()) {
    if (idx >= firstShownIdx && idx < startIdx) startIdx = idx;
  }
  if (!Number.isFinite(startIdx)) return [];

  const isPartialStart = (idx: number) => {
    if (!dataStartKey) return false;
    const info = quarterInfo(idx);
    return info.startKey < dataStartKey && dataStartKey <= info.endKey;
  };
  const isTruncated = (idx: number) => truncatedKeys.has(quarterInfo(idx).key);
  const salesOf = (idx: number) => (totals.get(idx)?.cents ?? 0) / 100;

  const out: QuarterSales[] = [];
  for (let idx = startIdx; idx <= asOfIdx; idx++) {
    const info = quarterInfo(idx);
    const inProgress = idx === asOfIdx;
    const partial = !inProgress && isPartialStart(idx);
    const status: QuarterStatus = inProgress
      ? 'in_progress'
      : partial
        ? 'partial_start'
        : 'complete';
    const truncated = isTruncated(idx);
    const sales = salesOf(idx);

    let changePct: number | null = null;
    let changeNote: string | null = null;
    const prevIdx = idx - 1;
    if (status === 'in_progress') changeNote = 'Quarter in progress';
    else if (status === 'partial_start') changeNote = 'Data starts mid-quarter';
    else if (truncated) changeNote = 'Not all orders loaded';
    else if (isPartialStart(prevIdx)) changeNote = 'Previous quarter has partial data';
    else if (isTruncated(prevIdx)) changeNote = 'Previous quarter not fully loaded';
    else if (salesOf(prevIdx) <= 0) changeNote = 'No sales in previous quarter';
    else changePct = percentChange(sales, salesOf(prevIdx));

    out.push({
      ...info,
      sales,
      completedCount: totals.get(idx)?.count ?? 0,
      status,
      coverageFrom: partial ? dataStartKey : null,
      truncated,
      changePct,
      changeNote: changePct === null ? changeNote : null,
    });
  }
  return out;
}

// ---------------------------------------------------------
// Live query
// ---------------------------------------------------------

function table(db: SupabaseClient, name: string): any {
  return (db as unknown as { from: (t: string) => any }).from(name);
}

/**
 * Live Mode only. Reads completed orders for the current quarter and the
 * previous QUARTERS_SHOWN quarters, one parallel query per quarter, as the
 * signed-in user (RLS applies). Each quarter is paged like every other KPI
 * query and flagged if it hits the row cap. Never throws.
 */
export async function getQuarterlySales(
  db: SupabaseClient,
  now: Date = new Date(),
  maxRows?: number
): Promise<QuarterlySalesResult> {
  try {
    const asOfKey = cairoDateKey(now);
    const asOfIdx = quarterIndexOfKey(asOfKey);
    const indexes: number[] = [];
    for (let i = asOfIdx - QUARTERS_SHOWN; i <= asOfIdx; i++) indexes.push(i);

    const results = await Promise.all(
      indexes.map((idx) => {
        const info = quarterInfo(idx);
        const startIso = new Date(cairoDayStartUtcMs(info.startKey)).toISOString();
        const endIso = new Date(
          cairoDayStartUtcMs(addDaysToKey(info.endKey, 1))
        ).toISOString();
        return fetchAllRows(
          (from, to) =>
            table(db, 'orders')
              .select('id, status, total_amount, created_at')
              .eq('status', 'completed')
              .gte('created_at', startIso)
              .lt('created_at', endIso)
              .order('id', { ascending: true })
              .range(from, to),
          maxRows
        );
      })
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error('[kpi] quarterly sales failed:', failed.error.code ?? '', failed.error.message);
      return { quarters: [], truncated: false, error: failed.error };
    }

    const truncatedKeys = new Set<string>();
    results.forEach((r, i) => {
      if (r.truncated) truncatedKeys.add(quarterInfo(indexes[i]).key);
    });

    const quarters = computeQuarterlySales(
      results.flatMap((r) => r.rows),
      { asOfKey, dataStartKey: null, truncatedKeys }
    );
    return { quarters, truncated: truncatedKeys.size > 0, error: null };
  } catch (e) {
    const error: KpiError = {
      message: e instanceof Error ? e.message : 'Unexpected error',
    };
    console.error('[kpi] quarterly sales failed:', error.message);
    return { quarters: [], truncated: false, error };
  }
}

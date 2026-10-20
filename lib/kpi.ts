// lib/kpi.ts
//
// Single source of truth for the dashboard KPIs (and the AI
// Assistant's "Top Selling Products" answer). Definitions:
//
//   - Revenue KPIs (sales, AOV, sales by day, top products, sales by
//     category) count ONLY orders whose CURRENT status is 'completed'.
//   - Orders are dated by orders.created_at (there is no completed_at
//     column), using Africa/Cairo calendar days.
//   - Sales are gross: the schema has no discounts, taxes or refunds.
//   - Total Orders counts every status, with a breakdown.
//   - Low-stock / active-product figures are current snapshots and are
//     independent of the selected date range.
//
// Every getter catches its own errors and returns { error } instead of
// throwing, so one failing query never blanks the dashboard and a
// failed query is never presented as a real 0.
//
// No schema, RLS or database changes are needed: everything below is
// read-only and runs as the signed-in user, so RLS still applies.

import type { SupabaseClient } from '@supabase/supabase-js';
import { formatCurrency } from '@/lib/format';
import { cairoDateKey } from '@/lib/timezone';
import type { DayWindow, RangeKey, RangeWindows } from '@/lib/timezone';

export type KpiDb = SupabaseClient;

// ---------------------------------------------------------
// Constants
// ---------------------------------------------------------

/** Rows requested per API call (Supabase's default max is 1000). */
export const PAGE_SIZE = 1000;

/** Safety cap on rows read for any one KPI query. */
export const MAX_ROWS = 20000;

export const RANGE_KEYS: RangeKey[] = ['today', '7d', '30d'];

export const RANGE_META: Record<
  RangeKey,
  { tab: string; label: string; compareLabel: string; phrase: string }
> = {
  today: {
    tab: 'Today',
    label: 'Today',
    compareLabel: 'vs yesterday',
    phrase: 'today',
  },
  '7d': {
    tab: '7 days',
    label: 'Last 7 days',
    compareLabel: 'vs previous 7 days',
    phrase: 'in the last 7 days',
  },
  '30d': {
    tab: '30 days',
    label: 'Last 30 days',
    compareLabel: 'vs previous 30 days',
    phrase: 'in the last 30 days',
  },
};

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

export type KpiError = { message: string; code?: string };

export type PeriodStats = {
  /** Gross sales of completed orders. */
  sales: number;
  completedCount: number;
  /** Orders of every status. */
  totalCount: number;
  /** pending + preparing */
  inProgressCount: number;
  cancelledCount: number;
  /** sales / completedCount, or null when there are no completed orders. */
  averageOrderValue: number | null;
};

export type DaySales = {
  dayKey: string;
  sales: number;
  completedCount: number;
};

export type OrderStats = {
  current: PeriodStats;
  previous: PeriodStats;
  /** One entry per Cairo day of the current window, zero-filled. */
  byDay: DaySales[];
  truncated: boolean;
  error: KpiError | null;
};

export type StockStats = {
  activeProducts: number;
  lowStock: number;
  outOfStock: number;
  truncated: boolean;
  error: KpiError | null;
};

export type TopProduct = {
  productId: number;
  name: string;
  units: number;
  revenue: number;
};

export type CategorySales = {
  category: string;
  revenue: number;
  /** Percent of category revenue in the range, 1 decimal; null if 0. */
  share: number | null;
};

export type TopProductsResult = {
  topProducts: TopProduct[];
  truncated: boolean;
  error: KpiError | null;
};

export type ItemStats = {
  topProducts: TopProduct[];
  categorySales: CategorySales[];
  truncated: boolean;
  error: KpiError | null;
};

export type RecentOrder = {
  id: number;
  customer_name: string | null;
  status: string;
  total_amount: number | string;
  created_at: string;
};

// ---------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------

type FetchAllResult = {
  rows: any[];
  truncated: boolean;
  error: KpiError | null;
};

type PageFetcher = (from: number, to: number) => PromiseLike<any>;

function toKpiError(e: unknown): KpiError {
  if (e && typeof e === 'object' && 'message' in e) {
    const err = e as { message?: unknown; code?: unknown };
    return {
      message: String(err.message ?? 'Unexpected error'),
      code: typeof err.code === 'string' ? err.code : undefined,
    };
  }
  return { message: 'Unexpected error' };
}

function logKpiError(section: string, error: KpiError) {
  console.error(
    `[kpi] ${section} failed:`,
    error.code ?? '',
    error.message
  );
}

function table(db: KpiDb, name: string): any {
  return (db as unknown as { from: (t: string) => any }).from(name);
}

/** Money is summed in integer cents to avoid floating-point drift. */
function toCents(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** PostgREST returns to-one embeds as objects; tolerate one-item arrays. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Reads every row of a query in pages of PAGE_SIZE, up to `maxRows`.
 *
 * - Any page error fails the whole read (no partial numbers).
 * - If exactly `maxRows` rows are read, one extra probe row is requested
 *   to learn whether more exist; `truncated` is true only if it does.
 */
export async function fetchAllRows(
  fetchPage: PageFetcher,
  maxRows: number = MAX_ROWS
): Promise<FetchAllResult> {
  const rows: any[] = [];

  try {
    while (true) {
      if (rows.length >= maxRows) {
        const probe = await fetchPage(rows.length, rows.length);
        if (probe.error) return failedRead(probe.error);
        return {
          rows,
          truncated: (probe.data?.length ?? 0) > 0,
          error: null,
        };
      }

      const requested = Math.min(PAGE_SIZE, maxRows - rows.length);
      const res = await fetchPage(rows.length, rows.length + requested - 1);
      if (res.error) return failedRead(res.error);

      const page: any[] = res.data ?? [];
      rows.push(...page);

      if (page.length < requested) {
        return { rows, truncated: false, error: null };
      }
    }
  } catch (e) {
    return failedRead(e);
  }
}

function failedRead(e: unknown): FetchAllResult {
  return { rows: [], truncated: false, error: toKpiError(e) };
}

// ---------------------------------------------------------
// Orders: sales, orders, AOV, sales by day
// ---------------------------------------------------------

type Acc = {
  salesCents: number;
  completed: number;
  total: number;
  inProgress: number;
  cancelled: number;
};

function newAcc(): Acc {
  return { salesCents: 0, completed: 0, total: 0, inProgress: 0, cancelled: 0 };
}

function toPeriodStats(acc: Acc): PeriodStats {
  return {
    sales: acc.salesCents / 100,
    completedCount: acc.completed,
    totalCount: acc.total,
    inProgressCount: acc.inProgress,
    cancelledCount: acc.cancelled,
    averageOrderValue:
      acc.completed > 0 ? Math.round(acc.salesCents / acc.completed) / 100 : null,
  };
}

/**
 * Pure aggregation of order rows ({status, total_amount, created_at}).
 * Rows outside both windows are ignored. Boundaries are half-open:
 * an order exactly at a window's start is inside it, exactly at its
 * end belongs to the next window.
 */
export function computeOrderStats(
  rows: any[],
  windows: RangeWindows
): Pick<OrderStats, 'current' | 'previous' | 'byDay'> {
  const curStart = Date.parse(windows.current.startUtcIso);
  const curEnd = Date.parse(windows.current.endUtcIso);
  const prevStart = Date.parse(windows.previous.startUtcIso);
  const prevEnd = Date.parse(windows.previous.endUtcIso);

  const cur = newAcc();
  const prev = newAcc();
  const days = new Map<string, { cents: number; count: number }>();
  for (const key of windows.current.dayKeys) {
    days.set(key, { cents: 0, count: 0 });
  }

  for (const row of rows) {
    const t = Date.parse(row.created_at);
    if (Number.isNaN(t)) continue;

    let acc: Acc;
    let inCurrent = false;
    if (t >= curStart && t < curEnd) {
      acc = cur;
      inCurrent = true;
    } else if (t >= prevStart && t < prevEnd) {
      acc = prev;
    } else {
      continue;
    }

    acc.total += 1;

    if (row.status === 'completed') {
      const cents = toCents(row.total_amount);
      acc.completed += 1;
      acc.salesCents += cents;
      if (inCurrent) {
        const day = days.get(cairoDateKey(new Date(t)));
        if (day) {
          day.cents += cents;
          day.count += 1;
        }
      }
    } else if (row.status === 'pending' || row.status === 'preparing') {
      acc.inProgress += 1;
    } else if (row.status === 'cancelled') {
      acc.cancelled += 1;
    }
  }

  return {
    current: toPeriodStats(cur),
    previous: toPeriodStats(prev),
    byDay: windows.current.dayKeys.map((dayKey) => {
      const d = days.get(dayKey) ?? { cents: 0, count: 0 };
      return { dayKey, sales: d.cents / 100, completedCount: d.count };
    }),
  };
}

export async function getOrderStats(
  db: KpiDb,
  windows: RangeWindows,
  maxRows: number = MAX_ROWS
): Promise<OrderStats> {
  // One read covers the previous and current windows (they are
  // contiguous): all statuses, so the breakdown and comparison work.
  const res = await fetchAllRows(
    (from, to) =>
      table(db, 'orders')
        .select('id, status, total_amount, created_at')
        .gte('created_at', windows.previous.startUtcIso)
        .lt('created_at', windows.current.endUtcIso)
        .order('id', { ascending: true })
        .range(from, to),
    maxRows
  );

  if (res.error) {
    logKpiError('orders', res.error);
    return { ...computeOrderStats([], windows), truncated: false, error: res.error };
  }

  return {
    ...computeOrderStats(res.rows, windows),
    truncated: res.truncated,
    error: null,
  };
}

// ---------------------------------------------------------
// Stock snapshot: active products, low stock, out of stock
// ---------------------------------------------------------

export function computeStockStats(
  productRows: any[],
  stockRows: any[]
): Pick<StockStats, 'activeProducts' | 'lowStock' | 'outOfStock'> {
  const active = new Set<number>(productRows.map((r) => Number(r.id)));
  let lowStock = 0;
  let outOfStock = 0;

  for (const row of stockRows) {
    // product_stock includes inactive products; they are excluded here.
    if (!active.has(Number(row.product_id))) continue;
    if (row.stock_status === 'Low Stock') lowStock += 1;
    else if (row.stock_status === 'Out of Stock') outOfStock += 1;
  }

  return { activeProducts: active.size, lowStock, outOfStock };
}

export async function getStockStats(
  db: KpiDb,
  maxRows: number = MAX_ROWS
): Promise<StockStats> {
  const empty = { activeProducts: 0, lowStock: 0, outOfStock: 0 };

  const [products, stock] = await Promise.all([
    fetchAllRows(
      (from, to) =>
        table(db, 'products')
          .select('id')
          .eq('is_active', true)
          .order('id', { ascending: true })
          .range(from, to),
      maxRows
    ),
    fetchAllRows(
      (from, to) =>
        table(db, 'product_stock')
          .select('product_id, stock_status')
          .in('stock_status', ['Low Stock', 'Out of Stock'])
          .order('product_id', { ascending: true })
          .range(from, to),
      maxRows
    ),
  ]);

  const error = products.error ?? stock.error;
  if (error) {
    logKpiError('stock', error);
    return { ...empty, truncated: false, error };
  }

  return {
    ...computeStockStats(products.rows, stock.rows),
    truncated: products.truncated || stock.truncated,
    error: null,
  };
}

// ---------------------------------------------------------
// Order items: top products and sales by category
// ---------------------------------------------------------

export function computeTopProducts(rows: any[], limit: number): TopProduct[] {
  const byProduct = new Map<
    number,
    { name: string; units: number; cents: number }
  >();

  for (const row of rows) {
    const id = Number(row.product_id);
    const product = one<any>(row.products);
    const entry = byProduct.get(id) ?? {
      name: product?.name ?? `Product #${id}`,
      units: 0,
      cents: 0,
    };
    entry.units += Number(row.quantity) || 0;
    entry.cents += toCents(row.subtotal);
    byProduct.set(id, entry);
  }

  return Array.from(byProduct.entries())
    .map(([productId, e]) => ({
      productId,
      name: e.name,
      units: e.units,
      revenue: e.cents / 100,
    }))
    .sort(
      (a, b) =>
        b.units - a.units ||
        b.revenue - a.revenue ||
        a.name.localeCompare(b.name)
    )
    .slice(0, limit);
}

export function computeCategorySales(rows: any[]): CategorySales[] {
  const byCategory = new Map<string, number>();
  let totalCents = 0;

  for (const row of rows) {
    const product = one<any>(row.products);
    const category = one<any>(product?.categories);
    const name: string = category?.name ?? 'Uncategorized';
    const cents = toCents(row.subtotal);
    byCategory.set(name, (byCategory.get(name) ?? 0) + cents);
    totalCents += cents;
  }

  return Array.from(byCategory.entries())
    .map(([category, cents]) => ({
      category,
      revenue: cents / 100,
      share: totalCents > 0 ? Math.round((cents / totalCents) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.revenue - a.revenue || a.category.localeCompare(b.category));
}

/**
 * Pure second line of defence for order lines: keeps only lines whose
 * embedded order is COMPLETED and was created inside `window`
 * ([start, end) in UTC). Shared by the Live query path and Demo Mode so
 * both apply exactly the same rule.
 */
export function filterCompletedItemRows(rows: any[], window: DayWindow): any[] {
  const startMs = Date.parse(window.startUtcIso);
  const endMs = Date.parse(window.endUtcIso);

  return rows.filter((row) => {
    const order = one<any>(row.orders);
    if (!order || order.status !== 'completed') return false;
    const t = Date.parse(order.created_at);
    return !Number.isNaN(t) && t >= startMs && t < endMs;
  });
}

/**
 * Reads order lines that belong to COMPLETED orders created inside
 * `window`. The status/date filters are applied in the query (on the
 * embedded order) and re-checked here as a second line of defence, so a
 * non-completed or out-of-range order can never leak into the totals.
 */
async function fetchCompletedItems(
  db: KpiDb,
  window: DayWindow,
  maxRows: number
): Promise<FetchAllResult> {
  const res = await fetchAllRows(
    (from, to) =>
      table(db, 'order_items')
        .select(
          'product_id, quantity, subtotal, orders!inner(status, created_at), products(name, category_id, categories(name))'
        )
        .eq('orders.status', 'completed')
        .gte('orders.created_at', window.startUtcIso)
        .lt('orders.created_at', window.endUtcIso)
        .order('id', { ascending: true })
        .range(from, to),
    maxRows
  );
  if (res.error) return res;

  const rows = filterCompletedItemRows(res.rows, window);

  return { rows, truncated: res.truncated, error: null };
}

export async function getItemStats(
  db: KpiDb,
  window: DayWindow,
  topLimit: number = 5,
  maxRows: number = MAX_ROWS
): Promise<ItemStats> {
  const res = await fetchCompletedItems(db, window, maxRows);

  if (res.error) {
    logKpiError('order items', res.error);
    return { topProducts: [], categorySales: [], truncated: false, error: res.error };
  }

  return {
    topProducts: computeTopProducts(res.rows, topLimit),
    categorySales: computeCategorySales(res.rows),
    truncated: res.truncated,
    error: null,
  };
}

/** Same rules as the dashboard's "Top selling products" panel. */
export async function getTopProducts(
  db: KpiDb,
  window: DayWindow,
  limit: number = 5,
  maxRows: number = MAX_ROWS
): Promise<TopProductsResult> {
  const res = await fetchCompletedItems(db, window, maxRows);

  if (res.error) {
    logKpiError('top products', res.error);
    return { topProducts: [], truncated: false, error: res.error };
  }

  return {
    topProducts: computeTopProducts(res.rows, limit),
    truncated: res.truncated,
    error: null,
  };
}

// ---------------------------------------------------------
// Recent orders (any status, independent of the range)
// ---------------------------------------------------------

export async function getRecentOrders(
  db: KpiDb,
  limit: number = 5
): Promise<{ rows: RecentOrder[]; error: KpiError | null }> {
  try {
    const { data, error } = await table(db, 'orders')
      .select('id, customer_name, status, total_amount, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      const e = toKpiError(error);
      logKpiError('recent orders', e);
      return { rows: [], error: e };
    }
    return { rows: (data ?? []) as RecentOrder[], error: null };
  } catch (err) {
    const e = toKpiError(err);
    logKpiError('recent orders', e);
    return { rows: [], error: e };
  }
}

// ---------------------------------------------------------
// AI Assistant helpers (pure, so they can be tested)
// ---------------------------------------------------------

/** Reads a range from a free-text question; defaults to "today". */
export function rangeFromText(text: string): RangeKey {
  const q = text.toLowerCase();
  if (/\b30\s*-?\s*days?\b|\bmonth\b/.test(q)) return '30d';
  if (/\b7\s*-?\s*days?\b|\bweek\b/.test(q)) return '7d';
  return 'today';
}

export function formatTopProductsAnswer(
  result: TopProductsResult,
  range: RangeKey
): string {
  const phrase = RANGE_META[range].phrase;

  if (result.error) {
    return `I couldn't load the top selling products right now (${result.error.message}).`;
  }

  if (result.topProducts.length === 0) {
    return `There are no completed orders ${phrase}, so there are no top selling products yet. You can also ask for "top selling products this week" or "this month".`;
  }

  const lines = result.topProducts
    .map(
      (p, i) =>
        `${i + 1}. ${p.name} (${p.units} sold, ${formatCurrency(p.revenue)})`
    )
    .join('\n');

  let answer = `Top selling products ${phrase} (completed orders, by units sold):\n${lines}`;
  if (result.truncated) {
    answer += `\nNote: results may be incomplete because more than ${MAX_ROWS.toLocaleString(
      'en-US'
    )} order lines matched.`;
  }
  return answer;
}

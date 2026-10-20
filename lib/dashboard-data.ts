// lib/dashboard-data.ts
//
// The single switch between Live and Demo dashboard data.
//
// IMPORT BOUNDARY: this is the ONLY module allowed to import lib/demo/*.
// Live code paths (lib/kpi.ts, pages, actions) never import demo code, and
// demo code never imports Supabase.
//
//   Live: unchanged Phase 1 queries, run as the signed-in user (RLS applies).
//   Demo: in-memory simulated data. `getDb` is NEVER called, so no Supabase
//         client is created and no database or network call is made by the
//         demo path. (The login/session check in middleware and the
//         dashboard layout is separate and unchanged.)
//
// The mode travels inside the result, so labels in the UI always come from
// the data that was actually used, never from the URL or cookie.

import {
  getItemStats,
  getOrderStats,
  getRecentOrders,
  getStockStats,
} from '@/lib/kpi';
import type {
  ItemStats,
  KpiDb,
  KpiError,
  OrderStats,
  RecentOrder,
  StockStats,
} from '@/lib/kpi';
import { getQuarterlySales } from '@/lib/quarterly';
import type { QuarterlySalesResult } from '@/lib/quarterly';
import { getRangeWindows } from '@/lib/timezone';
import type { RangeKey, RangeWindows } from '@/lib/timezone';
import { getDemoDashboardData } from '@/lib/demo/dashboard';
import type { DashboardMode } from '@/lib/dashboard-mode';

export type DashboardData = {
  mode: DashboardMode;
  windows: RangeWindows;
  orderStats: OrderStats;
  stockStats: StockStats;
  itemStats: ItemStats;
  recent: { rows: RecentOrder[]; error: KpiError | null };
  /** Completed sales per calendar quarter (same source as the rest of the data). */
  quarterly: QuarterlySalesResult;
  /** Demo only: the fixed demo clock (ISO). Null in Live Mode. */
  demoClockIso: string | null;
};

export async function getDashboardData(opts: {
  mode: DashboardMode;
  range: RangeKey;
  /** Lazily creates the database client. Only ever called in Live Mode. */
  getDb: () => Promise<KpiDb> | KpiDb;
  now?: Date;
}): Promise<DashboardData> {
  const { mode, range, getDb, now } = opts;

  if (mode === 'demo') {
    const demo = getDemoDashboardData(range, now);
    return {
      mode: 'demo',
      windows: demo.windows,
      orderStats: demo.orderStats,
      stockStats: demo.stockStats,
      itemStats: demo.itemStats,
      recent: demo.recent,
      quarterly: demo.quarterly,
      demoClockIso: demo.clockIso,
    };
  }

  // Live: exactly the Phase 1 queries.
  const windows = getRangeWindows(range, now);
  const db = await getDb();
  const [orderStats, stockStats, itemStats, recent, quarterly] = await Promise.all([
    getOrderStats(db, windows),
    getStockStats(db),
    getItemStats(db, windows.current, 5),
    getRecentOrders(db, 5),
    getQuarterlySales(db, now),
  ]);

  return {
    mode: 'live',
    windows,
    orderStats,
    stockStats,
    itemStats,
    recent,
    quarterly,
    demoClockIso: null,
  };
}

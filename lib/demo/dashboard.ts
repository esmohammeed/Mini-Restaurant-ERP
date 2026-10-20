// lib/demo/dashboard.ts
//
// DEMO DATA. Builds every dashboard figure from the in-memory demo dataset
// using the SAME pure KPI functions that Live Mode runs on database rows
// (lib/kpi.ts), so demo and live share one set of definitions:
//   - revenue = completed orders only, dated by created_at, Cairo days
//   - low stock = active products only, Low Stock or Out of Stock
//
// This module takes no database client and makes no network or write
// calls: it cannot reach Supabase.

import {
  computeCategorySales,
  computeOrderStats,
  computeStockStats,
  computeTopProducts,
  filterCompletedItemRows,
} from '@/lib/kpi';
import type {
  ItemStats,
  OrderStats,
  RecentOrder,
  StockStats,
} from '@/lib/kpi';
import { computeQuarterlySales } from '@/lib/quarterly';
import type { QuarterlySalesResult } from '@/lib/quarterly';
import { getRangeWindows } from '@/lib/timezone';
import type { RangeKey, RangeWindows } from '@/lib/timezone';
import { computeDemoStock, getDemoDataset } from '@/lib/demo/dataset';

export type DemoDashboardData = {
  windows: RangeWindows;
  orderStats: OrderStats;
  stockStats: StockStats;
  itemStats: ItemStats;
  recent: { rows: RecentOrder[]; error: null };
  /** Quarterly sales computed from the simulated orders only. */
  quarterly: QuarterlySalesResult;
  /** The fixed demo clock (20:00 Africa/Cairo), as an ISO string. */
  clockIso: string;
};

export function getDemoDashboardData(
  range: RangeKey,
  now: Date = new Date()
): DemoDashboardData {
  const ds = getDemoDataset(now);
  const clock = new Date(ds.nowMs);
  const windows = getRangeWindows(range, clock);

  // --- orders: sales, orders, AOV, sales by day
  const orderStats: OrderStats = {
    ...computeOrderStats(ds.orders, windows),
    truncated: false,
    error: null,
  };

  // --- stock snapshot (same shape of rows the live queries return)
  const stockRows = computeDemoStock(ds);
  const activeProductRows = ds.products
    .filter((p) => p.is_active)
    .map((p) => ({ id: p.id }));
  const lowOrOutRows = stockRows
    .filter((r) => r.stock_status === 'Low Stock' || r.stock_status === 'Out of Stock')
    .map((r) => ({ product_id: r.product_id, stock_status: r.stock_status }));
  const stockStats: StockStats = {
    ...computeStockStats(activeProductRows, lowOrOutRows),
    truncated: false,
    error: null,
  };

  // --- order lines in the same embedded shape the live query returns
  const orderById = new Map(ds.orders.map((o) => [o.id, o]));
  const categoryById = new Map(ds.categories.map((c) => [c.id, c]));
  const productById = new Map(ds.products.map((p) => [p.id, p]));
  const itemRows = ds.orderItems.map((it) => {
    const order = orderById.get(it.order_id)!;
    const product = productById.get(it.product_id)!;
    return {
      product_id: it.product_id,
      quantity: it.quantity,
      subtotal: it.subtotal,
      orders: { status: order.status, created_at: order.created_at },
      products: {
        name: product.name,
        category_id: product.category_id,
        categories: { name: categoryById.get(product.category_id)!.name },
      },
    };
  });
  const inRange = filterCompletedItemRows(itemRows, windows.current);
  const itemStats: ItemStats = {
    topProducts: computeTopProducts(inRange, 5),
    categorySales: computeCategorySales(inRange),
    truncated: false,
    error: null,
  };

  // --- recent orders: newest first, any status, independent of the range
  const recent: RecentOrder[] = [...ds.orders]
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
    .slice(0, 5)
    .map((o) => ({
      id: o.id,
      customer_name: o.customer_name,
      status: o.status,
      total_amount: o.total_amount,
      created_at: o.created_at,
    }));

  // --- quarterly sales: the same pure calculation Live uses, on demo orders.
  //     The demo history is short, so the first quarter is flagged as partial
  //     and no percentage change is invented.
  const quarterly: QuarterlySalesResult = {
    quarters: computeQuarterlySales(ds.orders, {
      asOfKey: ds.todayKey,
      dataStartKey: ds.startKey,
    }),
    truncated: false,
    error: null,
  };

  return {
    windows,
    orderStats,
    stockStats,
    itemStats,
    recent: { rows: recent, error: null },
    quarterly,
    clockIso: clock.toISOString(),
  };
}

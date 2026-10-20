import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  formatCurrency,
  formatDateTime,
  formatPercent,
  formatShortDate,
  percentChange,
} from '@/lib/format';
import { parseRange } from '@/lib/timezone';
import { MAX_ROWS, RANGE_KEYS, RANGE_META } from '@/lib/kpi';
import type { KpiError } from '@/lib/kpi';
import { DASHBOARD_MODE_COOKIE, resolveMode } from '@/lib/dashboard-mode';
import { getDashboardData } from '@/lib/dashboard-data';
import {
  barWidthPct,
  barsSummary,
  buildTrendModel,
  trendSummary,
} from '@/lib/charts';
import KpiCard from '@/components/KpiCard';
import type { KpiDelta } from '@/components/KpiCard';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState, InlineMessage } from '@/components/FormControls';
import { DemoBanner, DemoTag, LiveNote } from '@/components/DemoBanner';
import ModeToggle from '@/components/ModeToggle';
import TrendChart from '@/components/charts/TrendChart';
import BarChart from '@/components/charts/BarChart';
import DonutChart from '@/components/charts/DonutChart';
import QuarterlyChart from '@/components/charts/QuarterlyChart';
import {
  CHART_COLORS,
  buildQuarterModel,
  quarterlySummary,
  shareBreakdown,
} from '@/lib/chart-geometry';
import { setDashboardMode } from './actions';

// The mode lives in a cookie, so this page must never be cached or shared
// between visitors.
export const dynamic = 'force-dynamic';

function describeError(section: string, error: KpiError): string {
  return `Could not load ${section}: ${error.message}${
    error.code ? ` (code ${error.code})` : ''
  }`;
}

function makeDelta(
  current: number | null,
  previous: number | null,
  compareLabel: string
): KpiDelta | null {
  if (current === null || previous === null) return null;
  const pct = percentChange(current, previous);
  const trend = pct === null || pct === 0 ? 'flat' : pct > 0 ? 'up' : 'down';
  return { text: `${formatPercent(pct)} ${compareLabel}`, trend };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range = parseRange(rangeParam);
  const meta = RANGE_META[range];

  // Demo is the default; Live only when the session cookie says "live".
  const mode = resolveMode((await cookies()).get(DASHBOARD_MODE_COOKIE)?.value);

  // `getDb` is only ever called in Live Mode, so Demo Mode never creates a
  // database client.
  const data = await getDashboardData({
    mode,
    range,
    getDb: () => createClient(),
  });

  const { orderStats, stockStats, itemStats, recent, windows, quarterly } = data;
  const isDemo = data.mode === 'demo';
  const cur = orderStats.current;
  const prev = orderStats.previous;
  const ordersFailed = orderStats.error !== null;
  const stockFailed = stockStats.error !== null;
  const badge = isDemo ? 'DEMO' : undefined;

  const errors: string[] = [];
  if (orderStats.error) errors.push(describeError('orders', orderStats.error));
  if (stockStats.error) errors.push(describeError('stock levels', stockStats.error));
  if (itemStats.error) errors.push(describeError('product sales', itemStats.error));
  if (recent.error) errors.push(describeError('recent orders', recent.error));
  if (quarterly.error) errors.push(describeError('quarterly sales', quarterly.error));

  const incomplete: string[] = [];
  if (orderStats.truncated) incomplete.push('orders');
  if (stockStats.truncated) incomplete.push('stock levels');
  if (itemStats.truncated) incomplete.push('product sales');
  if (quarterly.truncated) incomplete.push('quarterly sales');

  const dateSpan =
    windows.current.startKey === windows.current.endKey
      ? formatShortDate(windows.current.endKey)
      : `${formatShortDate(windows.current.startKey)} – ${formatShortDate(
          windows.current.endKey
        )}`;

  const showTrend = range !== 'today';
  const trend = buildTrendModel(orderStats.byDay, windows.current.endKey);

  // Chart rows come from the same objects as the KPI cards, so charts, data
  // tables and cards cannot disagree.
  const topMax = itemStats.topProducts.reduce((m, p) => Math.max(m, p.units), 0);
  const topBars = itemStats.topProducts.map((p) => ({
    label: p.name,
    widthPct: barWidthPct(p.units, topMax),
    value: `${p.units} units`,
    detail: `${formatCurrency(p.revenue)} revenue`,
  }));
  const topTable = {
    headers: ['#', 'Product', 'Units', 'Revenue'],
    rows: itemStats.topProducts.map((p, i) => [
      String(i + 1),
      p.name,
      String(p.units),
      formatCurrency(p.revenue),
    ]),
  };

  const catMax = itemStats.categorySales.reduce((m, c) => Math.max(m, c.revenue), 0);
  const catBars = itemStats.categorySales.map((c) => ({
    label: c.category,
    widthPct: barWidthPct(c.revenue, catMax),
    value: formatCurrency(c.revenue),
    detail: c.share === null ? undefined : `${c.share.toFixed(1)}% of sales`,
  }));
  const catTable = {
    headers: ['Category', 'Revenue', 'Share'],
    rows: itemStats.categorySales.map((c) => [
      c.category,
      formatCurrency(c.revenue),
      c.share === null ? '—' : `${c.share.toFixed(1)}%`,
    ]),
  };

  // Top 3 best sellers: the first three of the existing top-products ranking
  // (units sold, completed orders), with their share among those three.
  const top3 = itemStats.topProducts.slice(0, 3);
  const top3Shares = shareBreakdown(top3.map((p) => p.units));
  const donutItems = top3.map((p, i) => ({
    label: p.name,
    units: p.units,
    share: top3Shares[i],
  }));
  const quarterModel = buildQuarterModel(quarterly.quarters);

  const orderLabel = (id: number) =>
    isDemo ? `D-${String(id).padStart(4, '0')}` : `#${id}`;

  return (
    <div className="space-y-6">
      {/* Range tabs and Demo | Live control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {RANGE_KEYS.map((key) => (
            <Link
              key={key}
              href={key === 'today' ? '/dashboard' : `/dashboard?range=${key}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                range === key
                  ? 'bg-brand-600 text-white'
                  : 'border border-cream-300 bg-cream-50 text-gray-600 hover:bg-cream-100'
              }`}
            >
              {RANGE_META[key].tab}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-gray-500">
            {meta.label} · {dateSpan} (Cairo time)
          </p>
          <ModeToggle mode={data.mode} range={range} action={setDashboardMode} />
        </div>
      </div>

      {isDemo && data.demoClockIso ? (
        <DemoBanner clockLabel={formatDateTime(data.demoClockIso)} />
      ) : (
        <LiveNote />
      )}

      {/* Errors and incomplete-data warnings */}
      {errors.map((message) => (
        <InlineMessage key={message} type="error" message={message} />
      ))}
      {incomplete.length > 0 && (
        <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Results may be incomplete: more than {MAX_ROWS.toLocaleString('en-US')}{' '}
          rows matched for {incomplete.join(', ')}, so the figures below use only
          the first {MAX_ROWS.toLocaleString('en-US')} rows.
        </p>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total Sales"
          highlight
          badge={badge}
          value={formatCurrency(cur.sales)}
          unavailable={ordersFailed}
          hint={`${cur.completedCount} completed order${
            cur.completedCount === 1 ? '' : 's'
          } · gross`}
          delta={makeDelta(cur.sales, prev.sales, meta.compareLabel)}
        />
        <KpiCard
          label="Total Orders"
          badge={badge}
          value={cur.totalCount}
          unavailable={ordersFailed}
          hint={`${cur.completedCount} completed · ${cur.inProgressCount} in progress · ${cur.cancelledCount} cancelled`}
          delta={makeDelta(cur.totalCount, prev.totalCount, meta.compareLabel)}
        />
        <KpiCard
          label="Average Order Value"
          badge={badge}
          value={
            cur.averageOrderValue === null
              ? '—'
              : formatCurrency(cur.averageOrderValue)
          }
          unavailable={ordersFailed}
          hint={
            cur.averageOrderValue === null
              ? 'No completed orders in this range'
              : 'Completed orders only'
          }
          delta={makeDelta(
            cur.averageOrderValue,
            prev.averageOrderValue,
            meta.compareLabel
          )}
        />
        <KpiCard
          label="Low-Stock Items"
          badge={badge}
          value={stockStats.lowStock + stockStats.outOfStock}
          tone={
            stockStats.lowStock + stockStats.outOfStock > 0 ? 'warning' : 'default'
          }
          unavailable={stockFailed}
          hint={`${stockStats.lowStock} low · ${stockStats.outOfStock} out · current`}
        />
        <KpiCard
          label="Active Products"
          badge={badge}
          value={stockStats.activeProducts}
          unavailable={stockFailed}
          hint="Current snapshot"
        />
      </div>

      {/* Top 3 best sellers and quarterly sales */}
      <div className="grid gap-4 lg:grid-cols-2">
        {itemStats.error ? (
          <div className="card chart-card">
            <h2 className="chart-card-header">
              <span className="chart-title">Top 3 best sellers</span>
              <span className="chart-subtitle">{meta.label}</span>
              {isDemo && <DemoTag />}
            </h2>
            <EmptyState message="Top 3 best sellers are unavailable" />
          </div>
        ) : (
          <DonutChart
            title="Top 3 best sellers"
            subtitle={meta.label}
            demo={isDemo}
            summary={barsSummary(
              `Top ${donutItems.length} best-selling products by units sold, ${meta.label}`,
              donutItems.map(
                (p, i) => `${i + 1}. ${p.label}: ${p.units} units, ${p.share.toFixed(1)}%`
              ),
              isDemo
            )}
            items={donutItems}
            emptyMessage="No completed orders in this range"
          />
        )}
        {quarterly.error ? (
          <div className="card chart-card">
            <h2 className="chart-card-header">
              <span className="chart-title">Quarterly sales</span>
              {isDemo && <DemoTag />}
            </h2>
            <EmptyState message="Quarterly sales are unavailable" />
          </div>
        ) : (
          <QuarterlyChart
            title="Quarterly sales"
            demo={isDemo}
            model={quarterModel}
            summary={quarterlySummary(quarterModel, isDemo)}
            emptyMessage="No completed orders yet"
          />
        )}
      </div>

      {/* Daily sales trend (7 and 30 day ranges) */}
      {showTrend ? (
        ordersFailed ? (
          <div className="card chart-card">
            <h2 className="chart-card-header">
              <span className="chart-title">Daily sales</span>
              <span className="chart-subtitle">{meta.label}</span>
              {isDemo && <DemoTag />}
            </h2>
            <EmptyState message="Daily sales are unavailable" />
          </div>
        ) : (
          <TrendChart
            model={trend}
            title="Daily sales"
            subtitle={meta.label}
            summary={trendSummary(trend, meta.label, isDemo)}
            demo={isDemo}
            emptyMessage="No completed orders in this range"
          />
        )
      ) : (
        <div className="card chart-card">
          <h2 className="chart-card-header">
            <span className="chart-title">Daily sales</span>
          </h2>
          <p className="text-sm text-gray-500">
            Choose <strong className="font-medium text-gray-700">7 days</strong>{' '}
            or <strong className="font-medium text-gray-700">30 days</strong> to
            see the daily sales trend.
          </p>
        </div>
      )}

      {/* Top products and sales by category */}
      <div className="grid gap-4 lg:grid-cols-2">
        {itemStats.error ? (
          <>
            <div className="card chart-card">
              <h2 className="chart-card-header">
                <span className="chart-title">Top selling products</span>
                <span className="chart-subtitle">{meta.label}</span>
                {isDemo && <DemoTag />}
              </h2>
              <EmptyState message="Top selling products are unavailable" />
            </div>
            <div className="card chart-card">
              <h2 className="chart-card-header">
                <span className="chart-title">Sales by category</span>
                <span className="chart-subtitle">{meta.label}</span>
                {isDemo && <DemoTag />}
              </h2>
              <EmptyState message="Sales by category are unavailable" />
            </div>
          </>
        ) : (
          <>
            <BarChart
              title="Top selling products"
              subtitle={meta.label}
              demo={isDemo}
              summary={barsSummary(
                `Top ${itemStats.topProducts.length} products by units sold, ${meta.label}`,
                itemStats.topProducts.map(
                  (p, i) =>
                    `${i + 1}. ${p.name}: ${p.units} units, ${formatCurrency(p.revenue)}`
                ),
                isDemo
              )}
              bars={topBars}
              table={topTable}
              fill={CHART_COLORS.bars.products}
              emptyMessage="No completed orders in this range"
            />
            <BarChart
              title="Sales by category"
              subtitle={meta.label}
              demo={isDemo}
              summary={barsSummary(
                `Sales by category, ${meta.label}`,
                itemStats.categorySales.map(
                  (c) =>
                    `${c.category}: ${formatCurrency(c.revenue)}${
                      c.share === null ? '' : `, ${c.share.toFixed(1)}%`
                    }`
                ),
                isDemo
              )}
              bars={catBars}
              table={catTable}
              fill={CHART_COLORS.bars.categories}
              emptyMessage="No completed orders in this range"
            />
          </>
        )}
      </div>

      {/* Recent orders (any status, independent of the range) */}
      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Recent Orders
          {isDemo && <DemoTag />}
        </h2>

        {recent.error ? (
          <EmptyState message="Recent orders are unavailable" />
        ) : recent.rows.length === 0 ? (
          <EmptyState message="No orders yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.rows.map((order) => (
                  <tr key={order.id}>
                    <td>{orderLabel(order.id)}</td>
                    <td>{order.customer_name ?? '—'}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td>{formatCurrency(order.total_amount)}</td>
                    <td>{formatDateTime(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Definitions and limitations */}
      <div className="card text-xs leading-relaxed text-gray-500">
        <p className="mb-1 font-medium text-gray-600">How these numbers work</p>
        <ul className="list-disc space-y-1 pl-4">
          {isDemo && (
            <li>
              Demo Mode uses simulated data generated on the fly. It uses the
              same definitions as Live Mode, so the cards, charts and tables
              always agree with each other, but none of it is real.
            </li>
          )}
          <li>
            Sales, average order value, top products and categories count
            completed orders only. Total Orders counts every status.
          </li>
          <li>
            Orders are dated by when they were created (created_at). An order
            created on one day and completed on another counts on the day it
            was created.
          </li>
          <li>
            Days are Africa/Cairo calendar days. Sales are gross: the system
            has no discounts, taxes or refunds. Profit is not shown because
            there is no cost data.
          </li>
          <li>
            Low-stock and active-product figures are current snapshots and do
            not change with the selected range.
          </li>
        </ul>
      </div>
    </div>
  );
}

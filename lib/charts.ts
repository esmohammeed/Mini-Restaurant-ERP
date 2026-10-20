// lib/charts.ts
//
// Pure view-model helpers for the dashboard charts (no React, no I/O, no
// database). The charts are plain HTML/CSS, so everything they need to draw
// - heights, widths, tick positions, which date labels to show, and the
// text alternative - is computed here, where it can be tested.

import type { DaySales } from '@/lib/kpi';
import { formatCurrency, formatShortDate } from '@/lib/format';

// ---------------------------------------------------------
// Number helpers
// ---------------------------------------------------------

/** A "nice" step (1, 2, 2.5, 5, 10 x 10^k) of at least value/targetTicks. */
export function niceStep(maxValue: number, targetTicks: number = 4): number {
  if (!(maxValue > 0)) return 1;
  const raw = maxValue / targetTicks;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/** 950 -> "950", 1500 -> "1.5k", 12000 -> "12k". */
export function formatCompact(n: number): string {
  if (Math.abs(n) < 1000) return String(Math.round(n * 100) / 100);
  const k = n / 1000;
  const text = k >= 10 ? Math.round(k).toString() : k.toFixed(1).replace(/\.0$/, '');
  return `${text}k`;
}

/** Bar width in percent relative to the largest value; tiny values stay visible. */
export function barWidthPct(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return Math.max(2, Math.round((value / max) * 1000) / 10);
}

// ---------------------------------------------------------
// Daily sales trend (column chart)
// ---------------------------------------------------------

export type TrendPoint = {
  dayKey: string;
  /** "11 Oct" */
  label: string;
  sales: number;
  completedCount: number;
  heightPct: number;
  isMax: boolean;
  isToday: boolean;
  /** 'always' = show on every screen, 'wide' = show from small screens up, 'none' */
  labelLevel: 'always' | 'wide' | 'none';
};

export type TrendModel = {
  points: TrendPoint[];
  ticks: { value: number; text: string; bottomPct: number }[];
  axisMax: number;
  total: number;
  completedTotal: number;
  average: number;
  averagePct: number;
  hasSales: boolean;
  maxPoint: TrendPoint | null;
  minPoint: TrendPoint | null;
};

export function buildTrendModel(byDay: DaySales[], todayKey: string): TrendModel {
  const centsOf = (n: number) => Math.round(n * 100);
  const maxSales = byDay.reduce((m, d) => Math.max(m, d.sales), 0);
  const step = niceStep(maxSales);
  const axisMax = maxSales > 0 ? Math.ceil(maxSales / step) * step : step;
  const n = byDay.length;

  let maxIndex = -1;
  if (maxSales > 0) maxIndex = byDay.findIndex((d) => d.sales === maxSales);

  const points: TrendPoint[] = byDay.map((d, i) => {
    let labelLevel: TrendPoint['labelLevel'] = 'none';
    if (n <= 10 || i === n - 1 || i % 6 === 0) labelLevel = 'always';
    else if (i % 3 === 0) labelLevel = 'wide';
    return {
      dayKey: d.dayKey,
      label: formatShortDate(d.dayKey),
      sales: d.sales,
      completedCount: d.completedCount,
      heightPct: axisMax > 0 ? Math.round((d.sales / axisMax) * 1000) / 10 : 0,
      isMax: i === maxIndex,
      isToday: d.dayKey === todayKey,
      labelLevel,
    };
  });

  const ticks: TrendModel['ticks'] = [];
  for (let v = 0; v <= axisMax + step / 1000; v += step) {
    ticks.push({
      value: v,
      text: formatCompact(v),
      bottomPct: axisMax > 0 ? Math.round((v / axisMax) * 1000) / 10 : 0,
    });
  }

  const totalCents = byDay.reduce((a, d) => a + centsOf(d.sales), 0);
  const total = totalCents / 100;
  const average = n > 0 ? Math.round(totalCents / n) / 100 : 0;

  let minPoint: TrendPoint | null = null;
  for (const p of points) if (!minPoint || p.sales < minPoint.sales) minPoint = p;

  return {
    points,
    ticks,
    axisMax,
    total,
    completedTotal: byDay.reduce((a, d) => a + d.completedCount, 0),
    average,
    averagePct: axisMax > 0 ? Math.round((average / axisMax) * 1000) / 10 : 0,
    hasSales: maxSales > 0,
    maxPoint: maxIndex >= 0 ? points[maxIndex] : null,
    minPoint,
  };
}

// ---------------------------------------------------------
// Text alternatives
// ---------------------------------------------------------

function prefix(demo: boolean): string {
  return demo ? 'Demo data: ' : '';
}

export function trendSummary(
  model: TrendModel,
  rangeLabel: string,
  demo: boolean
): string {
  if (!model.hasSales) {
    return `${prefix(demo)}Daily completed sales, ${rangeLabel}: no completed orders in this range.`;
  }
  const high = model.maxPoint!;
  const low = model.minPoint!;
  return (
    `${prefix(demo)}Daily completed sales, ${rangeLabel}. ` +
    `Total ${formatCurrency(model.total)} over ${model.points.length} days, ` +
    `average ${formatCurrency(model.average)} per day. ` +
    `Highest: ${high.label} (${formatCurrency(high.sales)}). ` +
    `Lowest: ${low.label} (${formatCurrency(low.sales)}).`
  );
}

export function barsSummary(
  heading: string,
  lines: string[],
  demo: boolean
): string {
  if (lines.length === 0) return `${prefix(demo)}${heading}: no data in this range.`;
  return `${prefix(demo)}${heading}. ${lines.join('; ')}.`;
}

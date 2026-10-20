// lib/chart-geometry.ts
//
// Pure view-model helpers for the line, donut and quarterly charts: path
// geometry, share rounding, and the quarterly bar model. No React, no I/O,
// no database. Business numbers are NOT calculated here: every input
// (daily sales, units sold, quarterly totals) comes from the existing KPI
// layer; this file only turns them into shapes and display text.

import { formatCurrency, formatPercent, formatShortDate } from '@/lib/format';
import { formatCompact, niceStep } from '@/lib/charts';
import type { QuarterSales } from '@/lib/quarterly';

/** The Warm Business chart palette. */
export const PALETTE = {
  deepOrange: '#963820',
  peach: '#E8A05A',
  gold: '#E8C878',
  mutedGreen: '#779B83',
  blueGrey: '#6F8DA8',
} as const;

// WCAG relative luminance / contrast, used to decide which colours need an
// outline to stay visible on the cream chart cards.
const CARD_BACKGROUND = '#fffcf7';

function luminance(hex: string): number {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Peach and Gold are too light to see on the cream cards (under 3:1), so any
 * bar, column, segment or swatch filled with one gets a thin Deep Orange
 * outline. Deep Orange, Blue Grey and Muted Green stand on their own.
 */
export function needsOutline(hex: string): boolean {
  return contrastRatio(hex, CARD_BACKGROUND) < 3;
}

export function outlineFor(hex: string): string {
  return needsOutline(hex) ? PALETTE.deepOrange : hex;
}

/** Inline style for a bar, column or swatch filled with `hex`. */
export function markStyle(hex: string): { backgroundColor: string; boxShadow?: string } {
  return needsOutline(hex)
    ? { backgroundColor: hex, boxShadow: `inset 0 0 0 1px ${PALETTE.deepOrange}` }
    : { backgroundColor: hex };
}

/**
 * Which colour each chart uses. Every chart has its own dominant colour so
 * charts stay visually distinct while sharing one palette:
 *   Sales trend       Deep Orange line over a soft Peach area; average = Blue Grey
 *   Top 3 donut       Deep Orange, Blue Grey, Gold (the most distinguishable
 *                     trio, including for colour-blind viewers)
 *   Quarterly sales   Blue Grey columns; Gold for quarters in progress / partial
 *   Top products      Muted Green bars
 *   Sales by category one colour per category, ordered so neighbouring bars
 *                     always contrast
 */
export const CHART_COLORS = {
  /** Trend line. */
  line: PALETTE.deepOrange,
  /** Soft shaded area under the trend line. */
  area: PALETTE.peach,
  /** Dashed average line on the trend chart. */
  average: PALETTE.blueGrey,
  /** Donut segments, biggest to smallest. */
  donut: [PALETTE.deepOrange, PALETTE.blueGrey, PALETTE.gold],
  /** Segment outlines (Deep Orange around light colours, otherwise the fill). */
  donutOutline: [
    outlineFor(PALETTE.deepOrange),
    outlineFor(PALETTE.blueGrey),
    outlineFor(PALETTE.gold),
  ],
  quarter: { complete: PALETTE.blueGrey, partial: PALETTE.gold },
  bars: {
    products: PALETTE.mutedGreen,
    categories: [
      PALETTE.deepOrange,
      PALETTE.gold,
      PALETTE.blueGrey,
      PALETTE.peach,
      PALETTE.mutedGreen,
    ],
  },
} as const;

// ---------------------------------------------------------
// Smooth line + area (monotone cubic interpolation)
// ---------------------------------------------------------

export type XY = { x: number; y: number };

const n2 = (v: number) => String(Math.round(v * 100) / 100);

/**
 * Smooth SVG path through the points using monotone cubic interpolation
 * (Fritsch-Carlson). Unlike a plain spline it never overshoots: between two
 * neighbouring points the curve stays between their values, so a day with
 * no sales never dips below the baseline and a peak never rises above itself.
 * Points must be in increasing x order.
 */
export function smoothLinePath(pts: XY[]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M ${n2(pts[0].x)} ${n2(pts[0].y)}`;
  if (n === 2) {
    return `M ${n2(pts[0].x)} ${n2(pts[0].y)} L ${n2(pts[1].x)} ${n2(pts[1].y)}`;
  }

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    slope.push((pts[i + 1].y - pts[i].y) / dx[i]);
  }

  const m: number[] = new Array(n).fill(0);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }
  // Clamp tangents so each segment stays monotone.
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / slope[i];
      const b = m[i + 1] / slope[i];
      const h = a * a + b * b;
      if (h > 9) {
        const t = 3 / Math.sqrt(h);
        m[i] = t * a * slope[i];
        m[i + 1] = t * b * slope[i];
      }
    }
  }

  let d = `M ${n2(pts[0].x)} ${n2(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d +=
      ` C ${n2(pts[i].x + h)} ${n2(pts[i].y + m[i] * h)}` +
      ` ${n2(pts[i + 1].x - h)} ${n2(pts[i + 1].y - m[i + 1] * h)}` +
      ` ${n2(pts[i + 1].x)} ${n2(pts[i + 1].y)}`;
  }
  return d;
}

/** Closed area between the smooth line and the baseline (y = 100). */
export function areaPath(pts: XY[], baseline: number = 100): string {
  if (pts.length < 2) return '';
  const last = pts[pts.length - 1];
  return `${smoothLinePath(pts)} L ${n2(last.x)} ${n2(baseline)} L ${n2(pts[0].x)} ${n2(baseline)} Z`;
}

// ---------------------------------------------------------
// Donut
// ---------------------------------------------------------

export type DonutSegment = {
  path: string;
  /** Share of the whole, 0..1. */
  fraction: number;
  startDeg: number;
  endDeg: number;
};

const polar = (cx: number, cy: number, r: number, deg: number): XY => {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

/**
 * Annular-sector paths for a donut, starting at 12 o'clock and going
 * clockwise. Sweeps are proportional to the values; a small gap separates
 * neighbouring segments. A single segment becomes a full ring.
 */
export function donutSegments(
  values: number[],
  opts: { cx?: number; cy?: number; outer?: number; inner?: number; gapDeg?: number } = {}
): DonutSegment[] {
  const { cx = 50, cy = 50, outer = 46, inner = 30, gapDeg = 2 } = opts;
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];

  const present = clean.filter((v) => v > 0).length;
  const out: DonutSegment[] = [];
  let angle = -90;

  for (const v of clean) {
    if (v <= 0) continue;
    const fraction = v / total;
    const sweep = fraction * 360;

    if (present === 1) {
      const top = cy - outer, bottom = cy + outer, itop = cy - inner, ibottom = cy + inner;
      out.push({
        path:
          `M ${cx} ${top} A ${outer} ${outer} 0 1 1 ${cx} ${bottom} A ${outer} ${outer} 0 1 1 ${cx} ${top} Z ` +
          `M ${cx} ${itop} A ${inner} ${inner} 0 1 0 ${cx} ${ibottom} A ${inner} ${inner} 0 1 0 ${cx} ${itop} Z`,
        fraction,
        startDeg: -90,
        endDeg: 270,
      });
      return out;
    }

    const gap = Math.min(gapDeg, sweep / 3);
    const start = angle + gap / 2;
    const end = angle + sweep - gap / 2;
    const large = end - start > 180 ? 1 : 0;
    const o1 = polar(cx, cy, outer, start), o2 = polar(cx, cy, outer, end);
    const i1 = polar(cx, cy, inner, start), i2 = polar(cx, cy, inner, end);
    out.push({
      path:
        `M ${n2(o1.x)} ${n2(o1.y)} A ${outer} ${outer} 0 ${large} 1 ${n2(o2.x)} ${n2(o2.y)} ` +
        `L ${n2(i2.x)} ${n2(i2.y)} A ${inner} ${inner} 0 ${large} 0 ${n2(i1.x)} ${n2(i1.y)} Z`,
      fraction,
      startDeg: start,
      endDeg: end,
    });
    angle += sweep;
  }
  return out;
}

/**
 * Percentage shares to one decimal that add up to exactly 100.0
 * (largest-remainder rounding), so the labels never show 99.9% or 100.1%.
 * Returns zeros when the total is 0.
 */
export function shareBreakdown(values: number[]): number[] {
  const total = values.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => ((v > 0 ? v : 0) / total) * 1000);
  const floors = exact.map(Math.floor);
  let remaining = 1000 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floors[i] += 1;
    remaining -= 1;
  }
  return floors.map((t) => t / 10);
}

// ---------------------------------------------------------
// Quarterly sales bars
// ---------------------------------------------------------

export type QuarterBar = {
  key: string;
  label: string; // "Q3 2026"
  /** Small second line under the label ("to date", "from 13 Aug", ...). */
  sub: string | null;
  sales: number;
  completedCount: number;
  heightPct: number;
  valueText: string; // compact, e.g. "12.4k"
  status: QuarterSales['status'];
  truncated: boolean;
  /** "+12.4%" when comparable, otherwise null. */
  changeText: string | null;
  changeTone: 'up' | 'down' | 'flat' | 'none';
  /** Why there is no comparison (null when there is one). */
  changeNote: string | null;
};

export type QuarterModel = {
  bars: QuarterBar[];
  ticks: { value: number; text: string; bottomPct: number }[];
  axisMax: number;
  total: number;
  hasSales: boolean;
};

export function buildQuarterModel(quarters: QuarterSales[]): QuarterModel {
  const maxSales = quarters.reduce((m, q) => Math.max(m, q.sales), 0);
  const step = niceStep(maxSales, 3);
  const axisMax = maxSales > 0 ? Math.ceil(maxSales / step) * step : step;

  const bars: QuarterBar[] = quarters.map((q) => {
    let sub: string | null = null;
    if (q.truncated) sub = 'incomplete';
    else if (q.status === 'in_progress') sub = 'to date';
    else if (q.status === 'partial_start' && q.coverageFrom) sub = `from ${formatShortDate(q.coverageFrom)}`;

    const pct = q.changePct;
    return {
      key: q.key,
      label: q.label,
      sub,
      sales: q.sales,
      completedCount: q.completedCount,
      heightPct: axisMax > 0 ? Math.round((q.sales / axisMax) * 1000) / 10 : 0,
      valueText: formatCompact(q.sales),
      status: q.status,
      truncated: q.truncated,
      changeText: pct === null ? null : formatPercent(pct),
      changeTone: pct === null ? 'none' : pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
      changeNote: pct === null ? q.changeNote : null,
    };
  });

  const ticks: QuarterModel['ticks'] = [];
  for (let v = 0; v <= axisMax + step / 1000; v += step) {
    ticks.push({
      value: v,
      text: formatCompact(v),
      bottomPct: axisMax > 0 ? Math.round((v / axisMax) * 1000) / 10 : 0,
    });
  }

  return {
    bars,
    ticks,
    axisMax,
    total: Math.round(quarters.reduce((a, q) => a + Math.round(q.sales * 100), 0)) / 100,
    hasSales: maxSales > 0,
  };
}

/** Text alternative for the quarterly chart. */
export function quarterlySummary(model: QuarterModel, demo: boolean): string {
  const prefix = demo ? 'Demo data: ' : '';
  if (!model.hasSales) return `${prefix}Quarterly sales: no completed orders yet.`;
  const parts = model.bars.map((b) => {
    const tags: string[] = [];
    if (b.status === 'in_progress') tags.push('quarter to date');
    if (b.status === 'partial_start' && b.sub) tags.push(`data ${b.sub}`);
    if (b.truncated) tags.push('not all orders loaded');
    const change = b.changeText ? `, ${b.changeText} vs previous quarter` : '';
    const tag = tags.length ? ` (${tags.join(', ')})` : '';
    return `${b.label}: ${formatCurrency(b.sales)}${tag}${change}`;
  });
  return `${prefix}Quarterly completed sales. ${parts.join('; ')}.`;
}

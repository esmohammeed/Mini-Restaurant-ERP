// Daily sales line chart: a smooth Deep Orange line over a light orange area
// on a white plot with subtle beige gridlines and minimal axes. Plain SVG and
// HTML/CSS (no chart library, no client JavaScript). The values come from
// lib/charts.ts (unchanged); lib/chart-geometry.ts only turns them into a
// path. A text summary and a data table are always provided as alternatives.

import { formatCurrency } from '@/lib/format';
import type { TrendModel } from '@/lib/charts';
import { areaPath, CHART_COLORS, smoothLinePath } from '@/lib/chart-geometry';
import { EmptyState } from '@/components/FormControls';
import { DemoTag } from '@/components/DemoBanner';

export default function TrendChart({
  model,
  title,
  subtitle,
  summary,
  demo,
  emptyMessage,
}: {
  model: TrendModel;
  title: string;
  /** Secondary heading text, e.g. the range label. */
  subtitle?: string;
  summary: string;
  demo: boolean;
  emptyMessage: string;
}) {
  // x centre of each day, as a percentage of the plot width. The date labels
  // below use equal-width cells, so they line up with these points exactly.
  const n = model.points.length;
  const xs = model.points.map((_, i) => ((i + 0.5) / n) * 100);
  const pts = model.points.map((p, i) => ({ x: xs[i], y: 100 - p.heightPct }));
  const line = n > 1 ? smoothLinePath(pts) : '';
  const area = n > 1 ? areaPath(pts) : '';

  return (
    <figure className="card chart-card">
      <figcaption className="chart-card-header">
        <span className="chart-title">{title}</span>
        {subtitle && <span className="chart-subtitle">{subtitle}</span>}
        {demo && <DemoTag />}
      </figcaption>

      {!model.hasSales ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <>
          <div className="chart-card-body">
          <div role="img" aria-label={summary}>
            <div className="rounded-lg border border-cream-200 bg-white px-3 pb-2 pt-5">
            <div className="flex gap-2">
              {/* y axis */}
              <div className="relative h-48 w-10 shrink-0 sm:h-56" aria-hidden="true">
                {model.ticks.map((t) => (
                  <span
                    key={t.value}
                    className="absolute right-0 translate-y-1/2 text-[10px] text-gray-500"
                    style={{ bottom: `${t.bottomPct}%` }}
                  >
                    {t.text}
                  </span>
                ))}
              </div>

              <div className="min-w-0 flex-1">
                {/* plot area: smooth line + light area in one stretched SVG */}
                <div className="relative h-48 sm:h-56" aria-hidden="true">
                  {model.ticks.map((t) => (
                    <div
                      key={t.value}
                      className={`absolute inset-x-0 border-t ${
                        t.value === 0 ? 'border-cream-300' : 'border-cream-200'
                      }`}
                      style={{ bottom: `${t.bottomPct}%` }}
                    />
                  ))}
                  <div
                    className="absolute inset-x-0 border-t border-dashed"
                    style={{
                      bottom: `${model.averagePct}%`,
                      borderColor: CHART_COLORS.average,
                    }}
                  />
                  <svg
                    className="absolute inset-0 h-full w-full overflow-visible"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    focusable="false"
                  >
                    <defs>
                      <linearGradient id="trend-area-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.area} stopOpacity="0.5" />
                        <stop offset="100%" stopColor={CHART_COLORS.area} stopOpacity="0.08" />
                      </linearGradient>
                    </defs>
                    {area && <path d={area} fill="url(#trend-area-fill)" />}
                    {line && (
                      <path
                        d={line}
                        fill="none"
                        stroke={CHART_COLORS.line}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </svg>
                  {model.points.map((p, i) =>
                    p.isMax || p.isToday ? (
                      <span
                        key={`m-${p.dayKey}`}
                        className="absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white"
                        style={{
                          left: `${xs[i]}%`,
                          bottom: `${p.heightPct}%`,
                          backgroundColor: CHART_COLORS.line,
                        }}
                      />
                    ) : null
                  )}
                  {model.points.map((p, i) =>
                    p.isMax ? (
                      <span
                        key={`v-${p.dayKey}`}
                        className={`absolute whitespace-nowrap rounded bg-white px-1 text-[10px] font-semibold tabular-nums text-gray-800 ${
                          xs[i] < 15
                            ? 'translate-x-[-15%]'
                            : xs[i] > 85
                              ? 'translate-x-[-85%]'
                              : '-translate-x-1/2'
                        }`}
                        style={{ left: `${xs[i]}%`, bottom: `calc(${p.heightPct}% + 12px)` }}
                      >
                        {formatCurrency(p.sales)}
                      </span>
                    ) : null
                  )}
                </div>

                {/* x axis labels (thinned on narrow screens) */}
                <div className="mt-1 flex" aria-hidden="true">
                  {model.points.map((p) => (
                    <div key={p.dayKey} className="relative h-5 flex-1">
                      {p.labelLevel !== 'none' && (
                        <span
                          className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-gray-500 sm:text-xs ${
                            p.labelLevel === 'wide' ? 'hidden sm:block' : ''
                          }`}
                        >
                          {p.label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </div>
          </div>

          <p className="mt-2 text-xs text-gray-500">
            Completed orders only. Dashed line: average{' '}
            {formatCurrency(model.average)} per day. Dots: highest day and the
            most recent day.
          </p>
          </div>

          <details className="chart-card-footer">
            <summary className="cursor-pointer text-brand-700 hover:underline">
              View data table
            </summary>
            <div className="mt-2 max-h-72 overflow-auto">
              <table className="table-base">
                <caption className="sr-only">
                  {subtitle ? `${title} · ${subtitle}` : title}: data table
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col" className="text-right">Completed orders</th>
                    <th scope="col" className="text-right">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {[...model.points].reverse().map((p) => (
                    <tr key={p.dayKey}>
                      <td>{p.label}</td>
                      <td className="text-right tabular-nums">{p.completedCount}</td>
                      <td className="text-right tabular-nums">{formatCurrency(p.sales)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="font-semibold text-gray-700">
                      Total
                    </th>
                    <td className="text-right font-semibold tabular-nums">{model.completedTotal}</td>
                    <td className="text-right font-semibold tabular-nums">{formatCurrency(model.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </details>
        </>
      )}
    </figure>
  );
}

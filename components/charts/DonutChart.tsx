// Top 3 best-selling products as a donut. Plain SVG/HTML (no chart library,
// no client JavaScript). Product names, units and shares are written next to
// the chart, so colour is never the only signal, and a text summary and a
// data table are always provided. Shares come from lib/chart-geometry.ts.

import { EmptyState } from '@/components/FormControls';
import { DemoTag } from '@/components/DemoBanner';
import { CHART_COLORS, donutSegments } from '@/lib/chart-geometry';

export type DonutItem = {
  label: string;
  units: number;
  /** Percent of the total units of the items shown, one decimal. */
  share: number;
};

export default function DonutChart({
  title,
  subtitle,
  demo,
  items,
  summary,
  emptyMessage,
}: {
  title: string;
  /** Secondary heading text, e.g. the range label. */
  subtitle?: string;
  demo: boolean;
  items: DonutItem[];
  summary: string;
  emptyMessage: string;
}) {
  const segments = donutSegments(items.map((i) => i.units));
  const totalUnits = items.reduce((a, i) => a + i.units, 0);

  return (
    <figure className="card chart-card">
      <figcaption className="chart-card-header">
        <span className="chart-title">{title}</span>
        {subtitle && <span className="chart-subtitle">{subtitle}</span>}
        {demo && <DemoTag />}
      </figcaption>

      {items.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <>
          <div className="chart-card-body">
            <div role="img" aria-label={summary}>
              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <div className="relative h-40 w-40 shrink-0" aria-hidden="true">
                  <svg viewBox="0 0 100 100" className="h-full w-full" focusable="false">
                    {segments.map((seg, i) => (
                      <path
                        key={items[i].label}
                        d={seg.path}
                        fill={CHART_COLORS.donut[i % CHART_COLORS.donut.length]}
                        stroke={CHART_COLORS.donutOutline[i % CHART_COLORS.donutOutline.length]}
                        strokeWidth="0.6"
                        fillRule="evenodd"
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-semibold tabular-nums text-gray-900">
                      {totalUnits}
                    </span>
                    <span className="text-[11px] text-gray-500">units sold</span>
                  </div>
                </div>

                <ol className="w-full min-w-0 flex-1 space-y-3" aria-hidden="true">
                  {items.map((it, i) => (
                    <li key={it.label} className="flex items-start gap-3">
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                        style={{
                          backgroundColor: CHART_COLORS.donut[i % CHART_COLORS.donut.length],
                          boxShadow: `inset 0 0 0 1px ${
                            CHART_COLORS.donutOutline[i % CHART_COLORS.donutOutline.length]
                          }`,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900" title={it.label}>
                          {it.label}
                        </p>
                        <p className="text-xs tabular-nums text-gray-500">
                          {it.units} units
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                        {it.share.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Share of units sold among these top products. Completed orders
              only.
            </p>
          </div>

          <details className="chart-card-footer">
            <summary className="cursor-pointer text-brand-700 hover:underline">
              View data table
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="table-base">
                <caption className="sr-only">
                  {subtitle ? `${title} · ${subtitle}` : title}: data table
                </caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Product</th>
                    <th scope="col" className="text-right">Units</th>
                    <th scope="col" className="text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.label}>
                      <td>{i + 1}</td>
                      <td>{it.label}</td>
                      <td className="text-right tabular-nums">{it.units}</td>
                      <td className="text-right tabular-nums">{it.share.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </figure>
  );
}

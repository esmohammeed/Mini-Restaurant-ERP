// Horizontal bar chart (used for Top products and Sales by category).
// Plain HTML/CSS, no chart library, no client JavaScript. Values are written
// next to every bar, so colour is never the only signal, and a text summary
// and data table are always provided.

import { EmptyState } from '@/components/FormControls';
import { DemoTag } from '@/components/DemoBanner';
import { CHART_COLORS, markStyle } from '@/lib/chart-geometry';

export type BarItem = {
  label: string;
  /** 0-100, relative to the largest bar. */
  widthPct: number;
  /** Main value shown on the right, e.g. "120 units" or "EGP 1,200.00". */
  value: string;
  /** Optional second line, e.g. "EGP 2,400.00 revenue". */
  detail?: string;
};

export default function BarChart({
  title,
  subtitle,
  demo,
  summary,
  bars,
  table,
  emptyMessage,
  fill = CHART_COLORS.bars.products,
}: {
  title: string;
  /** Secondary heading text, e.g. the range label. */
  subtitle?: string;
  demo: boolean;
  summary: string;
  bars: BarItem[];
  table: { headers: string[]; rows: string[][] };
  emptyMessage: string;
  /** Bar colour: one colour for every bar, or a list used in order (one per bar). */
  fill?: string | readonly string[];
}) {
  // Presentation only: right-align columns whose cells are all numbers.
  const NUMERIC = /^(EGP\s)?[-+]?[\d,]+(\.\d+)?%?$/;
  const numeric = table.headers.map(
    (h, j) =>
      h !== '#' &&
      table.rows.length > 0 &&
      table.rows.every((r) => NUMERIC.test(r[j] ?? ''))
  );

  return (
    <figure className="card chart-card">
      <figcaption className="chart-card-header">
        <span className="chart-title">{title}</span>
        {subtitle && <span className="chart-subtitle">{subtitle}</span>}
        {demo && <DemoTag />}
      </figcaption>

      {bars.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <>
          <div className="chart-card-body">
          <div role="img" aria-label={summary}>
            <ul className="space-y-3" aria-hidden="true">
              {bars.map((b, i) => (
                <li key={b.label}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-gray-700" title={b.label}>
                      {b.label}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-gray-900">
                      {b.value}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 w-full rounded-full bg-cream-200">
                    <div
                      className="h-2.5 rounded-full"
                      style={{
                        width: `${b.widthPct}%`,
                        ...markStyle(
                          typeof fill === 'string' ? fill : fill[i % fill.length]
                        ),
                      }}
                    />
                  </div>
                  {b.detail && (
                    <p className="mt-0.5 text-xs text-gray-500">{b.detail}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
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
                    {table.headers.map((h, j) => (
                      <th
                        key={h}
                        scope="col"
                        className={numeric[j] ? 'text-right' : undefined}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className={numeric[j] ? 'text-right tabular-nums' : undefined}
                        >
                          {cell}
                        </td>
                      ))}
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

// Quarterly sales column chart. Plain HTML/CSS (no chart library, no client
// JavaScript). Quarter totals and percentage changes come from
// lib/quarterly.ts; lib/chart-geometry.ts only turns them into heights and
// labels. A text summary and a data table are always provided.

import { formatCurrency } from '@/lib/format';
import type { QuarterModel } from '@/lib/chart-geometry';
import { EmptyState } from '@/components/FormControls';
import { DemoTag } from '@/components/DemoBanner';
import { CHART_COLORS, markStyle } from '@/lib/chart-geometry';

const TONE: Record<string, string> = {
  up: 'text-green-700',
  down: 'text-red-700',
  flat: 'text-gray-500',
};

export default function QuarterlyChart({
  title,
  subtitle,
  demo,
  model,
  summary,
  emptyMessage,
}: {
  title: string;
  /** Secondary heading text. */
  subtitle?: string;
  demo: boolean;
  model: QuarterModel;
  summary: string;
  emptyMessage: string;
}) {
  const n = model.bars.length;
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };

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
              <div className="flex gap-2">
                {/* y axis */}
                <div className="relative h-44 w-10 shrink-0 sm:h-52" aria-hidden="true">
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

                <div className="min-w-0 flex-1" aria-hidden="true">
                  <div className="relative h-44 sm:h-52">
                    {model.ticks.map((t) => (
                      <div
                        key={t.value}
                        className={`absolute inset-x-0 border-t ${
                          t.value === 0 ? 'border-cream-300' : 'border-cream-200'
                        }`}
                        style={{ bottom: `${t.bottomPct}%` }}
                      />
                    ))}
                    <div className="relative grid h-full" style={cols}>
                      {model.bars.map((b) => (
                        <div key={b.key} className="relative flex h-full items-end justify-center px-1.5">
                          <div
                            className="w-full max-w-[56px] rounded-t"
                            style={{
                              height: `${b.heightPct}%`,
                              ...markStyle(
                                b.status === 'complete' && !b.truncated
                                  ? CHART_COLORS.quarter.complete
                                  : CHART_COLORS.quarter.partial
                              ),
                            }}
                          />
                          <span
                            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums text-gray-800"
                            style={{ bottom: `calc(${b.heightPct}% + 4px)` }}
                          >
                            {b.valueText}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* labels: quarter, note, change vs previous quarter */}
                  <div className="mt-2 grid" style={cols}>
                    {model.bars.map((b) => (
                      <div key={b.key} className="px-0.5 text-center">
                        <p className="text-xs font-medium text-gray-800">{b.label}</p>
                        <p className="min-h-[14px] text-[10px] text-gray-500">{b.sub ?? ''}</p>
                        {b.changeText ? (
                          <p className={`text-[11px] font-semibold tabular-nums ${TONE[b.changeTone]}`}>
                            {b.changeText}
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-400">—</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Completed orders only, by order date (Cairo calendar quarters).
              The percentage compares a full quarter with the one before; a dash
              means no comparison is available. Gold columns are quarters in
              progress or with partial data.
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
                    <th scope="col">Quarter</th>
                    <th scope="col" className="text-right">Completed orders</th>
                    <th scope="col" className="text-right">Sales</th>
                    <th scope="col" className="text-right">Change</th>
                    <th scope="col">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {model.bars.map((b) => (
                    <tr key={b.key}>
                      <td>{b.label}</td>
                      <td className="text-right tabular-nums">{b.completedCount}</td>
                      <td className="text-right tabular-nums">{formatCurrency(b.sales)}</td>
                      <td className="text-right tabular-nums">{b.changeText ?? '—'}</td>
                      <td>
                        {b.truncated
                          ? 'Not all orders loaded (incomplete total)'
                          : b.status === 'in_progress'
                            ? 'Quarter to date (not compared)'
                            : b.status === 'partial_start'
                              ? `Data starts mid-quarter (${b.sub})`
                              : b.changeNote ?? 'Complete quarter'}
                      </td>
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

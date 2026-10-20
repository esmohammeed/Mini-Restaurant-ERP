export type KpiDelta = {
  text: string;
  trend: 'up' | 'down' | 'flat';
};

const DELTA_STYLES: Record<KpiDelta['trend'], string> = {
  up: 'text-green-700',
  down: 'text-red-700',
  flat: 'text-gray-500',
};

export default function KpiCard({
  label,
  value,
  tone = 'default',
  hint,
  delta,
  unavailable = false,
  badge,
  highlight = false,
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'warning';
  /** Small supporting line under the value. */
  hint?: string;
  /** Change versus the previous period, e.g. "+12.5% vs yesterday". */
  delta?: KpiDelta | null;
  /** Shows an em dash instead of the value (e.g. when its query failed). */
  unavailable?: boolean;
  /** Small tag next to the label, e.g. "DEMO". */
  badge?: string;
  /** Deep Orange surface. Use for ONE primary KPI only. */
  highlight?: boolean;
}) {
  // "EGP 12,345.00" -> small unit + prominent number, so long amounts stay
  // readable and wrap cleanly instead of overflowing the card.
  const money = typeof value === 'string' ? value.match(/^([A-Z]{3})\s(.+)$/) : null;

  const labelColor = highlight ? 'text-brand-100' : 'text-gray-500';
  const unitColor = highlight ? 'text-brand-100' : 'text-gray-500';
  const valueColor = unavailable
    ? highlight
      ? 'text-brand-200'
      : 'text-gray-300'
    : highlight
      ? 'text-cream-50'
      : tone === 'warning'
        ? 'text-brand-600'
        : 'text-gray-900';
  const hintColor = highlight ? 'text-brand-100' : 'text-gray-500';
  const deltaColor = highlight
    ? 'text-brand-50'
    : delta
      ? DELTA_STYLES[delta.trend]
      : '';

  return (
    <div className={highlight ? 'card card-highlight' : 'card'}>
      <p className={`text-sm ${labelColor}`}>
        {label}
        {badge && (
          <span
            className={
              highlight ? 'demo-badge demo-badge-inverse' : 'demo-badge'
            }
          >
            {badge}
          </span>
        )}
      </p>
      <p
        className={`mt-2 flex flex-wrap items-baseline gap-x-1.5 text-2xl font-semibold tabular-nums tracking-tight ${valueColor}`}
      >
        {unavailable ? (
          '—'
        ) : money ? (
          <>
            <span className={`text-sm font-medium ${unitColor}`}>{money[1]}</span>
            <span>{money[2]}</span>
          </>
        ) : (
          value
        )}
      </p>
      {hint && <p className={`mt-1 text-xs ${hintColor}`}>{hint}</p>}
      {delta && !unavailable && (
        <p className={`mt-1 text-xs font-medium ${deltaColor}`}>{delta.text}</p>
      )}
    </div>
  );
}

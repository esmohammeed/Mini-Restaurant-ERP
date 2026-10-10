export default function KpiCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className="card">
      <p className="text-sm text-gray-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          tone === 'warning' ? 'text-amber-600' : 'text-gray-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

const COLORS: Record<string, string> = {
  pending: 'bg-cream-200 text-gray-700',
  preparing: 'bg-brand-100 text-brand-800',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
  active: 'bg-green-50 text-green-700',
  inactive: 'bg-cream-200 text-gray-600',
  'In Stock': 'bg-green-50 text-green-700',
  'Low Stock': 'bg-brand-100 text-brand-800',
  'Out of Stock': 'bg-red-50 text-red-700',
};

export default function StatusBadge({ status }: { status: string }) {
  const classes = COLORS[status] ?? 'bg-cream-200 text-gray-600';
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${classes}`}
    >
      {status}
    </span>
  );
}

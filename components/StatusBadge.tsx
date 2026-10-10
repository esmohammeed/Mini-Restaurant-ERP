const COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  preparing: 'bg-blue-50 text-blue-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
  active: 'bg-green-50 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  'In Stock': 'bg-green-50 text-green-700',
  'Low Stock': 'bg-amber-50 text-amber-700',
  'Out of Stock': 'bg-red-50 text-red-700',
};

export default function StatusBadge({ status }: { status: string }) {
  const classes = COLORS[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${classes}`}
    >
      {status}
    </span>
  );
}

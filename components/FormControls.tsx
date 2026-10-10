export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

export function InlineMessage({
  type,
  message,
}: {
  type: 'error' | 'success';
  message: string;
}) {
  return (
    <p
      className={`text-sm rounded-lg px-3 py-2 mb-3 ${
        type === 'error'
          ? 'bg-red-50 text-red-700'
          : 'bg-green-50 text-green-700'
      }`}
    >
      {message}
    </p>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-sm text-gray-400">{message}</div>
  );
}

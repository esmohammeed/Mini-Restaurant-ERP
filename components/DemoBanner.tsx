// Visual labels for Demo Mode. Demo data must always be unmistakable.

export function DemoTag() {
  return (
    <span className="demo-badge">DEMO</span>
  );
}

export function DemoBanner({ clockLabel }: { clockLabel: string }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-brand-800"
    >
      <p className="text-sm">
        <strong className="font-semibold tracking-wide">DEMO DATA</strong>
        {' — '}simulated restaurant data for portfolio demonstration. It is not
        real business performance.
      </p>
      <p className="mt-1 text-xs text-brand-700">
        Nothing on this dashboard is read from your live orders, products or
        stock. Demo Mode applies to the Dashboard only: Orders, Products,
        Inventory, Suppliers and the AI Assistant always show live data. Demo
        clock: {clockLabel} (Cairo time).
      </p>
    </div>
  );
}

export function LiveNote() {
  return (
    <p className="text-xs text-gray-500">
      Live data from your database. Demo Mode applies to this Dashboard only.
    </p>
  );
}

// Demo | Live control. A plain form that submits to a Server Action, so it
// works without client-side JavaScript. The action is passed in as a prop
// so this component has no knowledge of routes, cookies or demo code.

export default function ModeToggle({
  mode,
  range,
  action,
}: {
  mode: 'demo' | 'live';
  range: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const base =
    'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';
  const on = 'bg-brand-600 text-white';
  const off = 'text-gray-600 hover:bg-cream-100';

  return (
    <form
      action={action}
      aria-label="Dashboard data source"
      className="inline-flex items-center gap-0.5 rounded-full border border-cream-300 bg-cream-50 p-0.5"
    >
      <input type="hidden" name="range" value={range} />
      <button
        type="submit"
        name="mode"
        value="demo"
        aria-pressed={mode === 'demo'}
        className={`${base} ${mode === 'demo' ? on : off}`}
      >
        Demo
      </button>
      <button
        type="submit"
        name="mode"
        value="live"
        aria-pressed={mode === 'live'}
        className={`${base} ${mode === 'live' ? on : off}`}
      >
        Live
      </button>
    </form>
  );
}

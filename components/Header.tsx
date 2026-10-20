import MobileNav from './MobileNav';

export default function Header({
  title,
  adminName,
}: {
  title: string;
  adminName?: string | null;
}) {
  return (
    <header className="relative sticky top-0 z-10 bg-cream-50 border-b border-cream-200 px-4 md:px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <MobileNav />
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>
      {adminName && (
        <span className="text-sm text-gray-500">{adminName}</span>
      )}
    </header>
  );
}

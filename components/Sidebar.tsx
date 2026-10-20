'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from './LogoutButton';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' },
  { href: '/products', label: 'Products' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/ai-assistant', label: 'AI Assistant' },
];

// Decorative background for the Deep Orange sidebar: thin arcs, hairlines and a
// few quiet shapes in lighter orange (Peach and orange from the chart/brand
// palette) at very low opacity. Two fixed-size SVGs sit in the top-right and
// bottom-left corners, so the pattern looks the same at any window height.
//
// It is purely decorative: aria-hidden, pointer-events-none (clicks pass
// straight through), and drawn BEHIND the content (-z-10 inside the aside's
// own stacking context), so text, active and hover states are never covered.
// Inline SVG only: no images, no dependencies, no animation.
const SHAPE_STROKE = '#E8A05A'; // Peach
const SHAPE_FILL = '#C0603F'; // orange (brand-400)

function SidebarDecoration() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 select-none"
    >
      {/* top-right: concentric arcs around the corner */}
      <svg
        className="absolute right-0 top-0"
        width="224"
        height="210"
        viewBox="0 0 224 210"
        fill="none"
        focusable="false"
      >
        <circle cx="224" cy="0" r="64" fill={SHAPE_FILL} fillOpacity="0.1" />
        <circle cx="224" cy="0" r="64" stroke={SHAPE_STROKE} strokeOpacity="0.14" />
        <circle cx="224" cy="0" r="104" stroke={SHAPE_STROKE} strokeOpacity="0.14" />
        <circle cx="224" cy="0" r="144" stroke={SHAPE_STROKE} strokeOpacity="0.1" />
        <circle cx="224" cy="0" r="184" stroke={SHAPE_STROKE} strokeOpacity="0.07" />
        <circle cx="162" cy="107.4" r="2.5" fill={SHAPE_STROKE} fillOpacity="0.18" />
        <circle cx="152.1" cy="147.4" r="4" stroke={SHAPE_STROKE} strokeOpacity="0.18" />
      </svg>

      {/* bottom-left: rings, a soft disc, hairlines and a small diamond */}
      <svg
        className="absolute bottom-0 left-0"
        width="224"
        height="320"
        viewBox="0 0 224 320"
        fill="none"
        focusable="false"
      >
        <circle cx="0" cy="320" r="56" fill={SHAPE_FILL} fillOpacity="0.15" />
        <circle cx="0" cy="320" r="80" stroke={SHAPE_STROKE} strokeOpacity="0.12" />
        <circle cx="0" cy="320" r="130" stroke={SHAPE_STROKE} strokeOpacity="0.11" />
        <circle cx="0" cy="320" r="180" stroke={SHAPE_STROKE} strokeOpacity="0.09" />
        <circle cx="0" cy="320" r="230" stroke={SHAPE_STROKE} strokeOpacity="0.07" />
        <line x1="64" y1="320" x2="224" y2="160" stroke={SHAPE_STROKE} strokeOpacity="0.09" />
        <line x1="104" y1="320" x2="224" y2="200" stroke={SHAPE_STROKE} strokeOpacity="0.09" />
        <line x1="144" y1="320" x2="224" y2="240" stroke={SHAPE_STROKE} strokeOpacity="0.09" />
        <rect
          x="168"
          y="70"
          width="26"
          height="26"
          transform="rotate(45 181 83)"
          stroke={SHAPE_STROKE}
          strokeOpacity="0.16"
        />
        <circle cx="181" cy="83" r="2.5" fill={SHAPE_STROKE} fillOpacity="0.18" />
      </svg>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 bg-brand-600 border-r border-brand-700 h-screen sticky top-0 isolate overflow-hidden">
      <SidebarDecoration />

      <div className="px-5 py-5 border-b border-brand-700">
        <p className="text-base font-semibold text-cream-50">Mini ERP</p>
        <p className="text-xs text-brand-100">Restaurant</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`block rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream-100 ${
                active
                  ? 'relative bg-cream-50 font-semibold text-brand-600 before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:rounded-full before:bg-brand-600'
                  : 'font-medium text-brand-100 hover:bg-brand-700 hover:text-cream-50'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-brand-700">
        <LogoutButton />
      </div>
    </aside>
  );
}

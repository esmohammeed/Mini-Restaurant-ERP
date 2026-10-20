'use client';

import { useState } from 'react';
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

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle navigation"
        className="rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-gray-700"
      >
        ☰
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full bg-brand-600 border-b border-brand-700 shadow-card z-10">
          <nav className="px-3 py-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
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
            <div className="pt-2 border-t border-brand-700">
              <LogoutButton />
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}

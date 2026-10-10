'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/orders': 'Orders',
  '/products': 'Products',
  '/inventory': 'Inventory',
  '/suppliers': 'Suppliers',
  '/ai-assistant': 'AI Assistant',
};

export default function DashboardShell({
  adminName,
  children,
}: {
  adminName?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title =
    Object.entries(TITLES).find(([path]) => pathname?.startsWith(path))?.[1] ??
    'Dashboard';

  return (
    <>
      <Header title={title} adminName={adminName} />
      <main className="p-4 md:p-6">{children}</main>
    </>
  );
}

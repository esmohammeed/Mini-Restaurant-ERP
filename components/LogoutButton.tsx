'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-brand-100 hover:bg-brand-700 hover:text-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream-100 disabled:opacity-50"
    >
      {loading ? 'Logging out…' : 'Logout'}
    </button>
  );
}

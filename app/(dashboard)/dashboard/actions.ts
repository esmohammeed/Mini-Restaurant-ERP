'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DASHBOARD_MODE_COOKIE } from '@/lib/dashboard-mode';
import { parseRange } from '@/lib/timezone';

// Sets the dashboard data-source preference. Nothing here touches the
// database; it only sets or clears one preference cookie.
//
//   mode = "live"  -> session cookie (no expiry: cleared when the browser
//                     session ends), httpOnly, sameSite=lax
//   anything else  -> cookie deleted, i.e. back to the Demo default
export async function setDashboardMode(formData: FormData) {
  const mode = String(formData.get('mode') ?? '');
  const range = parseRange(String(formData.get('range') ?? ''));

  const store = await cookies();
  if (mode === 'live') {
    store.set(DASHBOARD_MODE_COOKIE, 'live', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  } else {
    store.delete(DASHBOARD_MODE_COOKIE);
  }

  redirect(range === 'today' ? '/dashboard' : `/dashboard?range=${range}`);
}

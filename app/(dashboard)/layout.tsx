import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getSessionContext } from '@/lib/auth';
import DashboardShell from './dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, profileError } = await getSessionContext();

  // Only redirect when there is truly no session. A signed-in user
  // whose profiles row is missing must NOT be sent to /login:
  // middleware bounces signed-in users from /login back to
  // /dashboard, which created a silent redirect loop (blank page,
  // HTTP 200, no console errors).
  if (!user) {
    redirect('/login');
  }

  const adminName = profile?.full_name ?? user.email ?? null;

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <DashboardShell adminName={adminName}>
          {!profile && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Signed in as user {user.id}, but the profiles lookup returned
              no row for this session.{' '}
              {profileError
                ? `Query error: ${profileError.message}${
                    profileError.code ? ` (code ${profileError.code})` : ''
                  }.`
                : 'The query succeeded with zero rows, which usually means RLS is hiding the row from this session.'}{' '}
              Data below will appear empty until this is resolved.
            </p>
          )}
          {profile && !profile.is_active && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This profile is inactive, so data access is blocked by RLS.
            </p>
          )}
          {children}
        </DashboardShell>
      </div>
    </div>
  );
}

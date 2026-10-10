// lib/auth.ts
//
// Server-side helper for reading the current session. Access
// control itself is enforced by RLS + the is_admin() policies in
// Supabase — this is for UI purposes only (showing the admin's
// name, redirecting if there is no session).

import { createClient } from '@/lib/supabase/server';

export type CurrentProfile = {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
};

export type SessionContext = {
  user: { id: string; email?: string | null } | null;
  profile: CurrentProfile | null;
  // Set when the profiles query itself failed (e.g. RLS/permission
  // error), as opposed to succeeding with zero visible rows.
  profileError: { message: string; code?: string } | null;
};

// Returns the authenticated user AND (separately) their profile row.
// A signed-in user with no profile row is a valid, distinguishable
// state — callers must not treat it the same as "signed out".
export async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null, profileError: null };

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  // Previously this error was silently discarded, which made a
  // failing query indistinguishable from a missing row.
  if (error) {
    console.error('[auth] profiles lookup failed:', error.code, error.message);
  } else if (!profile) {
    console.error(
      `[auth] profiles lookup returned no row visible to user ${user.id} (missing row, or blocked by RLS)`
    );
  }

  return {
    user: { id: user.id, email: user.email },
    profile: profile ?? null,
    profileError: error
      ? { message: error.message, code: error.code }
      : null,
  };
}

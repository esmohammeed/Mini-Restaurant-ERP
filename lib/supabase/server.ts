// lib/supabase/server.ts
//
// Server-side Supabase client for use in Server Components,
// Route Handlers, and Server Actions. Uses the anon/publishable
// key — RLS (not this key) is what enforces access control.
// The service_role key must NEVER be used here or in any code
// that ships to the client.
//
// Requires (see .env.example):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can be called from a Server Component where
            // cookies cannot be set; safe to ignore if middleware
            // is refreshing the session.
          }
        },
      },
    }
  );
}

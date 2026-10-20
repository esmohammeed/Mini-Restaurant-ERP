// lib/dashboard-mode.ts
//
// Dashboard data-source mode. Dependency-free on purpose: it is imported by
// the Server Action and the page without pulling in any demo or database code.
//
//   - Demo is the default for every new browser session.
//   - Live is an explicit opt-in, remembered ONLY for the current browser
//     session (a session cookie with no expiry).
//   - Anything that is not exactly "live" resolves to Demo (fail-safe).

export type DashboardMode = 'demo' | 'live';

export const DASHBOARD_MODE_COOKIE = 'erp_dashboard_mode';

export function resolveMode(value: string | null | undefined): DashboardMode {
  return value === 'live' ? 'live' : 'demo';
}

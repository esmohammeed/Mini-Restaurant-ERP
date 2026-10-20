# Demo Mode and dashboard charts

The dashboard has two data sources:

| Mode | What it shows | When |
|---|---|---|
| **Demo** (default) | A simulated restaurant dataset, clearly labelled **DEMO DATA** | Every new browser session |
| **Live** | Your real Supabase data (the Phase 1 queries, unchanged) | Only after you choose **Live**, for the current browser session |

Demo Mode applies to the **Dashboard only**. Orders, Products, Inventory,
Suppliers and the AI Assistant always show live data.

## How to switch

Use the **Demo | Live** control at the top right of the dashboard. It keeps the
range you selected (Today / 7 days / 30 days).

- Choosing **Live** stores a session cookie (`erp_dashboard_mode=live`). It has
  no expiry, so it ends with the browser session. The next new session starts in
  Demo again. Note: a browser configured to "continue where you left off" may
  restore session cookies after a restart.
- Choosing **Demo** deletes the cookie.
- Anything that is not exactly `live` is treated as Demo.

## Why demo data cannot leak into Live (and the reverse)

1. **One switch point.** `lib/dashboard-data.ts` is the only module that imports
   `lib/demo/*`. Live code never imports demo code.
2. **The demo path never creates a Supabase client.** The page passes a lazy
   `getDb` factory that is only called in Live Mode. The demo functions take no
   database parameter and make no network, storage, cookie or write calls.
   (The login/session check in `middleware.ts` and the dashboard layout is
   separate and unchanged; it still verifies your session with Supabase.)
3. **Labels follow the data.** The DEMO banner and tags are driven by the `mode`
   inside the result that was actually rendered, never by the URL or cookie.
4. **Demo rows cannot be mistaken for live rows.** Demo order IDs look like
   `D-0042`; demo product, category and supplier IDs start at 1,000,000; demo
   tables have no action buttons.
5. **No caching across modes.** The page is `force-dynamic`.
6. **A failed Live query is never replaced by demo data.** It shows an error.

## Same definitions as Live

Demo figures are computed by the same pure functions as Live Mode (`lib/kpi.ts`):

- revenue counts completed orders only, dated by `created_at`, in Africa/Cairo days
- Total Orders counts every status
- low stock counts active products only (Low Stock or Out of Stock)

So the KPI cards, charts and data tables always agree with each other.

## The demo dataset

Generated in memory from a fixed seed, anchored to today's Cairo date, so the
same date always gives the same data, and the 7-day and 30-day ranges (and their
previous periods) are always full.

- 60 days of history; 5 categories; 16 products (1 discontinued); 3 demo suppliers
- about 35-75 orders a day, busiest Thursday to Saturday, mild growth, one busy
  day and one slow day
- about 85-90% completed, the rest cancelled; today also has pending and
  preparing orders, so every status is visible
- each order's total equals the sum of its lines; a price rise on two products
  shows that order lines keep the price at the time
- stock is a ledger (deliveries in, completed orders out, occasional write-offs).
  Only completed orders deduct stock, as in the real system. Stock is never
  negative.
- **Scripted for the demo:** at 19:59 on the last day, three active products get a
  simulated stock-count correction so low-stock alerts are always visible, and
  the discontinued product is left low to show that inactive products are
  excluded from alerts.
- only what your schema supports: no discounts, refunds, payment status or profit

**Demo clock:** fixed at 20:00 Africa/Cairo on today's date, whatever the real
time is. "Today" therefore covers 00:00 to 20:00 and is compared with a full
yesterday, which often shows a decline; Live Mode behaves the same way.

All demo numbers are simulated and are not real business performance.

## Charts

Plain HTML/CSS rendered on the server: no chart library, no client JavaScript,
no new dependency.

| Chart | Shows |
|---|---|
| Daily sales (7 and 30 days) | One column per day of completed sales, average line, highest day labelled, most recent day highlighted |
| Top 5 products | Horizontal bars by units sold, with revenue |
| Sales by category | Horizontal bars by revenue, with percentage share |

Accessibility: each chart has a visible title, a text summary for screen readers
(`role="img"` with an `aria-label`), values written next to the bars (colour is
never the only signal), and a **View data table** disclosure with the exact
numbers. Date labels are thinned on narrow screens. Empty states say "No
completed orders in this range".

## Palette

The warm cream and terracotta palette is defined once in `tailwind.config.ts`
(`brand` = terracotta, `cream`, and a warm `gray`) and `app/globals.css`, so every
existing page picks it up without layout changes. Text and graphic colours were
checked against WCAG contrast ratios.

## Files

New: `lib/demo/dataset.ts`, `lib/demo/dashboard.ts`, `lib/dashboard-mode.ts`,
`lib/dashboard-data.ts`, `lib/charts.ts`, `components/charts/TrendChart.tsx`,
`components/charts/BarChart.tsx`, `components/DemoBanner.tsx`,
`components/ModeToggle.tsx`, `app/(dashboard)/dashboard/actions.ts`,
`docs/demo-mode.md`.

Modified: `app/(dashboard)/dashboard/page.tsx`,
`app/(dashboard)/dashboard/loading.tsx`, `lib/kpi.ts` (one pure function
exported; no behaviour change), `components/KpiCard.tsx` (optional badge),
`tailwind.config.ts`, `app/globals.css`.

No database schema, RLS, grants, authentication, middleware or environment
variable was changed.

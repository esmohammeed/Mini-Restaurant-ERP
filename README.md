# Restaurant Mini ERP

A minimal, educational restaurant ERP: orders, products/categories,
inventory, suppliers, and a simple DB-backed AI assistant — built
with Next.js (App Router), TypeScript, Tailwind CSS, and Supabase.

## Status

Source is complete (Phase 1 ERD → Phase 2 Supabase schema → Phase 3
UI). **`npm install` / `npm run build` have not been run** in the
environment this was generated in (no network access to the npm
registry there) — see `docs/phase-3-erp-interface.md` for exactly
what that means and what to check once you build it for real.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

Before running the app, apply the database:

```bash
# In the Supabase SQL editor, or via the Supabase CLI:
supabase/migrations/0001_create_tables.sql
supabase/migrations/0002_functions_triggers.sql
supabase/migrations/0003_views.sql
supabase/migrations/0004_indexes.sql
supabase/migrations/0005_enable_rls.sql
supabase/migrations/0006_policies.sql
supabase/seed/seed.sql   -- optional demo data
```

Then create at least one user via Supabase Auth (sign-up or the
dashboard) so `handle_new_user()` creates a matching `profiles` row,
and sign in at `/login`.

## Structure

```
app/
  login/                  Login page + server action
  (dashboard)/            Protected route group
    layout.tsx            Sidebar + Header shell, re-checks auth
    dashboard/             4 KPI cards + recent orders
    orders/                 List, filter, create, status control
    products/                List, add/edit, categories, soft-deactivate
    inventory/               product_stock view, add/adjust stock
    suppliers/                List, add/edit, soft-deactivate
    ai-assistant/             Deterministic DB-backed Q&A
components/              Sidebar, Header, KpiCard, Modal, StatusBadge, etc.
lib/
  supabase/               client.ts, server.ts, middleware.ts
  auth.ts, format.ts, timezone.ts
middleware.ts            Route protection + session refresh
supabase/
  migrations/             Phase 2 schema (6 ordered files)
  seed/                   Demo data
docs/                    Phase 2 and Phase 3 documentation
```

## Key rules this UI follows

- Never writes `orders.total_amount` or `order_items.subtotal` — both
  come from the database (trigger / generated column).
- Never writes stock directly — all stock reads come from the
  `product_stock` view; all stock writes go through
  `inventory_transactions` (`IN` via Add Stock, `ADJUSTMENT` via
  Adjust Stock). Order completion/cancellation inventory movements
  are handled entirely by database triggers — the UI only ever
  updates `orders.status`.
- Products and suppliers are soft-deleted (`is_active = false`),
  never hard-deleted.

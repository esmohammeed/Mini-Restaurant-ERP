# Restaurant Mini ERP — Phase 2: Supabase Database Implementation

Status: **local implementation complete, not yet applied to a live Supabase project** (see "Manual Actions Required"). This environment has no network access and no Supabase project credentials, so nothing here was run against a real database — see Verification Results below for what that means concretely.

## 1. Tables

| Table | Purpose | PK |
|---|---|---|
| `profiles` | 1:1 with `auth.users`; role + active flag | `uuid` (= auth.users.id) |
| `categories` | Product grouping | `bigint identity` |
| `products` | Sellable items (no stored stock) | `bigint identity` |
| `suppliers` | Vendors | `bigint identity` |
| `orders` | Order header, denormalized `total_amount` | `bigint identity` |
| `order_items` | Order lines, historical `unit_price`, generated `subtotal` | `bigint identity` |
| `inventory_transactions` | Signed stock ledger (IN/OUT/ADJUSTMENT) | `bigint identity` |

Full column definitions are in `supabase/migrations/0001_create_tables.sql`.

## 2. Relationships

- `auth.users (1) — profiles (1)`
- `categories (1) — products (M)`, `ON DELETE RESTRICT`
- `products (1) — order_items (M)`, `ON DELETE RESTRICT`
- `orders (1) — order_items (M)`, `ON DELETE CASCADE`
- `profiles (1) — orders (M)` as creator, `ON DELETE SET NULL`
- `products (1) — inventory_transactions (M)`, `ON DELETE RESTRICT`
- `suppliers (1) — inventory_transactions (M)`, `ON DELETE RESTRICT`
- `orders (1) — inventory_transactions (M)`, `ON DELETE SET NULL`
- `profiles (1) — inventory_transactions (M)` as creator, `ON DELETE SET NULL`

## 3. Constraints

- `products.price >= 0`, `low_stock_threshold >= 0`
- `orders.status` in (`pending`, `preparing`, `completed`, `cancelled`)
- `orders.payment_method` in (`cash`, `card`)
- `orders.total_amount >= 0`
- `order_items.quantity > 0`, `unit_price >= 0`, `unique(order_id, product_id)`
- `inventory_transactions.transaction_type` in (`IN`, `OUT`, `ADJUSTMENT`)
- `inventory_transactions`: sign of `quantity` enforced to match `transaction_type` via `inventory_quantity_sign_matches_type` check constraint
- `profiles.role` in (`admin`, `manager`, `cashier`, `kitchen`)

## 4. Views

### `product_stock`
Derives `current_stock` and `stock_status` (`In Stock` / `Low Stock` / `Out of Stock`) from `inventory_transactions`, grouped by product. Created `WITH (security_invoker = true)` so it respects the querying user's RLS rather than the view owner's privileges. The ledger (`inventory_transactions`) remains the single source of truth; nothing is duplicated onto `products`.

## 5. Functions & Triggers

| Trigger | Fires on | Function | Behavior |
|---|---|---|---|
| `trg_products_updated_at` | `products` BEFORE UPDATE | `update_updated_at_column()` | Sets `updated_at = now()` |
| `trg_orders_updated_at` | `orders` BEFORE UPDATE | `update_updated_at_column()` | Sets `updated_at = now()` |
| `trg_order_items_recalc_total` | `order_items` AFTER INSERT/UPDATE/DELETE | `recalc_order_total()` | Recomputes `orders.total_amount` from `SUM(subtotal)`, 0 if none |
| `trg_orders_completion` | `orders` AFTER UPDATE OF status | `handle_order_completion()` | On transition to `completed`, inserts one `OUT` transaction per order item; guarded against duplicates |
| `trg_orders_cancellation` | `orders` AFTER UPDATE OF status | `handle_order_cancellation()` | On `completed → cancelled`, inserts compensating positive `ADJUSTMENT` rows; original `OUT` rows are preserved, guarded against duplicate compensation |
| `trg_auth_user_created` | `auth.users` AFTER INSERT | `handle_new_user()` | Creates a matching `profiles` row, default `role = 'admin'`, copies `full_name` from user metadata if present |
| `trg_profiles_guard_privilege` | `profiles` BEFORE UPDATE | `prevent_profile_privilege_escalation()` | Blocks a non-admin from changing their own `role` or `is_active` |

Helper function `public.is_admin()` — `SECURITY DEFINER`, fixed `search_path`, used by RLS policies to avoid recursive policy evaluation on `profiles`.

## 6. Row Level Security

RLS is enabled on all seven application tables (`0005_enable_rls.sql`). With RLS on and no matching policy, access is denied by default — so `anon` has **no policies at all** on any business table and is fully denied.

Policy summary (`0006_policies.sql`):
- `profiles`: a user may `SELECT`/`UPDATE` their own row; an admin may `SELECT`/`UPDATE` all rows. `role`/`is_active` changes by non-admins are additionally blocked by the trigger in §5 (defense in depth — RLS alone can't restrict individual columns). No client-facing `INSERT` policy; rows are created only via the `handle_new_user()` trigger.
- `categories`, `products`, `suppliers`, `orders`, `order_items`, `inventory_transactions`: full `SELECT/INSERT/UPDATE/DELETE` for `authenticated` users where `is_admin()` is true. No policy for any other role yet — extending to `manager`/`cashier`/`kitchen` is a future, additive change (new policies, no schema change).

No `service_role` key appears anywhere in this codebase; it is never used in client or server code shipped in this phase.

## 7. Auth Model

- Credentials live only in Supabase's managed `auth.users`.
- `public.profiles` is the app-facing 1:1 extension table, created automatically by trigger on signup.
- Today only the `admin` role is actually used; `manager`/`cashier`/`kitchen` exist in the check constraint so future role rollout needs no migration, only new RLS policies and UI.

## 8. Environment Variables

`.env.example` (committed, safe):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```
Real values go in `.env.local`, which is excluded via `.gitignore`. No `service_role` key or database password is used or referenced anywhere in this phase's code.

## 9. Application Connection

`lib/supabase/client.ts` and `lib/supabase/server.ts` set up the Supabase client for a Next.js App Router project using `@supabase/ssr`, reading only the two `NEXT_PUBLIC_*` variables above. These are infrastructure only — **no ERP UI, pages, or API routes were created in this phase.**

## 10. Seed Data

`supabase/seed/seed.sql` inserts: 4 categories, 7 products, 3 suppliers, and opening `IN` inventory transactions for each product. All `created_by` columns are left `NULL` in seed data — no fabricated user UUIDs were inserted, per the constraint that `created_by` must reference a genuine `auth.users`/`profiles` row.

## 11. Verification Results

No live Supabase project exists yet in this environment (no credentials, and outbound network access is disabled here), so nothing below was executed against a real database. Everything is a **local, static review of the SQL** — not a runtime test.

| # | Test | Result |
|---|---|---|
| A | Product Beef Burger, price 120, threshold 10 | NOT TESTED (present in seed.sql; not executed) |
| B | Inventory IN +50 → stock 50, In Stock | NOT TESTED |
| C | Order qty 3 @ 120 → subtotal/total 360 | NOT TESTED |
| D | Price change 120→150 leaves historical order at unit_price 120 / subtotal 360 | NOT TESTED |
| E | Complete order → inventory −3, stock 47 | NOT TESTED |
| F | Re-update completed order → no duplicate OUT, stock still 47 | NOT TESTED |
| G | completed → cancelled → compensation +3, stock 50, original −3 preserved | NOT TESTED |
| H | RLS: anon denied, active admin authorized | NOT TESTED |
| — | Client initialization / DB reachability / Auth reachability | NOT TESTED (no project URL/key available) |

Nothing above is claimed as passing. Once a Supabase project exists and migrations are applied (§12), each of these should be run for real before Phase 3 begins.

## 12. Manual Actions Required

These require access this environment does not have (a Supabase account/project and network access), so they must be done by you:

1. Create a Supabase project (or use an existing one).
2. In the Supabase SQL editor or via the Supabase CLI, run the migrations **in order**: `0001` → `0002` → `0003` → `0004` → `0005` → `0006`, then `supabase/seed/seed.sql`.
   - CLI equivalent, if you link this folder as a Supabase project: `supabase db push` (migrations) then run the seed file, or `supabase db reset` if using local dev with seeding configured.
3. Copy the project's URL and anon/publishable key into `.env.local` (create it from `.env.example`; it is git-ignored).
4. Create at least one real user via Supabase Auth (sign-up flow or dashboard) — this fires `handle_new_user()` and gives you a genuine `profiles` row to test admin access with.
5. Run verification tests A–H for real (SQL editor or a small script) and record actual PASS/FAIL results before proceeding to Phase 3.
6. Install `@supabase/ssr` (and `@supabase/supabase-js` as its peer dependency) in the actual Next.js project once one exists — no `package.json` was found in this environment, so dependencies were not installed here.

## 13. Timezone Note

All timestamp columns use `timestamptz`, stored in UTC internally by Postgres. Business-day boundaries for dashboard metrics (e.g., "today's sales") should be computed by converting to `Africa/Cairo` at query time (e.g., `created_at AT TIME ZONE 'Africa/Cairo'`), not by changing storage — this is a Phase 3 dashboard-query concern.

# Restaurant Mini ERP — Phase 3: Interface Documentation

## 1. What this phase delivers

A complete Next.js (App Router) + TypeScript + Tailwind UI over the
Phase 2 Supabase schema: Login, Dashboard, Orders, Products
(+ Categories), Inventory, Suppliers, AI Assistant, Logout. No
business tables were added or changed — Phase 2's schema is used
as-is.

## 2. Environment constraints (read this first)

This project was generated in a sandbox with **no outbound network
access** (the npm registry is blocked at the network layer) and
**no npm cache**, which was explicitly verified:

```
npm error code ENOTCACHED
npm error request to https://registry.npmjs.org/@supabase%2fssr failed:
  cache mode is 'only-if-cached' but no cached response is available.
```

Consequences, stated plainly:
- `npm install` has **not** been run. There is no `node_modules/`
  and no `package-lock.json` in this deliverable.
- `npm run build` has **not** been run. No TypeScript/Next.js
  compiler has verified this code.
- No live Supabase project exists in this sandbox either (same
  constraint as Phase 2), so nothing was exercised against a real
  database.

Everything below reflects a careful **manual** read-through of the
code for consistency (matching prop types, matching Supabase column
names to the Phase 2 schema, consistent imports), not a compiler or
runtime check. Please run `npm install && npm run build` yourself
after downloading — see §7 for what to watch for.

## 3. Pages

| Route | Purpose |
|---|---|
| `/login` | Email + password only, via a server action calling `supabase.auth.signInWithPassword` |
| `/dashboard` | 4 KPI cards (Today's Sales, Today's Orders, Total Products, Low Stock Items) + last 5 orders |
| `/orders` | Order list, one status filter, "+ New Order" modal, inline status control per row |
| `/products` | Product list with live stock/status, "+ Add Product", "Manage Categories" modal |
| `/inventory` | Reads `product_stock` directly; "+ Add Stock" (IN) and "Adjust Stock" (ADJUSTMENT) |
| `/suppliers` | Supplier list, add/edit, soft deactivate |
| `/ai-assistant` | Chat-style UI with 4 quick questions, deterministic DB-backed answers |

Route protection: `middleware.ts` refreshes the Supabase session on
every request and redirects unauthenticated requests to `/login`
(and authenticated requests away from `/login`). The `(dashboard)`
layout re-checks the session server-side as a second line of
defense before rendering any page.

## 4. Database integration — how each page maps to tables

- **Dashboard**: `orders` (today's sales/orders, Africa/Cairo boundary via `lib/timezone.ts`), `products` (active count), `product_stock` (low/out of stock count), `orders` (recent 5).
- **Orders**: reads `orders`; create flow inserts one `orders` row then N `order_items` rows and lets the DB trigger compute `total_amount`; status changes only ever `UPDATE orders SET status = ...` — inventory deduction/compensation is 100% trigger-driven, the UI never touches `inventory_transactions` on order completion/cancellation.
- **Products**: reads/writes `products` and `categories`; stock column is read from `product_stock`, never from `products` directly (there is no `current_stock` column, by design).
- **Inventory**: reads `product_stock`; writes only ever go to `inventory_transactions` with `transaction_type = 'IN'` (Add Stock) or `'ADJUSTMENT'` (Adjust Stock, signed quantity). Nothing ever writes to a stock column directly, because none exists.
- **Suppliers**: reads/writes `suppliers`, soft delete via `is_active`.
- **AI Assistant**: keyword-matches the question to one of 4 intents, then runs a normal Supabase query (`orders`, `order_items` joined to `products`, `product_stock`) and formats the result as text. No LLM, no vector store, no new tables — structured so a real LLM could later replace just the `detectIntent` step while reusing the same query functions as "tools".

## 5. Features Working (by code review — not yet runtime-verified)

| Feature | Status |
|---|---|
| Login / session / protected routes / logout | Implemented, NOT TESTED |
| Dashboard KPIs + recent orders | Implemented, NOT TESTED |
| Orders: list, filter, create, status change | Implemented, NOT TESTED |
| Products: list, add/edit, soft deactivate | Implemented, NOT TESTED |
| Categories: add/edit/deactivate (inside Products) | Implemented, NOT TESTED |
| Inventory: view `product_stock`, Add Stock, Adjust Stock | Implemented, NOT TESTED |
| Suppliers: list, add/edit, soft deactivate | Implemented, NOT TESTED |
| AI Assistant: 4 deterministic question types | Implemented, NOT TESTED |

## 6. Verification Results

Every item from the Phase 3 brief's verification list (login, product
creation, supplier creation, add stock, order creation/total,
pending→completed deduction, completed→cancelled restoration,
logged-out protection, logout redirect) is **NOT TESTED**, for the
same reason as Phase 2: no live Supabase project and no network
access exist in this sandbox. Nothing here is reported as passing.

## 7. Build

**NOT RUN.** `npm install` fails immediately in this sandbox
(registry blocked, empty cache — see §2 for the exact error). No
attempt was made to fake or approximate a build result.

When you run it yourself, the most likely sources of friction to
check first (ordinary Next.js/Supabase integration points, not known
bugs):
- Exact current versions of `next`, `@supabase/ssr`, and
  `@supabase/supabase-js` — this project pins specific versions in
  `package.json` that were current as of this assistant's training
  data; `npm install` will tell you if any are deprecated/yanked.
- The embedded-relation syntax used in a few queries (e.g.
  `products.select('..., categories(name)')`,
  `order_items.select('..., products(name)')`) depends on
  PostgREST correctly inferring the single foreign key between
  those tables — it should, since each pair has exactly one FK, but
  worth confirming against the actual schema once migrated.
- `middleware.ts` matcher/cookie handling is the standard
  `@supabase/ssr` Next.js App Router pattern, but Supabase's exact
  recommended snippet does shift between library versions — worth
  diffing against their current docs if you hit auth/cookie issues.

## 7a. Hydration fix on `/login` (post-delivery)

**Symptom:** "Hydration failed" reported on `/login` only.

**Root cause:** `/login` is the only page with email/password inputs,
which are the specific target of browser extensions (password
managers, Grammarly, etc.). These extensions scan and mutate input
DOM nodes — adding attributes such as `fdprocessedid`,
`data-lpignore`, `data-1p-ignore`, `data-gr-ext-installed` — in the
brief window between the server-rendered HTML being painted and
React hydrating on the client. React then finds attributes on those
nodes that weren't present in what it rendered server-side and
throws a hydration mismatch. This is a well-known Next.js/React
scenario and not a logic bug in the component: the login page tree
(`app/layout.tsx` → `app/login/page.tsx` → `components/FormControls.tsx`)
was checked and contains no `Date.now()`, `Math.random()`, or
`typeof window` branching that could produce a genuine server/client
output difference — `lib/timezone.ts`'s `new Date()` default is never
on the `/login` render path (only `dashboard` and `ai-assistant` use
it, as Server Components, which is not subject to this failure mode).

**Fix applied (no schema/Supabase changes):**
- `app/layout.tsx`: added `suppressHydrationWarning` to `<html>` and
  `<body>` — the standard root-level mitigation Next.js recommends
  for extension-injected attributes.
- `app/login/page.tsx`: added `suppressHydrationWarning` directly on
  the email and password `<input>` elements (the actual nodes
  extensions mutate), plus `autoComplete="email"` /
  `autoComplete="current-password"` — correct form semantics that
  also reduce how aggressively some password managers rewrite the
  field.

`suppressHydrationWarning` only silences the mismatch warning for
that element's own attributes; it does not hide mismatches in
children or elsewhere, so it's safe and scoped to exactly the nodes
at risk here.

## 8. Known simplifications vs. the brief

- Orders' "Actions" column implements status change inline (a
  dropdown) rather than a separate "View" action — given the
  extreme-simplicity goal and that every order field is already
  visible in the row, a separate detail view was judged to add a
  page without adding information. Easy to split out later if
  wanted.
- `package-lock.json` is not included (no network to generate a
  real one); running `npm install` locally will create it.

## 7b. Blank `/dashboard` fix (post-delivery)

**Symptom:** `GET /dashboard 200`, completely blank page, no console errors.

**Root cause:** `app/(dashboard)/layout.tsx` called `redirect('/login')`
whenever the `profiles` row lookup returned nothing — even for a
fully signed-in user. `lib/supabase/middleware.ts` then redirects any
signed-in user on `/login` back to `/dashboard`, so the two rules
formed a redirect loop. Because the redirect fires inside a streamed
server layout after the 200 status is sent, it surfaces as a blank
page with a 200 and no console error rather than a redirect-loop
error. A signed-in user has no profile row when the user was created
before the `handle_new_user` trigger existed, or the trigger failed.

**Fix:** the layout now redirects only when there is no session. A
signed-in user without a profile renders the shell with an inline
warning (data stays empty because RLS `is_admin()` is false). Files:
`lib/auth.ts` (`getCurrentProfile` → `getSessionContext`, `.single()` →
`.maybeSingle()`), `app/(dashboard)/layout.tsx`.

## 7c. Profile lookup diagnostics (post-delivery)

The profile lookup in `lib/auth.ts` discarded the Supabase `error`, so
"query failed" and "zero rows visible" looked identical, and the
banner wrongly claimed the row did not exist. It now returns
`profileError`, logs to the server terminal, and the banner shows the
user id plus the real error (or the zero-rows case). No DB changes.

## 7d. `permission denied for table profiles` (post-delivery)

**Cause:** a missing table GRANT, not a policy bug. Postgres checks
privileges before RLS; with no SELECT privilege for `authenticated`
the query errors (42501) and the 0006 policies are never evaluated.
The policies and `is_admin()` were reviewed and are logically sound
(`is_admin()` is SECURITY DEFINER, so no recursion with
`profiles_select_*`).

**Fix:** new `supabase/migrations/0007_grants.sql` (idempotent):
revokes everything from `anon`, grants `authenticated` the needed
table/view privileges and EXECUTE on `is_admin()`. RLS stays enabled;
no policy, table, or data was changed. **Run it once in the Supabase
SQL editor.**

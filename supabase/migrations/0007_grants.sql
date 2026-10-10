-- =========================================================
-- Migration 0007: Table/view/function privileges
-- Restaurant Mini ERP — Phase 2 fix
--
-- WHY: Postgres checks GRANT privileges BEFORE row level
-- security. "permission denied for table profiles" (SQLSTATE
-- 42501) means the `authenticated` role has no SELECT privilege
-- on the table at all, so the RLS policies in 0006 were never
-- even evaluated. (A pure RLS block returns zero rows, not an
-- error.) The 0006 policies themselves are correct and are NOT
-- changed here.
--
-- Security model is unchanged:
--   - anon: no privileges on any ERP table/view (revoked explicitly)
--   - authenticated: table privileges granted, but every row is
--     still filtered by the RLS policies in 0006
--   - RLS stays enabled on every table
--
-- Idempotent: safe to run more than once. No schema/data changes.
-- =========================================================

-- anon gets nothing on ERP objects
revoke all on table
  public.profiles,
  public.categories,
  public.products,
  public.suppliers,
  public.orders,
  public.order_items,
  public.inventory_transactions
from anon;
revoke all on table public.product_stock from anon;

-- profiles: read own/all (policy decides), update (policy + trigger
-- guard role/is_active). No INSERT/DELETE: rows are created only by
-- the handle_new_user() trigger.
grant select, update on table public.profiles to authenticated;

-- business tables: full CRUD at privilege level; RLS (is_admin())
-- restricts it to active admins.
grant select, insert, update, delete on table
  public.categories,
  public.products,
  public.suppliers,
  public.orders,
  public.order_items,
  public.inventory_transactions
to authenticated;

-- derived stock view (security_invoker: underlying RLS applies)
grant select on table public.product_stock to authenticated;

-- RLS helper used inside policies
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------
-- Read-only checks to run afterwards in the SQL editor:
--   select grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_schema='public' and table_name='profiles';
--   -- expect: authenticated SELECT, UPDATE; nothing for anon
--
--   select relname, relrowsecurity from pg_class
--   where relname in ('profiles','orders','products');
--   -- expect relrowsecurity = true for all
-- ---------------------------------------------------------

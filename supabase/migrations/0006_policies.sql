-- =========================================================
-- Migration 0006: RLS Policies
-- Restaurant Mini ERP — Phase 2
--
-- Principles:
--  - anon: no policies at all -> fully denied on every table.
--  - authenticated + active admin (public.is_admin()): full
--    SELECT/INSERT/UPDATE/DELETE on business tables.
--  - profiles: a user may always read their own row; only an
--    admin may read all profiles. Role/is_active are further
--    protected by the trigger in 0002 (defense in depth).
--  - is_admin() is SECURITY DEFINER (see 0002) specifically to
--    avoid infinite recursion when profiles' own policy needs
--    to query profiles.
-- =========================================================

-- ---------------------------------------------------------
-- profiles
-- ---------------------------------------------------------
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy profiles_select_admin_all
  on public.profiles for select
  to authenticated
  using (public.is_admin());

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_admin_all
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Note: INSERT into profiles happens only via the handle_new_user()
-- trigger (SECURITY DEFINER), so no INSERT policy is granted to
-- regular clients.

-- ---------------------------------------------------------
-- categories
-- ---------------------------------------------------------
create policy categories_admin_all
  on public.categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------
-- products
-- ---------------------------------------------------------
create policy products_admin_all
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------
create policy suppliers_admin_all
  on public.suppliers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------
-- orders
-- ---------------------------------------------------------
create policy orders_admin_all
  on public.orders for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------
-- order_items
-- ---------------------------------------------------------
create policy order_items_admin_all
  on public.order_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------
-- inventory_transactions
-- ---------------------------------------------------------
create policy inventory_transactions_admin_all
  on public.inventory_transactions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------
-- product_stock is a view; it inherits RLS from its underlying
-- tables because it was created WITH (security_invoker = true)
-- in 0003_views.sql. No separate policy is needed or possible
-- on a view itself.
-- ---------------------------------------------------------

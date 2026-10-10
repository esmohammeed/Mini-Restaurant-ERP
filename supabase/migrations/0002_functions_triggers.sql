-- =========================================================
-- Migration 0002: Functions & Triggers
-- Restaurant Mini ERP — Phase 2
-- =========================================================

-- ---------------------------------------------------------
-- 1. Generic updated_at maintainer
-- ---------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------
-- 2. Keep orders.total_amount in sync with order_items
-- ---------------------------------------------------------
create or replace function public.recalc_order_total()
returns trigger
language plpgsql
as $$
declare
  target_order_id bigint;
begin
  target_order_id := coalesce(new.order_id, old.order_id);

  update public.orders
  set total_amount = coalesce(
    (select sum(subtotal) from public.order_items where order_id = target_order_id),
    0
  )
  where id = target_order_id;

  return null; -- AFTER trigger, return value ignored
end;
$$;

drop trigger if exists trg_order_items_recalc_total on public.order_items;
create trigger trg_order_items_recalc_total
after insert or update or delete on public.order_items
for each row execute function public.recalc_order_total();

-- ---------------------------------------------------------
-- 3. Deduct inventory when an order becomes 'completed'
--    Idempotent: guarded by status transition AND a check that
--    no OUT transactions already exist for this order.
-- ---------------------------------------------------------
create or replace function public.handle_order_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    if not exists (
      select 1 from public.inventory_transactions
      where order_id = new.id and transaction_type = 'OUT'
    ) then
      insert into public.inventory_transactions
        (product_id, transaction_type, quantity, order_id, notes, created_by)
      select
        oi.product_id,
        'OUT',
        -oi.quantity,
        new.id,
        'Auto deduction on order completion (order #' || new.id || ')',
        new.created_by
      from public.order_items oi
      where oi.order_id = new.id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_completion on public.orders;
create trigger trg_orders_completion
after update of status on public.orders
for each row execute function public.handle_order_completion();

-- ---------------------------------------------------------
-- 4. Compensate inventory when a completed order is cancelled
--    Idempotent: guarded by status transition AND a check that
--    no compensating ADJUSTMENT already exists for this order.
--    Historical OUT rows are preserved (not deleted/modified).
-- ---------------------------------------------------------
create or replace function public.handle_order_cancellation()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' and old.status = 'completed' then
    if not exists (
      select 1 from public.inventory_transactions
      where order_id = new.id and transaction_type = 'ADJUSTMENT'
    ) then
      insert into public.inventory_transactions
        (product_id, transaction_type, quantity, order_id, notes, created_by)
      select
        it.product_id,
        'ADJUSTMENT',
        -it.quantity, -- compensates the original negative OUT with a positive value
        new.id,
        'Compensation for cancelled order (order #' || new.id || ')',
        new.created_by
      from public.inventory_transactions it
      where it.order_id = new.id
        and it.transaction_type = 'OUT';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_cancellation on public.orders;
create trigger trg_orders_cancellation
after update of status on public.orders
for each row execute function public.handle_order_cancellation();

-- ---------------------------------------------------------
-- 5. Auto-create a profile row whenever a new auth.users row appears
--    SECURITY DEFINER + fixed search_path per Supabase best practice.
-- ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, is_active)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    'admin',
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------
-- 6. is_admin() helper for RLS policies
--    SECURITY DEFINER avoids recursive RLS evaluation on profiles.
-- ---------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

-- ---------------------------------------------------------
-- 7. Guard against privilege escalation:
--    non-admins cannot change their own role or is_active.
-- ---------------------------------------------------------
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
      raise exception 'Only an admin can change role or is_active on a profile';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard_privilege on public.profiles;
create trigger trg_profiles_guard_privilege
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

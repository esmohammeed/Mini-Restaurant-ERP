-- =========================================================
-- Migration 0001: Core Tables
-- Restaurant Mini ERP — Phase 2
-- =========================================================
-- Creates: profiles, categories, products, suppliers,
--          orders, order_items, inventory_transactions
-- =========================================================

-- ---------------------------------------------------------
-- profiles
-- 1:1 with auth.users. Never stores passwords/secrets.
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'admin'
              check (role in ('admin', 'manager', 'cashier', 'kitchen')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'App-level user profile, 1:1 with auth.users. Holds role and active flag only.';

-- ---------------------------------------------------------
-- categories
-- ---------------------------------------------------------
create table if not exists public.categories (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------
-- products
-- No current_stock column: stock is derived (see product_stock view).
-- ---------------------------------------------------------
create table if not exists public.products (
  id                  bigint generated always as identity primary key,
  name                text not null,
  category_id         bigint references public.categories(id) on delete restrict,
  price               numeric(10,2) not null check (price >= 0),
  low_stock_threshold integer not null default 10 check (low_stock_threshold >= 0),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------
create table if not exists public.suppliers (
  id          bigint generated always as identity primary key,
  name        text not null,
  phone       text,
  email       text,
  address     text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------
-- orders
-- total_amount is denormalized and kept in sync by trigger
-- (see 0002_functions_triggers.sql).
-- ---------------------------------------------------------
create table if not exists public.orders (
  id              bigint generated always as identity primary key,
  customer_name   text,
  status          text not null default 'pending'
                  check (status in ('pending', 'preparing', 'completed', 'cancelled')),
  payment_method  text not null default 'cash'
                  check (payment_method in ('cash', 'card')),
  total_amount    numeric(10,2) not null default 0 check (total_amount >= 0),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------
-- order_items
-- unit_price is copied at insert time to preserve historical
-- pricing accuracy; subtotal is a stored generated column.
-- ---------------------------------------------------------
create table if not exists public.order_items (
  id          bigint generated always as identity primary key,
  order_id    bigint not null references public.orders(id) on delete cascade,
  product_id  bigint not null references public.products(id) on delete restrict,
  quantity    integer not null check (quantity > 0),
  unit_price  numeric(10,2) not null check (unit_price >= 0),
  subtotal    numeric(10,2) generated always as (quantity * unit_price) stored,
  unique (order_id, product_id)
);

-- ---------------------------------------------------------
-- inventory_transactions
-- Signed ledger: IN positive, OUT negative, ADJUSTMENT non-zero
-- (either sign). This is the single source of truth for stock.
-- ---------------------------------------------------------
create table if not exists public.inventory_transactions (
  id                bigint generated always as identity primary key,
  product_id        bigint not null references public.products(id) on delete restrict,
  transaction_type  text not null check (transaction_type in ('IN', 'OUT', 'ADJUSTMENT')),
  quantity          integer not null check (quantity <> 0),
  supplier_id       bigint references public.suppliers(id) on delete restrict,
  order_id          bigint references public.orders(id) on delete set null,
  notes             text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),

  constraint inventory_quantity_sign_matches_type check (
    (transaction_type = 'IN'         and quantity > 0) or
    (transaction_type = 'OUT'        and quantity < 0) or
    (transaction_type = 'ADJUSTMENT' and quantity <> 0)
  )
);

comment on column public.inventory_transactions.quantity is
  'Signed quantity. IN must be positive, OUT must be negative, ADJUSTMENT any non-zero value.';

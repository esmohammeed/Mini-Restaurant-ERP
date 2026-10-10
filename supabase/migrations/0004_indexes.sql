-- =========================================================
-- Migration 0004: Indexes
-- Restaurant Mini ERP — Phase 2
-- Only indexes that support real, expected query patterns
-- (dashboard filters, joins, FKs) are created.
-- =========================================================

create index if not exists idx_products_category_id
  on public.products (category_id);

create index if not exists idx_orders_created_at
  on public.orders (created_at);

create index if not exists idx_orders_status
  on public.orders (status);

create index if not exists idx_orders_created_by
  on public.orders (created_by);

create index if not exists idx_order_items_order_id
  on public.order_items (order_id);

create index if not exists idx_order_items_product_id
  on public.order_items (product_id);

create index if not exists idx_inventory_transactions_product_created
  on public.inventory_transactions (product_id, created_at);

create index if not exists idx_inventory_transactions_order_id
  on public.inventory_transactions (order_id);

create index if not exists idx_inventory_transactions_supplier_id
  on public.inventory_transactions (supplier_id);

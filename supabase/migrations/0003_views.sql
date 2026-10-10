-- =========================================================
-- Migration 0003: Views
-- Restaurant Mini ERP — Phase 2
-- =========================================================

-- ---------------------------------------------------------
-- product_stock
-- Derives current stock from the inventory_transactions ledger.
-- The ledger remains the single source of truth; this view is
-- read-only and never stored/duplicated on the products table.
--
-- security_invoker = true ensures the view respects the RLS
-- policies of the querying user rather than the view owner's.
-- ---------------------------------------------------------
create or replace view public.product_stock
with (security_invoker = true) as
select
  p.id                    as product_id,
  p.name                  as product_name,
  p.low_stock_threshold,
  coalesce(sum(it.quantity), 0)::integer as current_stock,
  case
    when coalesce(sum(it.quantity), 0) <= 0 then 'Out of Stock'
    when coalesce(sum(it.quantity), 0) <= p.low_stock_threshold then 'Low Stock'
    else 'In Stock'
  end as stock_status
from public.products p
left join public.inventory_transactions it on it.product_id = p.id
group by p.id, p.name, p.low_stock_threshold;

comment on view public.product_stock is
  'Derived stock levels per product from inventory_transactions. Source of truth is the ledger, not a stored column.';

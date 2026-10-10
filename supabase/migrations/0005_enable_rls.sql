-- =========================================================
-- Migration 0005: Enable Row Level Security
-- Restaurant Mini ERP — Phase 2
-- With RLS enabled and no policies, all access is denied by
-- default (including to service roles bypass aside). Policies
-- are added in 0006_policies.sql.
-- =========================================================

alter table public.profiles                enable row level security;
alter table public.categories              enable row level security;
alter table public.products                enable row level security;
alter table public.suppliers               enable row level security;
alter table public.orders                  enable row level security;
alter table public.order_items             enable row level security;
alter table public.inventory_transactions  enable row level security;

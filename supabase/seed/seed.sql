-- =========================================================
-- Seed Data (small demo set)
-- Restaurant Mini ERP — Phase 2
--
-- No fake auth.users / created_by UUIDs are inserted. All
-- created_by columns are left NULL for seed rows, since a
-- real created_by must reference a genuine authenticated user.
-- =========================================================

-- ---------------------------------------------------------
-- Categories
-- ---------------------------------------------------------
insert into public.categories (name, description) values
  ('Burgers', 'Grilled and fried burgers'),
  ('Pizza',   'Oven-baked pizzas'),
  ('Drinks',  'Cold beverages'),
  ('Desserts','Sweet items')
on conflict (name) do nothing;

-- ---------------------------------------------------------
-- Products
-- ---------------------------------------------------------
insert into public.products (name, category_id, price, low_stock_threshold)
select 'Beef Burger', c.id, 120.00, 10 from public.categories c where c.name = 'Burgers'
union all
select 'Chicken Burger', c.id, 100.00, 10 from public.categories c where c.name = 'Burgers'
union all
select 'Margherita Pizza', c.id, 150.00, 8 from public.categories c where c.name = 'Pizza'
union all
select 'Pepperoni Pizza', c.id, 170.00, 8 from public.categories c where c.name = 'Pizza'
union all
select 'Pepsi', c.id, 20.00, 24 from public.categories c where c.name = 'Drinks'
union all
select 'Orange Juice', c.id, 25.00, 24 from public.categories c where c.name = 'Drinks'
union all
select 'Chocolate Cake', c.id, 60.00, 5 from public.categories c where c.name = 'Desserts'
on conflict do nothing;

-- ---------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------
insert into public.suppliers (name, phone, email, address) values
  ('Fresh Meat Co.',        '+20-100-000-0001', 'sales@freshmeat.example',        'Cairo, Egypt'),
  ('Cheese & Dairy Ltd.',   '+20-100-000-0002', 'orders@cheesedairy.example',     'Giza, Egypt'),
  ('Beverage Distributors', '+20-100-000-0003', 'contact@bevdist.example',        '6th of October City, Egypt')
on conflict do nothing;

-- ---------------------------------------------------------
-- Opening inventory (IN transactions)
-- created_by intentionally left NULL — no fake user IDs.
-- ---------------------------------------------------------
insert into public.inventory_transactions (product_id, transaction_type, quantity, supplier_id, notes)
select p.id, 'IN', 50, s.id, 'Opening stock (seed)'
from public.products p, public.suppliers s
where p.name = 'Beef Burger' and s.name = 'Fresh Meat Co.'
union all
select p.id, 'IN', 50, s.id, 'Opening stock (seed)'
from public.products p, public.suppliers s
where p.name = 'Chicken Burger' and s.name = 'Fresh Meat Co.'
union all
select p.id, 'IN', 30, s.id, 'Opening stock (seed)'
from public.products p, public.suppliers s
where p.name = 'Margherita Pizza' and s.name = 'Cheese & Dairy Ltd.'
union all
select p.id, 'IN', 30, s.id, 'Opening stock (seed)'
from public.products p, public.suppliers s
where p.name = 'Pepperoni Pizza' and s.name = 'Cheese & Dairy Ltd.'
union all
select p.id, 'IN', 100, s.id, 'Opening stock (seed)'
from public.products p, public.suppliers s
where p.name = 'Pepsi' and s.name = 'Beverage Distributors'
union all
select p.id, 'IN', 100, s.id, 'Opening stock (seed)'
from public.products p, public.suppliers s
where p.name = 'Orange Juice' and s.name = 'Beverage Distributors'
union all
select p.id, 'IN', 15, null, 'Opening stock (seed, in-house bakery)'
from public.products p
where p.name = 'Chocolate Cake';

# Dashboard KPI definitions (Phase 1)

All KPI logic lives in `lib/kpi.ts`. The dashboard (`/dashboard`) and the
AI Assistant's "Top Selling Products" answer both use it, so they cannot
disagree. Nothing here changes the database: every query is read-only and
runs as the signed-in user, so Row Level Security still applies.

## Rules that apply to every KPI

| Rule | Detail |
|---|---|
| Revenue counts completed orders only | `orders.status = 'completed'`, using the order's **current** status. A completed order that is later cancelled drops out of revenue (its stock is also returned by the existing trigger). |
| Orders are dated by `created_at` | There is no `completed_at` column in this phase. An order created on one day and completed on another counts on the day it was **created**. |
| Days are Africa/Cairo calendar days | Boundaries are half-open `[start, end)` and converted to UTC using each day's own offset, so Cairo's 23-hour and 25-hour DST days are handled. |
| Sales are gross | The schema has no discounts, taxes, tips or refunds. |
| Profit is not shown | There is no cost, purchase-price or expense data. |
| Cancelled, pending and preparing orders | Never add to revenue. They are counted in Total Orders under their own status. |

## Date ranges

Selected with `?range=` in the URL. Anything unrecognised falls back to Today.

| Range | URL | Window (Cairo days) | Compared with |
|---|---|---|---|
| Today | `/dashboard` | Today | Yesterday |
| 7 days | `/dashboard?range=7d` | Today and the previous 6 days | The 7 days before that |
| 30 days | `/dashboard?range=30d` | Today and the previous 29 days | The 30 days before that |

If the previous period's value is 0, the comparison shows "—" instead of a
percentage.

## KPIs

| KPI | Definition | Calculation | Source |
|---|---|---|---|
| Total Sales | Gross value of completed orders in the range | Sum of `total_amount`, status `completed` | `orders` |
| Total Orders | Orders created in the range, any status | Count, with breakdown: completed · in progress (pending + preparing) · cancelled | `orders` |
| Average Order Value | Average value of a completed order | Total Sales ÷ completed orders; "—" when there are none | `orders` |
| Low-Stock Items | Active products at or below their threshold, **right now** | `product_stock` rows with status Low Stock or Out of Stock, active products only; shown as "X low · Y out" | `product_stock`, `products` |
| Active Products | Products with `is_active = true`, **right now** | Count | `products` |
| Sales by day | Completed sales per Cairo day (7 and 30 day ranges) | Sum of `total_amount` grouped by Cairo date; days with no sales are shown as 0 | `orders` |
| Top selling products | Best sellers by units sold, top 5 | Sum of `quantity` (and `subtotal`) per product, completed orders in range. Ties are broken by revenue, then name. | `order_items`, `orders`, `products` |
| Sales by category | Revenue and share per category | Sum of `subtotal` per category; share is the percent of category revenue in the range. A product with no category is shown as "Uncategorized". | `order_items`, `orders`, `products`, `categories` |

Recent Orders (last 5, any status) is unchanged and ignores the range.
Low-Stock Items and Active Products are current snapshots, so they do not
change with the range. Money is summed in whole cents, so totals never show
floating-point drift.

## AI Assistant: Top Selling Products

Uses the same function and rules as the dashboard panel. The range is read
from the question: "this week" or "7 days" gives 7 days, "this month" or "30
days" gives 30 days, anything else gives Today. The answer always states the
range it used. It shows the top 5 (it previously showed 3, counted every order
status and had no date range).

## Empty results and errors

- Each section loads independently. One failing query only affects its own
  section.
- A failed query shows an inline error with the message and Supabase error code,
  and its KPI card shows "—". It is never shown as a real 0. The error is also
  written to the server log with a `[kpi]` prefix.
- Empty results show a message such as "No completed orders in this range".
- Data is read in pages of 1,000 rows, up to a safety cap of **20,000 rows**
  per query. If more rows exist, a visible warning says the results may be
  incomplete. A read of exactly 20,000 rows is not flagged.

## Known limitations

1. **Creation date, not completion date** (see rules above).
2. **Category sales use each product's current category.** Reassigning a product
   changes how past sales are grouped.
3. **Row limit assumption.** Paging assumes the Supabase project's API max rows
   setting is 1,000 (the default) or higher. If it is set lower, large reads
   would be cut short without a warning.
4. **Sales by day, top products and categories are computed in application
   code**, because the Data API cannot group rows. A database view could replace
   this later if order volume grows, but that is a schema change and is not part
   of this phase.
5. **Known data-quality risks that this phase does not change**, because they
   need database work: re-completing a previously cancelled order does not
   deduct stock again, reopening a completed order does not reverse stock,
   `unit_price` is supplied by the browser and not verified by the database, and
   stock can go negative.

## What has been verified against the live database

Only that the `profiles` table has a `profiles_role_check` constraint allowing
`admin`, `manager`, `cashier` and `kitchen`, with one active admin. The columns
and policies of `orders`, `order_items`, `products`, `categories` and
`product_stock` are assumed to match `supabase/migrations`. If they do not,
affected sections show an error message instead of numbers.

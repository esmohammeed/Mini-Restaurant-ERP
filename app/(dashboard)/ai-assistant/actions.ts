'use server';

import { createClient } from '@/lib/supabase/server';
import { getCairoTodayBoundsUtc } from '@/lib/timezone';
import { formatCurrency } from '@/lib/format';

// Deterministic, DB-backed answers for a fixed set of questions.
// No LLM/embeddings/vector store is used. The matching here is
// intentionally simple (keyword based) so a real LLM can later
// be swapped in to do the question -> intent step, while these
// same DB queries remain the "tools" it calls.

type Intent =
  | 'today_sales'
  | 'pending_orders'
  | 'top_products'
  | 'low_stock'
  | 'unknown';

function detectIntent(question: string): Intent {
  const q = question.toLowerCase();

  if (q.includes('sale')) return 'today_sales';
  if (q.includes('pending')) return 'pending_orders';
  if (q.includes('top') || q.includes('best seller') || q.includes('best-seller'))
    return 'top_products';
  if (q.includes('low stock') || q.includes('stock')) return 'low_stock';

  return 'unknown';
}

export async function askAssistant(question: string): Promise<string> {
  const supabase = await createClient();
  const intent = detectIntent(question);

  switch (intent) {
    case 'today_sales': {
      const { startUtcIso, endUtcIso } = getCairoTodayBoundsUtc();
      const { data } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'completed')
        .gte('created_at', startUtcIso)
        .lt('created_at', endUtcIso);

      const total = (data ?? []).reduce(
        (sum, o) => sum + Number(o.total_amount),
        0
      );
      return `Today's sales so far: ${formatCurrency(total)} across ${
        (data ?? []).length
      } completed order(s).`;
    }

    case 'pending_orders': {
      const { data, count } = await supabase
        .from('orders')
        .select('id, customer_name, total_amount', { count: 'exact' })
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!count) return 'There are no pending orders right now.';

      const list = (data ?? [])
        .map((o) => `#${o.id} (${o.customer_name ?? 'walk-in'})`)
        .join(', ');
      return `There are ${count} pending order(s). Most recent: ${list}.`;
    }

    case 'top_products': {
      const { data } = await supabase
        .from('order_items')
        .select('product_id, quantity, products(name)');

      if (!data || data.length === 0) {
        return 'No order history yet to determine top selling products.';
      }

      const totals = new Map<string, number>();
      for (const row of data) {
        const name =
          (row.products as unknown as { name: string } | null)?.name ??
          `Product ${row.product_id}`;
        totals.set(name, (totals.get(name) ?? 0) + row.quantity);
      }

      const top = [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, qty], i) => `${i + 1}. ${name} (${qty} sold)`)
        .join('\n');

      return `Top selling products:\n${top}`;
    }

    case 'low_stock': {
      const { data } = await supabase
        .from('product_stock')
        .select('product_name, current_stock, stock_status')
        .in('stock_status', ['Low Stock', 'Out of Stock']);

      if (!data || data.length === 0) {
        return 'No products are currently low or out of stock.';
      }

      const list = data
        .map((p) => `${p.product_name} (${p.current_stock}, ${p.stock_status})`)
        .join('\n');
      return `Products needing attention:\n${list}`;
    }

    default:
      return "I can currently answer questions about today's sales, pending orders, top selling products, and low stock items. Try one of the quick questions below.";
  }
}

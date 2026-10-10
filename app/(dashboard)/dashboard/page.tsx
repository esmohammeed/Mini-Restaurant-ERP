import { createClient } from '@/lib/supabase/server';
import { getCairoTodayBoundsUtc } from '@/lib/timezone';
import { formatCurrency, formatDateTime } from '@/lib/format';
import KpiCard from '@/components/KpiCard';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState } from '@/components/FormControls';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { startUtcIso, endUtcIso } = getCairoTodayBoundsUtc();

  const [
    todaysSalesRes,
    todaysOrdersRes,
    totalProductsRes,
    lowStockRes,
    recentOrdersRes,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('total_amount')
      .eq('status', 'completed')
      .gte('created_at', startUtcIso)
      .lt('created_at', endUtcIso),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startUtcIso)
      .lt('created_at', endUtcIso),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('product_stock')
      .select('product_id, stock_status')
      .in('stock_status', ['Low Stock', 'Out of Stock']),
    supabase
      .from('orders')
      .select('id, customer_name, status, total_amount, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const todaysSales = (todaysSalesRes.data ?? []).reduce(
    (sum, o) => sum + Number(o.total_amount),
    0
  );
  const todaysOrdersCount = todaysOrdersRes.count ?? 0;
  const totalProducts = totalProductsRes.count ?? 0;
  const lowStockCount = (lowStockRes.data ?? []).length;
  const recentOrders = recentOrdersRes.data ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Today's Sales" value={formatCurrency(todaysSales)} />
        <KpiCard label="Today's Orders" value={todaysOrdersCount} />
        <KpiCard label="Total Products" value={totalProducts} />
        <KpiCard
          label="Low Stock Items"
          value={lowStockCount}
          tone={lowStockCount > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Recent Orders
        </h2>

        {recentOrders.length === 0 ? (
          <EmptyState message="No orders yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{order.customer_name ?? '—'}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td>{formatCurrency(order.total_amount)}</td>
                    <td>{formatDateTime(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

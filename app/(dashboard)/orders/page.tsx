import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency, formatDateTime } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState } from '@/components/FormControls';
import NewOrderModal from './new-order-modal';
import StatusControl from './status-control';

const FILTERS = ['All', 'Pending', 'Preparing', 'Completed', 'Cancelled'];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeFilter = status && FILTERS.includes(status) ? status : 'All';

  const supabase = await createClient();

  let query = supabase
    .from('orders')
    .select('id, customer_name, status, payment_method, total_amount, created_at')
    .order('created_at', { ascending: false });

  if (activeFilter !== 'All') {
    query = query.eq('status', activeFilter.toLowerCase());
  }

  const [{ data: orders }, { data: products }] = await Promise.all([
    query,
    supabase
      .from('products')
      .select('id, name, price')
      .eq('is_active', true)
      .order('name'),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={f === 'All' ? '/orders' : `/orders?status=${f}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                activeFilter === f
                  ? 'bg-brand-600 text-white'
                  : 'border border-cream-300 bg-cream-50 text-gray-600 hover:bg-cream-100'
              }`}
            >
              {f}
            </Link>
          ))}
        </div>

        <NewOrderModal
          products={(products ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price),
          }))}
        />
      </div>

      <div className="card">
        {!orders || orders.length === 0 ? (
          <EmptyState message="No orders yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{order.customer_name ?? '—'}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="capitalize">{order.payment_method}</td>
                    <td>{formatCurrency(order.total_amount)}</td>
                    <td>{formatDateTime(order.created_at)}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusControl
                          orderId={order.id}
                          currentStatus={order.status}
                        />
                        <Link
                          href={`/orders/${order.id}/invoice`}
                          className="whitespace-nowrap text-sm text-brand-600 hover:underline"
                        >
                          Print invoice
                        </Link>
                      </div>
                    </td>
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

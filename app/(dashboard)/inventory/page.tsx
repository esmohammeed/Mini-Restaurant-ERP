import { createClient } from '@/lib/supabase/server';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState } from '@/components/FormControls';
import AddStockModal from './add-stock-modal';
import AdjustStockModal from './adjust-stock-modal';

export default async function InventoryPage() {
  const supabase = await createClient();

  const [{ data: stock }, { data: products }, { data: suppliers }] =
    await Promise.all([
      supabase
        .from('product_stock')
        .select('product_id, product_name, current_stock, low_stock_threshold, stock_status')
        .order('product_name'),
      supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('suppliers')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
    ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <AdjustStockModal products={products ?? []} />
        <AddStockModal products={products ?? []} suppliers={suppliers ?? []} />
      </div>

      <div className="card">
        {!stock || stock.length === 0 ? (
          <EmptyState message="No products found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Current Stock</th>
                  <th>Low Stock Threshold</th>
                  <th>Stock Status</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((row) => (
                  <tr key={row.product_id}>
                    <td>{row.product_name}</td>
                    <td>{row.current_stock}</td>
                    <td>{row.low_stock_threshold}</td>
                    <td>
                      <StatusBadge status={row.stock_status} />
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

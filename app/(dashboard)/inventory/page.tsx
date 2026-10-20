import { createClient } from '@/lib/supabase/server';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState, InlineMessage } from '@/components/FormControls';
import { buildInventoryRows } from '@/lib/inventory';
import AddStockModal from './add-stock-modal';
import AdjustStockModal from './adjust-stock-modal';
import RemoveItemModal from './remove-item-modal';

export default async function InventoryPage() {
  const supabase = await createClient();

  const [
    { data: stock, error: stockError },
    { data: products, error: productsError },
    { data: suppliers },
  ] = await Promise.all([
    supabase
      .from('product_stock')
      .select('product_id, product_name, current_stock, low_stock_threshold, stock_status')
      .order('product_name'),
    supabase
      .from('products')
      .select('id, name, low_stock_threshold')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('suppliers')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ]);

  // Active products only: items removed from inventory are hidden here.
  const rows = buildInventoryRows(products ?? [], stock ?? []);
  const stockByProduct: Record<number, number> = Object.fromEntries(
    rows.map((r) => [r.product_id, r.current_stock])
  );
  const productOptions = rows.map((r) => ({ id: r.product_id, name: r.product_name }));
  const loadError = stockError || productsError;

  return (
    <div className="space-y-4">
      {loadError && (
        <InlineMessage
          type="error"
          message={`Could not load inventory: ${loadError.message}`}
        />
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <AdjustStockModal products={productOptions} stockByProduct={stockByProduct} />
        <AddStockModal
          products={productOptions}
          suppliers={suppliers ?? []}
          stockByProduct={stockByProduct}
        />
      </div>

      <div className="card">
        {rows.length === 0 ? (
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.product_id}>
                    <td>{row.product_name}</td>
                    <td className="tabular-nums">{row.current_stock}</td>
                    <td className="tabular-nums">{row.low_stock_threshold}</td>
                    <td>
                      <StatusBadge status={row.stock_status} />
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-3">
                        <AddStockModal
                          products={productOptions}
                          suppliers={suppliers ?? []}
                          stockByProduct={stockByProduct}
                          defaultProductId={row.product_id}
                          trigger={
                            <button className="text-sm text-brand-600 hover:underline">
                              Add stock
                            </button>
                          }
                        />
                        <AdjustStockModal
                          products={productOptions}
                          stockByProduct={stockByProduct}
                          defaultProductId={row.product_id}
                          trigger={
                            <button className="text-sm text-brand-600 hover:underline">
                              Adjust
                            </button>
                          }
                        />
                        <RemoveItemModal
                          productId={row.product_id}
                          productName={row.product_name}
                          stock={row.current_stock}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-500">
          Removed (inactive) products are hidden here. Reactivate them on the
          Products page.
        </p>
      </div>
    </div>
  );
}

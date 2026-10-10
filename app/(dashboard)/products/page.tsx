import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState } from '@/components/FormControls';
import ProductModal from './product-modal';
import CategoryModal from './category-modal';
import ProductActiveToggle from './product-active-toggle';

export default async function ProductsPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: categories }, { data: stock }] =
    await Promise.all([
      supabase
        .from('products')
        .select('id, name, price, category_id, low_stock_threshold, is_active, categories(name)')
        .order('name'),
      supabase.from('categories').select('id, name, description, is_active').order('name'),
      supabase.from('product_stock').select('product_id, stock_status'),
    ]);

  const stockByProduct = new Map(
    (stock ?? []).map((s) => [s.product_id, s.stock_status])
  );

  const activeCategories = (categories ?? []).filter((c) => c.is_active);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <CategoryModal categories={categories ?? []} />
        <ProductModal
          categories={activeCategories}
          trigger={<button className="btn-primary">+ Add Product</button>}
        />
      </div>

      <div className="card">
        {!products || products.length === 0 ? (
          <EmptyState message="No products found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const categoryName =
                    (product.categories as unknown as { name: string } | null)
                      ?.name ?? '—';
                  return (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{categoryName}</td>
                      <td>{formatCurrency(product.price)}</td>
                      <td>
                        <StatusBadge
                          status={stockByProduct.get(product.id) ?? '—'}
                        />
                      </td>
                      <td>
                        <StatusBadge
                          status={product.is_active ? 'active' : 'inactive'}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <ProductModal
                            categories={activeCategories}
                            product={{
                              id: product.id,
                              name: product.name,
                              category_id: product.category_id,
                              price: Number(product.price),
                              low_stock_threshold: product.low_stock_threshold,
                            }}
                            trigger={
                              <button className="text-sm text-brand-600 hover:underline">
                                Edit
                              </button>
                            }
                          />
                          <ProductActiveToggle
                            productId={product.id}
                            isActive={product.is_active}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

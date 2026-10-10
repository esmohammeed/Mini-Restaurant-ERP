import { createClient } from '@/lib/supabase/server';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState } from '@/components/FormControls';
import SupplierModal from './supplier-modal';
import SupplierActiveToggle from './supplier-active-toggle';

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, phone, email, address, is_active')
    .order('name');

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SupplierModal
          trigger={<button className="btn-primary">+ Add Supplier</button>}
        />
      </div>

      <div className="card">
        {!suppliers || suppliers.length === 0 ? (
          <EmptyState message="No suppliers found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.phone ?? '—'}</td>
                    <td>{s.email ?? '—'}</td>
                    <td>{s.address ?? '—'}</td>
                    <td>
                      <StatusBadge status={s.is_active ? 'active' : 'inactive'} />
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <SupplierModal
                          supplier={s}
                          trigger={
                            <button className="text-sm text-brand-600 hover:underline">
                              Edit
                            </button>
                          }
                        />
                        <SupplierActiveToggle
                          supplierId={s.id}
                          isActive={s.is_active}
                        />
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

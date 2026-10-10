'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { Field, InlineMessage } from '@/components/FormControls';
import { addStock } from './actions';

type Product = { id: number; name: string };
type Supplier = { id: number; name: string };

export default function AddStockModal({
  products,
  suppliers,
}: {
  products: Product[];
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('');
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setProductId('');
    setQuantity('');
    setSupplierId('');
    setNotes('');
    setError(null);
  }

  function handleSubmit() {
    if (productId === '' || !quantity) {
      setError('Product and quantity are required.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await addStock({
        product_id: Number(productId),
        quantity: Number(quantity),
        supplier_id: supplierId === '' ? null : Number(supplierId),
        notes: notes.trim() || null,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + Add Stock
      </button>

      <Modal title="Add Stock" open={open} onClose={() => setOpen(false)}>
        {error && <InlineMessage type="error" message={error} />}

        <Field label="Product">
          <select
            className="input-field"
            value={productId}
            onChange={(e) =>
              setProductId(e.target.value === '' ? '' : Number(e.target.value))
            }
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Quantity">
          <input
            type="number"
            min={1}
            className="input-field"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>

        <Field label="Supplier">
          <select
            className="input-field"
            value={supplierId}
            onChange={(e) =>
              setSupplierId(e.target.value === '' ? '' : Number(e.target.value))
            }
          >
            <option value="">No supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notes">
          <input
            className="input-field"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <button
          className="btn-primary w-full mt-2"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? 'Saving…' : 'Add Stock'}
        </button>
      </Modal>
    </>
  );
}

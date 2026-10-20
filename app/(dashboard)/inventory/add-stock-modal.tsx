'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { Field, InlineMessage } from '@/components/FormControls';
import { parseWholeNumber } from '@/lib/inventory';
import { addStock } from './actions';

type Product = { id: number; name: string };
type Supplier = { id: number; name: string };

export default function AddStockModal({
  products,
  suppliers,
  stockByProduct,
  trigger,
  defaultProductId,
}: {
  products: Product[];
  suppliers: Supplier[];
  /** Current stock per product id, shown next to the product picker. */
  stockByProduct?: Record<number, number>;
  /** Optional custom trigger (used by the per-row action). */
  trigger?: React.ReactNode;
  defaultProductId?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('');
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Blocks a second submit before React has re-rendered (double clicks).
  const lock = useRef(false);

  function openModal() {
    lock.current = false;
    setProductId(defaultProductId ?? '');
    setQuantity('');
    setSupplierId('');
    setNotes('');
    setError(null);
    setDone(null);
    setOpen(true);
  }

  function handleSubmit() {
    if (lock.current || isPending || done) return;
    setError(null);

    if (productId === '') {
      setError('Choose a product.');
      return;
    }
    const q = parseWholeNumber(quantity, { label: 'Quantity', min: 1 });
    if (!q.ok) {
      setError(q.error);
      return;
    }

    lock.current = true;
    startTransition(async () => {
      try {
        const result = await addStock({
          product_id: Number(productId),
          quantity: q.value,
          supplier_id: supplierId === '' ? null : Number(supplierId),
          notes: notes.trim() || null,
        });
        if (!result.success) {
          setError(result.error);
          lock.current = false;
          return;
        }
        setDone(result.message);
        router.refresh(); // the stock list updates behind this window
      } catch {
        setError(
          'Could not reach the server. Check the stock list before trying again, in case the entry was saved.'
        );
        lock.current = false;
      }
    });
  }

  const current = productId === '' ? undefined : stockByProduct?.[productId];

  return (
    <>
      {trigger ? (
        <span onClick={openModal}>{trigger}</span>
      ) : (
        <button className="btn-primary" onClick={openModal}>
          + Add Stock
        </button>
      )}

      <Modal title="Add Stock" open={open} onClose={() => setOpen(false)}>
        {done ? (
          <>
            <InlineMessage type="success" message={done} />
            <button className="btn-primary w-full" onClick={() => setOpen(false)}>
              Done
            </button>
          </>
        ) : (
          <>
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
            {current !== undefined && (
              <p className="-mt-2 mb-3 text-xs text-gray-500">Current stock: {current}</p>
            )}

            <Field label="Quantity to add">
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                className="input-field"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>

            <Field label="Supplier (optional)">
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
                maxLength={500}
              />
            </Field>

            <button
              className="btn-primary w-full mt-2"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Add Stock'}
            </button>
          </>
        )}
      </Modal>
    </>
  );
}

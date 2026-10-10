'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { Field, InlineMessage } from '@/components/FormControls';
import { adjustStock } from './actions';

type Product = { id: number; name: string };

export default function AdjustStockModal({
  products,
}: {
  products: Product[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<number | ''>('');
  const [adjustment, setAdjustment] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setProductId('');
    setAdjustment('');
    setNotes('');
    setError(null);
  }

  function handleSubmit() {
    if (productId === '' || !adjustment) {
      setError('Product and adjustment quantity are required.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await adjustStock({
        product_id: Number(productId),
        adjustment: Number(adjustment),
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
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        Adjust Stock
      </button>

      <Modal title="Adjust Stock" open={open} onClose={() => setOpen(false)}>
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

        <Field label="Adjustment Quantity (use − for a reduction)">
          <input
            type="number"
            className="input-field"
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            placeholder="e.g. -3 or 5"
          />
        </Field>

        <Field label="Notes">
          <input
            className="input-field"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for adjustment"
          />
        </Field>

        <button
          className="btn-primary w-full mt-2"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? 'Saving…' : 'Save Adjustment'}
        </button>
      </Modal>
    </>
  );
}

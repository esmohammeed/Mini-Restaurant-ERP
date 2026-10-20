'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { Field, InlineMessage } from '@/components/FormControls';
import { computeAdjustment, formatSigned, parseWholeNumber } from '@/lib/inventory';
import { adjustStock } from './actions';

type Product = { id: number; name: string };

export default function AdjustStockModal({
  products,
  stockByProduct,
  trigger,
  defaultProductId,
}: {
  products: Product[];
  /** Current stock per product id: needed to show the change before saving. */
  stockByProduct?: Record<number, number>;
  /** Optional custom trigger (used by the per-row action). */
  trigger?: React.ReactNode;
  defaultProductId?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<number | ''>('');
  const [target, setTarget] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const lock = useRef(false);

  function openModal() {
    lock.current = false;
    setProductId(defaultProductId ?? '');
    setTarget('');
    setNotes('');
    setError(null);
    setDone(null);
    setOpen(true);
  }

  const current = productId === '' ? undefined : stockByProduct?.[productId];
  const parsed = parseWholeNumber(target, { label: 'New stock quantity', min: 0 });
  const preview =
    parsed.ok && current !== undefined ? computeAdjustment(current, parsed.value) : null;

  function handleSubmit() {
    if (lock.current || isPending || done) return;
    setError(null);

    if (productId === '') {
      setError('Choose a product.');
      return;
    }
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    lock.current = true;
    startTransition(async () => {
      try {
        const result = await adjustStock({
          product_id: Number(productId),
          target_quantity: parsed.value,
          expected_current: current ?? null,
          notes: notes.trim() || null,
        });
        if (!result.success) {
          setError(result.error);
          lock.current = false;
          return;
        }
        setDone(result.message);
        router.refresh();
      } catch {
        setError(
          'Could not reach the server. Check the stock list before trying again, in case the correction was saved.'
        );
        lock.current = false;
      }
    });
  }

  return (
    <>
      {trigger ? (
        <span onClick={openModal}>{trigger}</span>
      ) : (
        <button className="btn-secondary" onClick={openModal}>
          Adjust Stock
        </button>
      )}

      <Modal title="Adjust Stock" open={open} onClose={() => setOpen(false)}>
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

            <Field label="New stock quantity">
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="input-field"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Quantity that should be in stock"
              />
            </Field>
            <p className="-mt-2 mb-3 text-xs text-gray-500">
              Enter the quantity that should be in stock after the correction. The
              difference is recorded as an adjustment.
              {preview && preview.direction !== 'none' && (
                <>
                  {' '}
                  <span className="font-medium text-gray-700">
                    Change: {formatSigned(preview.delta)} (from {current} to {parsed.ok ? parsed.value : ''}).
                  </span>
                </>
              )}
              {preview && preview.direction === 'none' && (
                <>
                  {' '}
                  <span className="font-medium text-gray-700">No change: stock already matches.</span>
                </>
              )}
            </p>

            <Field label="Notes">
              <input
                className="input-field"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for the correction (optional)"
                maxLength={500}
              />
            </Field>

            <button
              className="btn-primary w-full mt-2"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Save Correction'}
            </button>
          </>
        )}
      </Modal>
    </>
  );
}

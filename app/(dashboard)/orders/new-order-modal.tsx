'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { Field, InlineMessage } from '@/components/FormControls';
import { formatCurrency } from '@/lib/format';
import { createOrder } from './actions';

type Product = { id: number; name: string; price: number };

type Line = {
  product_id: number | '';
  quantity: number;
  unit_price: number;
};

export default function NewOrderModal({ products }: { products: Product[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [lines, setLines] = useState<Line[]>([
    { product_id: '', quantity: 1, unit_price: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const total = useMemo(
    () =>
      lines.reduce(
        (sum, l) => sum + (l.quantity || 0) * (l.unit_price || 0),
        0
      ),
    [lines]
  );

  function reset() {
    setCustomerName('');
    setPaymentMethod('cash');
    setLines([{ product_id: '', quantity: 1, unit_price: 0 }]);
    setError(null);
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l))
    );
  }

  function handleProductChange(index: number, productId: number) {
    const product = products.find((p) => p.id === productId);
    updateLine(index, {
      product_id: productId,
      unit_price: product ? Number(product.price) : 0,
    });
  }

  function addLine() {
    setLines((prev) => [...prev, { product_id: '', quantity: 1, unit_price: 0 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    setError(null);

    const validLines = lines.filter(
      (l) => l.product_id !== '' && l.quantity > 0
    );

    if (validLines.length === 0) {
      setError('Add at least one product line.');
      return;
    }

    startTransition(async () => {
      const result = await createOrder({
        customer_name: customerName.trim() || null,
        payment_method: paymentMethod,
        lines: validLines.map((l) => ({
          product_id: l.product_id as number,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
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
        + New Order
      </button>

      <Modal title="New Order" open={open} onClose={() => setOpen(false)}>
        {error && <InlineMessage type="error" message={error} />}

        <Field label="Customer Name">
          <input
            className="input-field"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <Field label="Payment Method">
          <select
            className="input-field"
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(e.target.value as 'cash' | 'card')
            }
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </Field>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Product Lines
          </span>
          <button
            type="button"
            onClick={addLine}
            className="text-sm text-brand-600 hover:underline"
          >
            + Add Product
          </button>
        </div>

        <div className="space-y-2 mb-3">
          {lines.map((line, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                className="input-field"
                value={line.product_id}
                onChange={(e) =>
                  handleProductChange(index, Number(e.target.value))
                }
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                className="input-field w-20"
                value={line.quantity}
                onChange={(e) =>
                  updateLine(index, { quantity: Number(e.target.value) })
                }
              />
              <span className="w-24 text-sm text-gray-600 shrink-0">
                {formatCurrency(line.quantity * line.unit_price)}
              </span>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  aria-label="Remove line"
                  className="text-gray-400 hover:text-red-500"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <span className="text-sm font-medium text-gray-700">
            Order Total
          </span>
          <span className="text-base font-semibold text-gray-900">
            {formatCurrency(total)}
          </span>
        </div>

        <button
          className="btn-primary w-full mt-2"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? 'Creating…' : 'Create Order'}
        </button>
      </Modal>
    </>
  );
}

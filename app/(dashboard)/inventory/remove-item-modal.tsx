'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { InlineMessage } from '@/components/FormControls';
import { removeInventoryItem } from './actions';

// Removing an inventory item = taking the product out of active use. Nothing
// is deleted: stock history and past orders stay. The server re-checks every
// rule; the warning below only shows the likely reason up front.
export default function RemoveItemModal({
  productId,
  productName,
  stock,
}: {
  productId: number;
  productName: string;
  stock: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const lock = useRef(false);

  function openModal() {
    lock.current = false;
    setError(null);
    setDone(null);
    setOpen(true);
  }

  function confirm() {
    if (lock.current || isPending || done) return;
    lock.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await removeInventoryItem({ product_id: productId });
        if (!result.success) {
          setError(result.error);
          lock.current = false;
          return;
        }
        setDone(result.message);
        router.refresh();
      } catch {
        setError('Could not reach the server. Refresh the page to see whether the item was removed.');
        lock.current = false;
      }
    });
  }

  const blockedByStock = stock !== 0;

  return (
    <>
      <button className="text-sm text-gray-500 hover:underline" onClick={openModal}>
        Remove
      </button>

      <Modal title="Remove from inventory" open={open} onClose={() => setOpen(false)}>
        {done ? (
          <>
            <InlineMessage type="success" message={done} />
            <button className="btn-primary w-full" onClick={() => setOpen(false)}>
              Done
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-700">
              Remove <strong className="font-semibold">{productName}</strong> from active
              inventory?
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
              <li>The product becomes inactive: it is hidden from inventory and from new orders.</li>
              <li>Nothing is deleted. Stock history, past orders and invoices are kept.</li>
              <li>It can only be removed when its stock is 0 and no open order contains it.</li>
              <li>You can reactivate it later on the Products page.</li>
            </ul>

            {blockedByStock && (
              <div className="mt-3">
                <InlineMessage
                  type="error"
                  message={`Stock is ${stock}. Adjust it to 0 first, so no stock is silently written off.`}
                />
              </div>
            )}
            {error && (
              <div className="mt-3">
                <InlineMessage type="error" message={error} />
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary flex-1"
                onClick={confirm}
                disabled={isPending || blockedByStock}
              >
                {isPending ? 'Removing…' : 'Remove item'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

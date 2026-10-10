'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateOrderStatus } from './actions';

const STATUSES = ['pending', 'preparing', 'completed', 'cancelled'] as const;

export default function StatusControl({
  orderId,
  currentStatus,
}: {
  orderId: number;
  currentStatus: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(status: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatus(
        orderId,
        status as (typeof STATUSES)[number]
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="input-field text-xs py-1"
        value={currentStatus}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

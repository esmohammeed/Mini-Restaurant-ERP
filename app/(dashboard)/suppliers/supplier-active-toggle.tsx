'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setSupplierActive } from './actions';

export default function SupplierActiveToggle({
  supplierId,
  isActive,
}: {
  supplierId: number;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await setSupplierActive(supplierId, !isActive);
      router.refresh();
    });
  }

  return (
    <button
      className="text-sm text-gray-500 hover:underline"
      onClick={handleToggle}
      disabled={isPending}
    >
      {isActive ? 'Deactivate' : 'Activate'}
    </button>
  );
}

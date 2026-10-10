'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setProductActive } from './actions';

export default function ProductActiveToggle({
  productId,
  isActive,
}: {
  productId: number;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await setProductActive(productId, !isActive);
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

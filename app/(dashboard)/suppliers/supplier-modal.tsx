'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { Field, InlineMessage } from '@/components/FormControls';
import { createSupplier, updateSupplier } from './actions';

type ExistingSupplier = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export default function SupplierModal({
  supplier,
  trigger,
}: {
  supplier?: ExistingSupplier;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(supplier?.name ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [address, setAddress] = useState(supplier?.address ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!name.trim()) {
      setError('Supplier name is required.');
      return;
    }
    setError(null);

    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
    };

    startTransition(async () => {
      const result = supplier
        ? await updateSupplier(supplier.id, payload)
        : await createSupplier(payload);

      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>

      <Modal
        title={supplier ? 'Edit Supplier' : 'Add Supplier'}
        open={open}
        onClose={() => setOpen(false)}
      >
        {error && <InlineMessage type="error" message={error} />}

        <Field label="Name">
          <input
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input
            className="input-field"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Optional"
          />
        </Field>
        <Field label="Address">
          <input
            className="input-field"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <button
          className="btn-primary w-full mt-2"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? 'Saving…' : supplier ? 'Save Changes' : 'Add Supplier'}
        </button>
      </Modal>
    </>
  );
}

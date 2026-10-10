'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { Field, InlineMessage } from '@/components/FormControls';
import { createProduct, updateProduct } from './actions';

type Category = { id: number; name: string };

type ExistingProduct = {
  id: number;
  name: string;
  category_id: number | null;
  price: number;
  low_stock_threshold: number;
};

export default function ProductModal({
  categories,
  product,
  trigger,
}: {
  categories: Category[];
  product?: ExistingProduct;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState<number | ''>(
    product?.category_id ?? ''
  );
  const [price, setPrice] = useState(product?.price?.toString() ?? '');
  const [threshold, setThreshold] = useState(
    product?.low_stock_threshold?.toString() ?? '10'
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);

    if (!name.trim() || price === '') {
      setError('Name and price are required.');
      return;
    }

    const payload = {
      name: name.trim(),
      category_id: categoryId === '' ? null : Number(categoryId),
      price: Number(price),
      low_stock_threshold: Number(threshold || 0),
    };

    startTransition(async () => {
      const result = product
        ? await updateProduct(product.id, payload)
        : await createProduct(payload);

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
        title={product ? 'Edit Product' : 'Add Product'}
        open={open}
        onClose={() => setOpen(false)}
      >
        {error && <InlineMessage type="error" message={error} />}

        <Field label="Product Name">
          <input
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Category">
          <select
            className="input-field"
            value={categoryId}
            onChange={(e) =>
              setCategoryId(e.target.value === '' ? '' : Number(e.target.value))
            }
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Price">
          <input
            type="number"
            step="0.01"
            min={0}
            className="input-field"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>

        <Field label="Low Stock Threshold">
          <input
            type="number"
            min={0}
            className="input-field"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </Field>

        <button
          className="btn-primary w-full mt-2"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? 'Saving…' : product ? 'Save Changes' : 'Add Product'}
        </button>
      </Modal>
    </>
  );
}

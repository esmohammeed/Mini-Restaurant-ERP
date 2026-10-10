'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { Field, InlineMessage, EmptyState } from '@/components/FormControls';
import StatusBadge from '@/components/StatusBadge';
import {
  createCategory,
  updateCategory,
  setCategoryActive,
} from './actions';

type Category = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
};

export default function CategoryModal({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit(category: Category) {
    setEditing(category);
    setName(category.name);
    setDescription(category.description ?? '');
    setError(null);
  }

  function startNew() {
    setEditing(null);
    setName('');
    setDescription('');
    setError(null);
  }

  function handleSave() {
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const payload = { name: name.trim(), description: description.trim() || null };
      const result = editing
        ? await updateCategory(editing.id, payload)
        : await createCategory(payload);

      if (result.error) {
        setError(result.error);
        return;
      }

      startNew();
      router.refresh();
    });
  }

  function toggleActive(category: Category) {
    startTransition(async () => {
      await setCategoryActive(category.id, !category.is_active);
      router.refresh();
    });
  }

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        Manage Categories
      </button>

      <Modal title="Categories" open={open} onClose={() => setOpen(false)}>
        {error && <InlineMessage type="error" message={error} />}

        <Field label="Name">
          <input
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Description">
          <input
            className="input-field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <div className="flex gap-2 mb-4">
          <button
            className="btn-primary flex-1"
            onClick={handleSave}
            disabled={isPending}
          >
            {editing ? 'Save Changes' : 'Add Category'}
          </button>
          {editing && (
            <button className="btn-secondary" onClick={startNew}>
              Cancel
            </button>
          )}
        </div>

        <div className="border-t border-gray-100 pt-3">
          {categories.length === 0 ? (
            <EmptyState message="No categories yet" />
          ) : (
            <ul className="space-y-2">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">
                      {c.name}
                    </span>
                    <StatusBadge status={c.is_active ? 'active' : 'inactive'} />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      className="text-brand-600 hover:underline"
                      onClick={() => startEdit(c)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-gray-500 hover:underline"
                      onClick={() => toggleActive(c)}
                      disabled={isPending}
                    >
                      {c.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}

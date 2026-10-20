'use client';

import { useState, useTransition } from 'react';
import { login } from './actions';
import { InlineMessage, Field } from '@/components/FormControls';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-100 px-4">
      <div className="w-full max-w-sm card">
        <h1 className="text-lg font-semibold text-brand-600 mb-1">
          Restaurant Mini ERP
        </h1>
        <p className="text-sm text-gray-500 mb-5">Sign in to continue</p>

        {error && <InlineMessage type="error" message={error} />}

        <form action={handleSubmit}>
          <Field label="Email">
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              className="input-field"
              placeholder="you@restaurant.com"
              suppressHydrationWarning
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className="input-field"
              placeholder="••••••••"
              suppressHydrationWarning
            />
          </Field>
          <button type="submit" disabled={isPending} className="btn-primary w-full mt-2">
            {isPending ? 'Logging in…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/src/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setPageError(null);

    // Advisory client-side validation
    const errors: { username?: string; password?: string } = {};
    if (!username.trim()) {
      errors.username = 'Username is required.';
    } else if (username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/auth/login', {
        username: username.trim(),
        password,
      });

      router.push('/');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.field) {
          setFieldErrors({ [err.field]: err.message });
        } else {
          setPageError(err.message);
        }
      } else {
        setPageError('Unable to connect to the server. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-[380px] rounded-card border border-border bg-surface p-6 sm:p-8">
        <div className="mb-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Internal Portal</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary">Warehouse Receiving</h1>
          <p className="mt-1 text-sm text-secondary">Sign in to manage deliveries and inventory</p>
        </div>

        {pageError && (
          <div
            role="alert"
            className="mb-6 rounded-input border border-status-cancelled-border bg-status-cancelled-bg p-3 text-sm text-status-cancelled-text"
          >
            {pageError}
          </div>
        )}

        <form
          method="POST"
          action="#"
          onSubmit={handleSubmit}
          noValidate
          data-hydrated={isHydrated ? 'true' : 'false'}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-medium uppercase tracking-wider text-secondary"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              placeholder="e.g. operator"
              disabled={isSubmitting}
            />
            {fieldErrors.username && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {fieldErrors.username}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium uppercase tracking-wider text-secondary"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              placeholder="••••••••"
              disabled={isSubmitting}
            />
            {fieldErrors.password && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 flex w-full items-center justify-center rounded-button bg-primary py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

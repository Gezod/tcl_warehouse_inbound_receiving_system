'use client';

import React, { useState, useEffect } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { SafeUser, Role } from '@/src/types/domain';
import { apiClient, ApiClientError } from '@/src/lib/api-client';
import { useToast } from '@/components/ui/toast';

interface UserSheetProps {
  isOpen: boolean;
  onClose: () => void;
  user: SafeUser | null; // null for Create, SafeUser object for Edit
  onSuccess: () => void;
}

export function UserSheet({
  isOpen,
  onClose,
  user,
  onSuccess,
}: UserSheetProps) {
  const { showToast } = useToast();
  const isEdit = Boolean(user);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('OPERATOR');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    fullName?: string;
    role?: string;
    password?: string;
  }>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setFullName(user.fullName);
      setRole(user.role);
      setIsActive(user.isActive);
      setPassword('');
    } else {
      setUsername('');
      setFullName('');
      setRole('OPERATOR');
      setIsActive(true);
      setPassword('');
    }
    setFieldErrors({});
    setPageError(null);
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setPageError(null);

    // Advisory validation
    const errors: typeof fieldErrors = {};
    if (!isEdit) {
      if (!username.trim()) {
        errors.username = 'Username is required.';
      } else if (username.trim().length < 3) {
        errors.username = 'Username must be at least 3 characters.';
      } else if (!/^[a-z0-9._-]+$/i.test(username.trim())) {
        errors.username = 'Username may only contain letters, numbers, dots, hyphens, and underscores.';
      }

      if (!password) {
        errors.password = 'Initial password is required.';
      } else if (password.length < 8) {
        errors.password = 'Password must be at least 8 characters.';
      }
    }

    if (!fullName.trim()) {
      errors.fullName = 'Full name is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEdit && user) {
        await apiClient.patch<SafeUser>(`/users/${user.id}`, {
          fullName: fullName.trim(),
          role,
          isActive,
        });
        showToast('User updated successfully.');
      } else {
        await apiClient.post<SafeUser>('/users', {
          username: username.toLowerCase().trim(),
          fullName: fullName.trim(),
          role,
          password,
        });
        showToast('User created successfully.');
      }

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'LAST_SUPERVISOR_ACTION_FORBIDDEN') {
          setPageError('Cannot deactivate or demote the last active supervisor.');
        } else if (err.code === 'DUPLICATE_USERNAME') {
          setFieldErrors({ username: err.message });
        } else if (err.field) {
          setFieldErrors({ [err.field]: err.message });
        } else {
          setPageError(err.message);
        }
      } else {
        setPageError('An unexpected network error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit User Account' : 'Create New User'}
      description={
        isEdit
          ? 'Update user display name, permissions role, or activation status.'
          : 'Register a new warehouse operator or supervisor account.'
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {pageError && (
          <div
            role="alert"
            className="rounded-input border border-status-cancelled-border bg-status-cancelled-bg p-3 text-xs text-status-cancelled-text"
          >
            {pageError}
          </div>
        )}

        {/* Username */}
        <div>
          <label
            htmlFor="username"
            className="block text-xs font-medium uppercase tracking-wider text-secondary"
          >
            Username {!isEdit && <span className="text-red-600">*</span>}
          </label>
          {isEdit ? (
            <div className="mt-1 flex h-10 items-center rounded-input border border-border bg-surface-hover px-3 font-mono text-sm text-secondary">
              @{username}
            </div>
          ) : (
            <>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. jdoe"
                disabled={isSubmitting}
                className="mt-1 block w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              />
              <p className="mt-1 text-[11px] text-muted">
                3-50 characters. Alphanumeric, dot, dash, and underscore.
              </p>
              {fieldErrors.username && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {fieldErrors.username}
                </p>
              )}
            </>
          )}
        </div>

        {/* Full Name */}
        <div>
          <label
            htmlFor="fullName"
            className="block text-xs font-medium uppercase tracking-wider text-secondary"
          >
            Full Name <span className="text-red-600">*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. John Doe"
            disabled={isSubmitting}
            className="mt-1 block w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />
          {fieldErrors.fullName && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {fieldErrors.fullName}
            </p>
          )}
        </div>

        {/* Role */}
        <div>
          <label
            htmlFor="role"
            className="block text-xs font-medium uppercase tracking-wider text-secondary"
          >
            Role <span className="text-red-600">*</span>
          </label>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={isSubmitting}
            className="mt-1 block w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <option value="OPERATOR">Operator (Dock receiving, draft lines, view stock)</option>
            <option value="SUPERVISOR">Supervisor (Full access, completion, catalogue, users)</option>
          </select>
          {fieldErrors.role && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {fieldErrors.role}
            </p>
          )}
        </div>

        {/* Initial Password (Create mode only) */}
        {!isEdit && (
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium uppercase tracking-wider text-secondary"
            >
              Initial Password <span className="text-red-600">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isSubmitting}
              className="mt-1 block w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            />
            <p className="mt-1 text-[11px] text-muted">
              Must be at least 8 characters long.
            </p>
            {fieldErrors.password && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>
        )}

        {/* Active Toggle (Edit mode only) */}
        {isEdit && (
          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isSubmitting}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium text-primary block leading-none">
                  Account Active
                </span>
                <span className="text-xs text-secondary block mt-1">
                  Inactive users cannot sign in or perform warehouse operations.
                </span>
              </div>
            </label>
          </div>
        )}

        <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-button border border-border bg-white px-4 py-2 text-xs font-medium text-secondary hover:bg-surface-hover hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-button bg-primary px-4 py-2 text-xs font-medium text-white shadow-sm hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? isEdit
                ? 'Saving changes...'
                : 'Creating user...'
              : isEdit
              ? 'Save Changes'
              : 'Create User'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

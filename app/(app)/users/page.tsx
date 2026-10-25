'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users as UsersIcon,
  Plus,
  Search,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Edit,
  UserCheck,
  UserX,
} from 'lucide-react';
import { CurrentUser, SafeUser, UserPage } from '@/src/types/domain';
import { apiClient, ApiClientError } from '@/src/lib/api-client';
import { StatusBadge } from '@/components/ui/status-badge';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { UserSheet } from '@/components/users/user-sheet';
import { cn } from '@/src/lib/utils';

export default function UsersPage() {
  return (
    <ToastProvider>
      <UsersContent />
    </ToastProvider>
  );
}

function UsersContent() {
  const router = useRouter();
  const { showToast } = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Sheet state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null);

  // 1. Load session and verify supervisor permissions
  useEffect(() => {
    apiClient
      .get<CurrentUser>('/auth/me')
      .then((user) => setCurrentUser(user))
      .catch((err) => {
        if (err instanceof ApiClientError && err.statusCode === 401) {
          router.push('/login');
        }
      });
  }, [router]);

  // 2. Fetch users
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search.trim()) {
        queryParams.set('q', search.trim());
      }

      const res = await apiClient.get<UserPage>(`/users?${queryParams.toString()}`);
      setUsers(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 403) {
        // Forbidden: handeled by role banner
      } else {
        console.error('Failed to load users:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    if (currentUser?.role === 'SUPERVISOR') {
      loadUsers();
    }
  }, [currentUser, loadUsers]);

  const handleOpenCreate = () => {
    setSelectedUser(null);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (user: SafeUser) => {
    setSelectedUser(user);
    setIsSheetOpen(true);
  };

  const handleToggleActive = async (user: SafeUser) => {
    try {
      const updated = await apiClient.patch<SafeUser>(`/users/${user.id}`, {
        isActive: !user.isActive,
      });
      showToast(
        updated.isActive
          ? `User @${updated.username} activated.`
          : `User @${updated.username} deactivated.`
      );
      loadUsers();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'LAST_SUPERVISOR_ACTION_FORBIDDEN') {
          showToast('Cannot deactivate the last active supervisor.');
        } else {
          showToast(err.message);
        }
      } else {
        showToast('Failed to update user status.');
      }
    }
  };

  // If user is not supervisor, display access denied banner
  if (currentUser && currentUser.role !== 'SUPERVISOR') {
    return (
      <div className="p-6 max-w-content mx-auto">
        <div className="rounded-card border border-status-cancelled-border bg-status-cancelled-bg p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-button bg-red-100 text-status-cancelled-text mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-status-cancelled-text">Access Restricted</h2>
          <p className="mt-1 text-sm text-secondary max-w-md mx-auto">
            User management is restricted to Supervisors only (FR-19). Your account currently has the Operator role.
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-4 inline-flex items-center rounded-button bg-primary px-4 py-2 text-xs font-medium text-white hover:opacity-90"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="p-6 max-w-content mx-auto space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <UsersIcon className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-primary">User Management</h1>
          </div>
          <p className="mt-1 text-xs text-secondary">
            Manage warehouse staff accounts, assign operational roles, and toggle access permissions (FR-19).
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-1.5 rounded-button bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          <span>New User</span>
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by username or name..."
            className="w-full rounded-input border border-border bg-surface pl-9 pr-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />
        </div>

        <div className="text-xs text-secondary">
          Showing <span className="font-semibold text-primary">{users.length}</span> of{' '}
          <span className="font-semibold text-primary">{total}</span> accounts
        </div>
      </div>

      {/* Users Data Table */}
      <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-hover text-xs font-medium uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Full Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted">
                  Loading user accounts...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted">
                  No users found matching your search criteria.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isCurrentAccount = currentUser?.id === u.id;

                return (
                  <tr
                    key={u.id}
                    className="hover:bg-surface-hover/70 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-primary">
                      @{u.username}
                      {isCurrentAccount && (
                        <span className="ml-2 rounded-pill bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600 font-sans">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-primary font-medium">{u.fullName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-pill px-2.5 py-0.5 text-xs font-medium border uppercase tracking-wider',
                          u.role === 'SUPERVISOR'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        )}
                      >
                        {u.role === 'SUPERVISOR' ? 'Supervisor' : 'Operator'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary">
                      {new Date(u.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="inline-flex items-center gap-1 rounded-button border border-border bg-white px-2.5 py-1 text-xs font-medium text-secondary hover:bg-surface-hover hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <Edit className="h-3 w-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleActive(u)}
                          title={u.isActive ? 'Deactivate account' : 'Activate account'}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-button border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary',
                            u.isActive
                              ? 'border-status-cancelled-border bg-status-cancelled-bg text-status-cancelled-text hover:bg-red-100'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          )}
                        >
                          {u.isActive ? (
                            <>
                              <UserX className="h-3 w-3" />
                              <span>Deactivate</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3 w-3" />
                              <span>Activate</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-secondary bg-surface">
            <div>
              Page <span className="font-semibold text-primary">{page}</span> of{' '}
              <span className="font-semibold text-primary">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-button border border-border bg-white px-2.5 py-1 font-medium hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-button border border-border bg-white px-2.5 py-1 font-medium hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over User Sheet (Create / Edit) */}
      <UserSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        user={selectedUser}
        onSuccess={loadUsers}
      />
    </div>
  );
}

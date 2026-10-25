'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CurrentUser, InventoryTransaction } from '@/src/types/domain';
import { apiClient, ApiClientError } from '@/src/lib/api-client';
import { ToastProvider } from '@/components/ui/toast';
import { History, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

export default function TransactionsPage() {
  return (
    <ToastProvider>
      <TransactionsContent />
    </ToastProvider>
  );
}

function TransactionsContent() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Authenticate
  useEffect(() => {
    apiClient
      .get<CurrentUser>('/auth/me')
      .catch((err) => {
        if (err instanceof ApiClientError && err.statusCode === 401) {
          router.push('/login');
        }
      });
  }, [router]);

  // Load transactions
  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (dateFrom) queryParams.set('dateFrom', dateFrom);
      if (dateTo) queryParams.set('dateTo', dateTo);

      const res = await apiClient.get<{
        data: InventoryTransaction[];
        pagination: { total: number };
      }>(`/transactions?${queryParams.toString()}`);

      setTransactions(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, dateFrom, dateTo]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="p-6 max-w-content mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight text-primary">
              Inventory Transactions
            </h1>
          </div>
          <p className="mt-1 text-xs text-secondary">
            Immutable audit log of all stock movements, attributable to users and receiving documents.
          </p>
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 rounded-card bg-surface-hover border border-border text-xs">
        <div className="flex items-center gap-1.5 text-muted">
          <Filter className="h-3.5 w-3.5" />
          <span className="font-medium text-secondary">Filter by date:</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-muted">From:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-input border border-border bg-surface px-2.5 py-1 text-xs text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-muted">To:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="rounded-input border border-border bg-surface px-2.5 py-1 text-xs text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => {
              setDateFrom('');
              setDateTo('');
              setPage(1);
            }}
            className="text-xs text-secondary hover:text-primary underline self-end sm:self-auto ml-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-hover text-xs font-medium uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Product SKU</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3">Document Number</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted">
                  Loading transaction history...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted">
                  No inventory transactions recorded.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-surface-hover/50">
                  <td className="px-4 py-3 text-xs text-secondary whitespace-nowrap">
                    {new Date(tx.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-pill border border-status-completed-border bg-status-completed-bg px-2 py-0.5 text-xs font-medium text-status-completed-text">
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-primary">
                    {tx.sku}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-status-completed-text">
                    +{tx.quantity}
                  </td>
                  <td className="px-4 py-3 font-mono text-secondary">
                    {tx.documentNumber}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-secondary pt-2">
          <div>
            Showing {(page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, total)} of {total} transactions
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(page - 1)}
              className="inline-flex items-center gap-1 rounded-button border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-surface-hover disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <span className="px-2">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(page + 1)}
              className="inline-flex items-center gap-1 rounded-button border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-surface-hover disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

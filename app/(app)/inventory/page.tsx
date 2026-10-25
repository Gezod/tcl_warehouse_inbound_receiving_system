'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CurrentUser, InventoryItem } from '@/src/types/domain';
import { apiClient, ApiClientError } from '@/src/lib/api-client';
import { StatusBadge } from '@/components/ui/status-badge';
import { ToastProvider } from '@/components/ui/toast';
import { Search, ChevronLeft, ChevronRight, Boxes } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function InventoryPage() {
  return (
    <ToastProvider>
      <InventoryContent />
    </ToastProvider>
  );
}

function InventoryContent() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
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

  // Load inventory
  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search.trim()) {
        queryParams.set('q', search.trim());
      }

      const res = await apiClient.get<{
        data: InventoryItem[];
        pagination: { total: number };
      }>(`/inventory?${queryParams.toString()}`);

      setItems(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="p-6 max-w-content mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight text-primary">
              Warehouse Inventory
            </h1>
          </div>
          <p className="mt-1 text-xs text-secondary">
            Current on-hand stock and availability per product, computed dynamically from transactions.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by SKU or product name..."
            className="w-full rounded-input border border-border bg-surface pl-9 pr-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-hover text-xs font-medium uppercase tracking-wider text-muted">
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Product Name</th>
              <th className="px-4 py-3">Base Unit</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">On-Hand Stock</th>
              <th className="px-4 py-3 text-right">Available Stock</th>
              <th className="px-4 py-3">Last Movement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted">
                  Loading inventory...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted">
                  No inventory records found.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.productId} className="hover:bg-surface-hover/50">
                  <td className="px-4 py-3 font-mono font-medium text-primary">
                    {item.sku}
                  </td>
                  <td className="px-4 py-3 text-secondary">{item.name}</td>
                  <td className="px-4 py-3 text-secondary">{item.baseUnit}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    <span
                      className={cn(
                        item.onHandQty > 0 ? 'text-primary' : 'text-muted font-normal'
                      )}
                    >
                      {item.onHandQty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    <span
                      className={cn(
                        item.availableQty > 0 ? 'text-primary' : 'text-muted font-normal'
                      )}
                    >
                      {item.availableQty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {item.lastMovementAt
                      ? new Date(item.lastMovementAt).toLocaleString()
                      : 'None'}
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
            {Math.min(page * pageSize, total)} of {total} products
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

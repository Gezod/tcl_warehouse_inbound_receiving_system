'use client';

import React, { useState } from 'react';
import { Product, CurrentUser } from '@/src/types/domain';
import { StatusBadge } from '@/components/ui/status-badge';
import { Search, Edit2, Ban, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { apiClient } from '@/src/lib/api-client';
import { useToast } from '@/components/ui/toast';

interface ProductTableProps {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  currentUser: CurrentUser | null;
  search: string;
  onSearchChange: (search: string) => void;
  onPageChange: (newPage: number) => void;
  onEditProduct: (product: Product) => void;
  onProductDeactivated: () => void;
  onOpenCreate: () => void;
}

export function ProductTable({
  products,
  total,
  page,
  pageSize,
  isLoading,
  currentUser,
  search,
  onSearchChange,
  onPageChange,
  onEditProduct,
  onProductDeactivated,
  onOpenCreate,
}: ProductTableProps) {
  const { showToast } = useToast();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const isSupervisor = currentUser?.role === 'SUPERVISOR';
  const totalPages = Math.ceil(total / pageSize) || 1;

  const handleDeactivate = async (product: Product) => {
    if (!confirm(`Are you sure you want to deactivate ${product.sku} (${product.name})?`)) {
      return;
    }

    setDeactivatingId(product.id);
    setActiveMenuId(null);

    try {
      await apiClient.post(`/products/${product.id}/deactivate`);
      showToast(`Product ${product.sku} has been deactivated.`);
      onProductDeactivated();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate product.');
    } finally {
      setDeactivatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and filters bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by SKU or name..."
            className="w-full rounded-input border border-border bg-surface pl-9 pr-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />
        </div>

        {isSupervisor && (
          <button
            type="button"
            onClick={onOpenCreate}
            className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            New Product
          </button>
        )}
      </div>

      {/* Table container */}
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-hover text-xs font-medium uppercase tracking-wider text-muted">
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Base Unit</th>
              <th className="px-4 py-3">Status</th>
              {isSupervisor && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              // Skeleton loading rows matching table shape
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="h-12 animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-40 bg-gray-200 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-12 bg-gray-200 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-16 bg-gray-200 rounded-pill" /></td>
                  {isSupervisor && <td className="px-4 py-3 text-right"><div className="h-4 w-8 bg-gray-200 rounded ml-auto" /></td>}
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td
                  colSpan={isSupervisor ? 5 : 4}
                  className="px-4 py-12 text-center text-sm text-secondary"
                >
                  <p>No products found matching your criteria.</p>
                  {isSupervisor && (
                    <button
                      type="button"
                      onClick={onOpenCreate}
                      className="mt-3 text-xs font-medium text-primary underline underline-offset-4 hover:opacity-80"
                    >
                      Create the first product
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr
                  key={product.id}
                  className="h-12 transition-colors hover:bg-surface-hover"
                >
                  <td className="px-4 py-3 font-medium text-primary">
                    {product.sku}
                  </td>
                  <td className="px-4 py-3 text-primary">{product.name}</td>
                  <td className="px-4 py-3 text-secondary">{product.baseUnit}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={product.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  {isSupervisor && (
                    <td className="px-4 py-3 text-right relative">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditProduct(product)}
                          className="rounded p-1.5 text-secondary hover:bg-surface-hover hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                          title="Edit product"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {product.isActive && (
                          <button
                            type="button"
                            disabled={deactivatingId === product.id}
                            onClick={() => handleDeactivate(product)}
                            className="rounded p-1.5 text-secondary hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-1"
                            title="Deactivate product"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between text-xs text-secondary px-1">
          <div>
            Showing <span className="font-medium text-primary">{(page - 1) * pageSize + 1}</span> to{' '}
            <span className="font-medium text-primary">
              {Math.min(page * pageSize, total)}
            </span>{' '}
            of <span className="font-medium text-primary tabular-nums">{total}</span> products
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-input border border-border bg-surface p-1.5 text-secondary hover:bg-surface-hover hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tabular-nums">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-input border border-border bg-surface p-1.5 text-secondary hover:bg-surface-hover hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

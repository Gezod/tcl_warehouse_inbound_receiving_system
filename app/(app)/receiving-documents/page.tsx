'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DocumentStatus, ReceivingDocument, CurrentUser } from '@/src/types/domain';
import { apiClient, ApiClientError } from '@/src/lib/api-client';
import { StatusBadge } from '@/components/ui/status-badge';
import { ToastProvider } from '@/components/ui/toast';
import { Search, Plus, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function ReceivingDocumentsPage() {
  return (
    <ToastProvider>
      <ReceivingDocumentsContent />
    </ToastProvider>
  );
}

function ReceivingDocumentsContent() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [documents, setDocuments] = useState<ReceivingDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Authenticate
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

  // Load documents
  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (search.trim()) {
        queryParams.set('q', search.trim());
      }

      if (statusFilter !== 'ALL') {
        queryParams.set('status', statusFilter);
      }

      const res = await apiClient.get<{
        data: ReceivingDocument[];
        pagination: { total: number };
      }>(`/receiving-documents?${queryParams.toString()}`);

      setDocuments(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error('Failed to load receiving documents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="p-6 max-w-content mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-primary">
            Receiving Documents
          </h1>
          <p className="mt-1 text-xs text-secondary">
            Manage inbound shipments, expected items, and track receiving status.
          </p>
        </div>

        <Link
          href="/receiving-documents/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-button bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          New Receiving Document
        </Link>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by RD number, supplier, or reference..."
              className="w-full rounded-input border border-border bg-surface pl-9 pr-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="PARTIALLY_RECEIVED">Partially Received</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-hover text-xs font-medium uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Document #</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Expected Arrival</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Expected</th>
              <th className="px-4 py-3 text-right">Received</th>
              <th className="px-4 py-3 text-right">Remaining</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-xs text-muted">
                  Loading receiving documents...
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-xs text-muted">
                  No receiving documents found.
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const isCancelled = doc.status === 'CANCELLED';

                return (
                  <tr
                    key={doc.id}
                    onClick={() => router.push(`/receiving-documents/${doc.id}`)}
                    className="hover:bg-surface-hover/70 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-primary">
                      <span className={cn(isCancelled && 'line-through text-muted')}>
                        {doc.documentNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">
                      {doc.supplierName}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {doc.referenceNumber || '—'}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {doc.expectedArrivalDate || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-primary">
                      {doc.totals?.lineCount ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right text-primary">
                      {doc.totals?.expectedQty ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right text-secondary">
                      {doc.totals?.receivedQty ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span
                        className={cn(
                          (doc.totals?.remainingQty ?? 0) === 0
                            ? 'text-status-completed-text'
                            : 'text-primary'
                        )}
                      >
                        {doc.totals?.remainingQty ?? 0}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-secondary pt-2">
          <div>
            Showing {(page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, total)} of {total} documents
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

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  Truck,
  Package,
  History,
  Plus,
  ArrowRight,
  Boxes,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/src/lib/api-client';
import { ReceivingDocument } from '@/src/types/domain';
import { StatusBadge } from '@/components/ui/status-badge';
import { ToastProvider } from '@/components/ui/toast';

interface DashboardMetrics {
  openDocsCount: number;
  partiallyReceivedCount: number;
  activeProductsCount: number;
  receiptsTodayCount: number;
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  );
}

function DashboardContent() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    openDocsCount: 0,
    partiallyReceivedCount: 0,
    activeProductsCount: 0,
    receiptsTodayCount: 0,
  });
  const [pendingDocs, setPendingDocs] = useState<ReceivingDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      const [openRes, partialRes, productsRes, transactionsRes, openListRes, partialListRes] =
        await Promise.all([
          apiClient.get<{ pagination: { total: number } }>('/receiving-documents?status=OPEN&limit=1'),
          apiClient.get<{ pagination: { total: number } }>('/receiving-documents?status=PARTIALLY_RECEIVED&limit=1'),
          apiClient.get<{ pagination: { total: number } }>('/products?active=true&limit=1'),
          apiClient.get<{ pagination: { total: number } }>(`/transactions?dateFrom=${todayStr}&limit=1`),
          apiClient.get<{ data: ReceivingDocument[] }>('/receiving-documents?status=OPEN&limit=10'),
          apiClient.get<{ data: ReceivingDocument[] }>('/receiving-documents?status=PARTIALLY_RECEIVED&limit=10'),
        ]);

      setMetrics({
        openDocsCount: openRes.pagination.total,
        partiallyReceivedCount: partialRes.pagination.total,
        activeProductsCount: productsRes.pagination.total,
        receiptsTodayCount: transactionsRes.pagination.total,
      });

      // Combine open and partially received documents, sorting by expected arrival or created date
      const combined = [...(openListRes.data || []), ...(partialListRes.data || [])];
      combined.sort((a, b) => {
        const dateA = a.expectedArrivalDate || a.createdAt;
        const dateB = b.expectedArrivalDate || b.createdAt;
        return dateA.localeCompare(dateB);
      });

      setPendingDocs(combined.slice(0, 8));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  return (
    <div className="p-6 max-w-content mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Dashboard</h1>
          <p className="mt-1 text-sm text-secondary">
            Real-time overview of inbound receiving operations and stock traceability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-1.5 rounded-button border border-border bg-white px-3 py-2 text-xs font-medium text-secondary hover:text-primary hover:bg-surface-hover shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            title="Refresh metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/receiving-documents/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-button bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            <span>New Receiving Document</span>
          </Link>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Documents */}
        <Link
          href="/receiving-documents?status=OPEN"
          className="group block rounded-card border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Open Documents
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-button bg-blue-50 text-blue-700">
              <ClipboardList className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight text-primary">
              {isLoading ? '...' : metrics.openDocsCount}
            </div>
            <p className="mt-1 text-xs text-muted flex items-center justify-between">
              <span>Ready for receiving</span>
              <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 text-primary" />
            </p>
          </div>
        </Link>

        {/* Partially Received */}
        <Link
          href="/receiving-documents?status=PARTIALLY_RECEIVED"
          className="group block rounded-card border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Partially Received
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-button bg-amber-50 text-amber-700">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight text-primary">
              {isLoading ? '...' : metrics.partiallyReceivedCount}
            </div>
            <p className="mt-1 text-xs text-muted flex items-center justify-between">
              <span>Inbound delivery active</span>
              <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 text-primary" />
            </p>
          </div>
        </Link>

        {/* Active Products */}
        <Link
          href="/products?active=true"
          className="group block rounded-card border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Active Products
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-button bg-emerald-50 text-emerald-700">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight text-primary">
              {isLoading ? '...' : metrics.activeProductsCount}
            </div>
            <p className="mt-1 text-xs text-muted flex items-center justify-between">
              <span>In catalogue</span>
              <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 text-primary" />
            </p>
          </div>
        </Link>

        {/* Receipts Today */}
        <Link
          href="/transactions"
          className="group block rounded-card border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Receipts Today
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-button bg-purple-50 text-purple-700">
              <History className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight text-primary">
              {isLoading ? '...' : metrics.receiptsTodayCount}
            </div>
            <p className="mt-1 text-xs text-muted flex items-center justify-between">
              <span>Batches recorded today</span>
              <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 text-primary" />
            </p>
          </div>
        </Link>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/receiving-documents"
          className="flex items-center gap-4 p-4 rounded-card border border-border bg-surface hover:bg-surface-hover/70 transition-colors shadow-sm"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-primary text-white">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-primary">Receiving Documents</h2>
            <p className="text-xs text-secondary truncate">
              Manage inbound shipments, drafts, and receipts
            </p>
          </div>
        </Link>

        <Link
          href="/inventory"
          className="flex items-center gap-4 p-4 rounded-card border border-border bg-surface hover:bg-surface-hover/70 transition-colors shadow-sm"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-primary text-white">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-primary">Current Inventory</h2>
            <p className="text-xs text-secondary truncate">
              View on-hand quantities and stock levels
            </p>
          </div>
        </Link>

        <Link
          href="/transactions"
          className="flex items-center gap-4 p-4 rounded-card border border-border bg-surface hover:bg-surface-hover/70 transition-colors shadow-sm"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-primary text-white">
            <History className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-primary">Transaction History</h2>
            <p className="text-xs text-secondary truncate">
              Audit trail of every stock movement
            </p>
          </div>
        </Link>
      </div>

      {/* Needs Action List (Inbound documents waiting for receipt) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-primary">Needs Action: Inbound Receiving</h2>
          </div>
          <Link
            href="/receiving-documents"
            className="text-xs font-medium text-secondary hover:text-primary transition-colors flex items-center gap-1"
          >
            <span>View all documents</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-hover text-xs font-medium uppercase tracking-wider text-muted">
                <th className="px-4 py-3">Document #</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Expected Arrival</th>
                <th className="px-4 py-3 text-right">Expected</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-right">Remaining</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs text-muted">
                    Loading pending documents...
                  </td>
                </tr>
              ) : pendingDocs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs text-muted">
                    No documents require action right now. All inbound shipments are up to date.
                  </td>
                </tr>
              ) : (
                pendingDocs.map((doc) => {
                  const expected = doc.totals?.expectedQty ?? 0;
                  const received = doc.totals?.receivedQty ?? 0;
                  const remaining = doc.totals?.remainingQty ?? 0;
                  const percent = expected > 0 ? Math.round((received / expected) * 100) : 0;

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => router.push(`/receiving-documents/${doc.id}`)}
                      className="hover:bg-surface-hover/70 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-primary">
                        {doc.documentNumber}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="px-4 py-3 text-primary font-medium">{doc.supplierName}</td>
                      <td className="px-4 py-3 text-secondary text-xs">
                        {doc.referenceNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-secondary text-xs">
                        {doc.expectedArrivalDate || '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-secondary">
                        {expected}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-600 font-medium">
                        {received}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-amber-700">
                        {remaining}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/receiving-documents/${doc.id}`}
                          className="inline-flex items-center gap-1 rounded-button bg-primary px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 shadow-sm transition-opacity"
                        >
                          <span>Process</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

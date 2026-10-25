'use client';

import React from 'react';
import { ReceivingDocumentDetail, CurrentUser } from '@/src/types/domain';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/src/lib/utils';
import { Calendar, Building, Hash, Clock, FileText, CheckCircle2, Ban, Edit3 } from 'lucide-react';

interface DocumentHeaderCardProps {
  document: ReceivingDocumentDetail;
  currentUser: CurrentUser | null;
  onSubmit: () => void;
  onEditHeader: () => void;
  onCancel: () => void;
  onRecordReceipt?: () => void;
  onComplete?: () => void;
  isSubmitting?: boolean;
  isCancelling?: boolean;
  isCompleting?: boolean;
}

export function DocumentHeaderCard({
  document,
  currentUser,
  onSubmit,
  onEditHeader,
  onCancel,
  onRecordReceipt,
  onComplete,
  isSubmitting = false,
  isCancelling = false,
  isCompleting = false,
}: DocumentHeaderCardProps) {
  const isSupervisor = currentUser?.role === 'SUPERVISOR';
  const isDraft = document.status === 'DRAFT';
  const isOpenOrPartial =
    document.status === 'OPEN' || document.status === 'PARTIALLY_RECEIVED';
  const isCancelled = document.status === 'CANCELLED';
  const isCompleted = document.status === 'COMPLETED';

  // Can submit: DRAFT with at least 1 line
  const canSubmit = isDraft && document.lines.length > 0;

  // Can edit header: DRAFT (all roles) or OPEN/PARTIAL (Supervisor notes only)
  const canEdit = isDraft || (isOpenOrPartial && isSupervisor);

  // Can cancel: Supervisor, no receipts, and not already completed/cancelled
  const canCancel =
    isSupervisor &&
    !isCancelled &&
    !isCompleted &&
    (document.totals?.receivedQty ?? 0) === 0;

  // Can record receipt: OPEN or PARTIALLY_RECEIVED, with remaining quantity > 0
  const canRecordReceipt =
    isOpenOrPartial &&
    (document.totals?.remainingQty ?? 0) > 0 &&
    !!onRecordReceipt;

  // Can complete: Supervisor, OPEN or PARTIALLY_RECEIVED, all lines received (remaining === 0)
  const canComplete =
    isSupervisor &&
    isOpenOrPartial &&
    (document.totals?.remainingQty ?? 0) === 0 &&
    !!onComplete;

  return (
    <div className="rounded-card border border-border bg-surface p-6 shadow-sm space-y-6">
      {/* Top bar: Document Number, Status, and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <h2
            className={cn(
              'text-2xl font-bold tracking-tight text-primary font-mono',
              isCancelled && 'line-through text-muted'
            )}
          >
            {document.documentNumber}
          </h2>
          <StatusBadge status={document.status} />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {canRecordReceipt && (
            <button
              type="button"
              onClick={onRecordReceipt}
              className="inline-flex items-center gap-1.5 rounded-button bg-primary px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Record Receipts
            </button>
          )}

          {canComplete && (
            <button
              type="button"
              onClick={onComplete}
              disabled={isCompleting}
              className="inline-flex items-center gap-1.5 rounded-button bg-status-completed-border px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-status-completed-border"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isCompleting ? 'Completing...' : 'Complete Document'}
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={onEditHeader}
              className="inline-flex items-center gap-1.5 rounded-button border border-border bg-surface px-3 py-1.5 text-xs font-medium text-primary hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {isDraft ? 'Edit Header' : 'Edit Notes'}
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelling}
              className="inline-flex items-center gap-1.5 rounded-button border border-status-cancelled-border bg-status-cancelled-bg px-3 py-1.5 text-xs font-medium text-status-cancelled-text hover:opacity-90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-status-cancelled-border"
            >
              <Ban className="h-3.5 w-3.5" />
              {isCancelling ? 'Cancelling...' : 'Cancel Document'}
            </button>
          )}

          {isDraft && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit || isSubmitting}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-button px-4 py-1.5 text-xs font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2',
                canSubmit
                  ? 'bg-primary hover:opacity-90 focus:ring-primary'
                  : 'bg-muted cursor-not-allowed opacity-60'
              )}
              title={
                document.lines.length === 0
                  ? 'Add at least one line before submitting'
                  : 'Submit document to open receiving'
              }
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Document'}
            </button>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        {/* Supplier */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Building className="h-3.5 w-3.5" />
            <span>Supplier</span>
          </div>
          <p className="font-medium text-primary">{document.supplierName}</p>
        </div>

        {/* Reference Number */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Hash className="h-3.5 w-3.5" />
            <span>Reference / PO #</span>
          </div>
          <p className="font-medium text-primary">
            {document.referenceNumber || <span className="text-muted font-normal">None</span>}
          </p>
        </div>

        {/* Expected Arrival */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Calendar className="h-3.5 w-3.5" />
            <span>Expected Arrival</span>
          </div>
          <p className="font-medium text-primary">
            {document.expectedArrivalDate || <span className="text-muted font-normal">Not specified</span>}
          </p>
        </div>

        {/* Created Date */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Clock className="h-3.5 w-3.5" />
            <span>Created At</span>
          </div>
          <p className="font-medium text-primary">
            {new Date(document.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Totals Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-card bg-surface-hover border border-border">
        <div>
          <span className="text-xs text-muted block">Lines</span>
          <span className="text-base font-semibold text-primary">{document.totals.lineCount}</span>
        </div>
        <div>
          <span className="text-xs text-muted block">Expected Qty</span>
          <span className="text-base font-semibold text-primary">{document.totals.expectedQty}</span>
        </div>
        <div>
          <span className="text-xs text-muted block">Received Qty</span>
          <span className="text-base font-semibold text-primary">{document.totals.receivedQty}</span>
        </div>
        <div>
          <span className="text-xs text-muted block">Remaining Qty</span>
          <span className={cn(
            'text-base font-semibold',
            document.totals.remainingQty > 0 ? 'text-primary' : 'text-status-completed-text'
          )}>
            {document.totals.remainingQty}
          </span>
        </div>
      </div>

      {/* Notes if present */}
      {document.notes && (
        <div className="pt-2 border-t border-border flex items-start gap-2 text-xs text-secondary">
          <FileText className="h-4 w-4 text-muted flex-shrink-0 mt-0.5" />
          <p className="whitespace-pre-wrap">{document.notes}</p>
        </div>
      )}
    </div>
  );
}

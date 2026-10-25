'use client';

import React, { useState, useEffect } from 'react';
import { ReceivingDocumentDetail, ReceiptBatchResult } from '@/src/types/domain';
import { apiClient, ApiClientError } from '@/src/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface RecordReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: ReceivingDocumentDetail;
  onSuccess: (result: ReceiptBatchResult) => void;
}

interface LineReceiptDraft {
  lineId: string;
  sku: string;
  name: string;
  remainingQty: number;
  receivedQty: string;
  note: string;
}

export function RecordReceiptDialog({
  isOpen,
  onClose,
  document,
  onSuccess,
}: RecordReceiptDialogProps) {
  const { showToast } = useToast();
  const [receivedAt, setReceivedAt] = useState('');
  const [drafts, setDrafts] = useState<LineReceiptDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize drafts for lines with remaining quantity > 0
  useEffect(() => {
    if (isOpen) {
      setReceivedAt(new Date().toISOString().slice(0, 16));
      setError(null);

      const unfulfilled = document.lines
        .filter((line) => line.remainingQty > 0)
        .map((line) => ({
          lineId: line.id,
          sku: line.product.sku,
          name: line.product.name,
          remainingQty: line.remainingQty,
          receivedQty: '',
          note: '',
        }));

      setDrafts(unfulfilled);
    }
  }, [isOpen, document]);

  if (!isOpen) return null;

  const handleFillAll = () => {
    setDrafts((prev) =>
      prev.map((d) => ({
        ...d,
        receivedQty: d.remainingQty.toString(),
      }))
    );
  };

  const handleFillLine = (lineId: string, remaining: number) => {
    setDrafts((prev) =>
      prev.map((d) => (d.lineId === lineId ? { ...d, receivedQty: remaining.toString() } : d))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Filter items with quantity entered
    const itemsToReceive: { lineId: string; receivedQty: number; note?: string | null }[] = [];

    for (const draft of drafts) {
      const qty = parseInt(draft.receivedQty, 10);
      if (!isNaN(qty) && qty > 0) {
        if (qty > draft.remainingQty) {
          setError(
            `Quantity for ${draft.sku} cannot exceed remaining quantity (${draft.remainingQty}).`
          );
          setIsSubmitting(false);
          return;
        }
        itemsToReceive.push({
          lineId: draft.lineId,
          receivedQty: qty,
          note: draft.note.trim() || null,
        });
      }
    }

    if (itemsToReceive.length === 0) {
      setError('Please enter a received quantity for at least one line.');
      setIsSubmitting(false);
      return;
    }

    // Format receivedAt as ISO date-time string in UTC
    const dateObj = new Date(receivedAt);
    const isoReceivedAt = isNaN(dateObj.getTime())
      ? new Date().toISOString()
      : dateObj.toISOString();

    // Client-generated idempotency key (UUID v4)
    const idempotencyKey = crypto.randomUUID();

    try {
      const result = await apiClient.post<ReceiptBatchResult>(
        `/receiving-documents/${document.id}/receipts`,
        {
          receivedAt: isoReceivedAt,
          items: itemsToReceive,
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      showToast('Receipts recorded successfully.');
      onSuccess(result);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        if (err.details && err.details.length > 0) {
          const detailMsg = err.details.map((d: any) => d.message).join('; ');
          setError(`${err.message} (${detailMsg})`);
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to record receipts.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-card border border-border bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-primary">Record Inbound Receipts</h3>
            <p className="text-xs text-secondary mt-0.5">
              Document {document.documentNumber} ({document.supplierName})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-button p-1 text-muted hover:bg-surface-hover hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {error && (
            <div className="flex items-center gap-2 rounded-card bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Date and Fill All helper */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-card bg-surface-hover border border-border">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-secondary whitespace-nowrap">
                Received Date & Time:
              </label>
              <input
                type="datetime-local"
                required
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                className="rounded-input border border-border bg-surface px-2.5 py-1 text-xs text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              type="button"
              onClick={handleFillAll}
              className="text-xs font-medium text-primary hover:underline self-end sm:self-auto"
            >
              Receive All Remaining
            </button>
          </div>

          {/* Lines List */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Select Lines to Receive
            </h4>

            {drafts.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center">
                All lines for this document have already been fully received.
              </p>
            ) : (
              drafts.map((draft, idx) => (
                <div
                  key={draft.lineId}
                  className="p-3 rounded-card border border-border bg-surface space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-primary">
                        {draft.sku}
                      </span>
                      <span className="text-xs text-secondary ml-2">{draft.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">
                        Remaining:{' '}
                        <strong className="text-primary">{draft.remainingQty}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleFillLine(draft.lineId, draft.remainingQty)}
                        className="text-xs text-secondary hover:text-primary underline"
                      >
                        Fill
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <input
                        type="number"
                        min={0}
                        max={draft.remainingQty}
                        step={1}
                        placeholder="Quantity to receive..."
                        value={draft.receivedQty}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrafts((prev) =>
                            prev.map((d, i) =>
                              i === idx ? { ...d, receivedQty: val } : d
                            )
                          );
                        }}
                        className="w-full rounded-input border border-border bg-surface px-3 py-1.5 text-xs text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        maxLength={255}
                        placeholder="Optional note (e.g. Pallet 1, Lot A)..."
                        value={draft.note}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrafts((prev) =>
                            prev.map((d, i) => (i === idx ? { ...d, note: val } : d))
                          );
                        }}
                        className="w-full rounded-input border border-border bg-surface px-3 py-1.5 text-xs text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-button border border-border px-3 py-1.5 text-xs font-medium text-secondary hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || drafts.length === 0}
              className="inline-flex items-center gap-1.5 rounded-button bg-primary px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting ? 'Recording Receipts...' : 'Confirm Receipts'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

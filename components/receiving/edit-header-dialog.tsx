'use client';

import React, { useState, useEffect } from 'react';
import { ReceivingDocumentDetail } from '@/src/types/domain';
import { apiClient, ApiClientError } from '@/src/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { X, AlertCircle } from 'lucide-react';

interface EditHeaderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: ReceivingDocumentDetail;
  onSuccess: (updated: ReceivingDocumentDetail) => void;
}

export function EditHeaderDialog({
  isOpen,
  onClose,
  document,
  onSuccess,
}: EditHeaderDialogProps) {
  const { showToast } = useToast();
  const isDraft = document.status === 'DRAFT';

  const [supplierName, setSupplierName] = useState(document.supplierName);
  const [referenceNumber, setReferenceNumber] = useState(document.referenceNumber || '');
  const [expectedArrivalDate, setExpectedArrivalDate] = useState(document.expectedArrivalDate || '');
  const [notes, setNotes] = useState(document.notes || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSupplierName(document.supplierName);
      setReferenceNumber(document.referenceNumber || '');
      setExpectedArrivalDate(document.expectedArrivalDate || '');
      setNotes(document.notes || '');
      setError(null);
    }
  }, [isOpen, document]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload: any = {};
    if (isDraft) {
      payload.supplierName = supplierName.trim();
      payload.referenceNumber = referenceNumber.trim() || null;
      payload.expectedArrivalDate = expectedArrivalDate || null;
      payload.notes = notes.trim() || null;
    } else {
      payload.notes = notes.trim() || null;
    }

    try {
      const updated = await apiClient.patch<ReceivingDocumentDetail>(
        `/receiving-documents/${document.id}`,
        payload
      );
      showToast('Document header updated successfully.');
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to update document header.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-card border border-border bg-surface p-6 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="text-base font-semibold text-primary">
            {isDraft ? 'Edit Document Header' : 'Edit Document Notes'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-button p-1 text-muted hover:bg-surface-hover hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 rounded-card bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {isDraft && (
            <>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  Supplier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  Reference Number / PO (optional)
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. PO-2026-081"
                  className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  Expected Arrival Date (optional)
                </label>
                <input
                  type="date"
                  value={expectedArrivalDate}
                  onChange={(e) => setExpectedArrivalDate(e.target.value)}
                  className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-secondary mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dock delivery instructions, special handling, etc."
              className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
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
              disabled={isSubmitting}
              className="rounded-button bg-primary px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

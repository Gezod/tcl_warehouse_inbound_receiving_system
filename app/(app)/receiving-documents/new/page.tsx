'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient, ApiClientError } from '@/src/lib/api-client';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { ArrowLeft, Building, Hash, Calendar, FileText, AlertCircle, Check } from 'lucide-react';
import { ReceivingDocument } from '@/src/types/domain';

export default function NewReceivingDocumentPage() {
  return (
    <ToastProvider>
      <NewReceivingDocumentForm />
    </ToastProvider>
  );
}

function NewReceivingDocumentForm() {
  const router = useRouter();
  const { showToast } = useToast();

  const [supplierName, setSupplierName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [expectedArrivalDate, setExpectedArrivalDate] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload = {
      supplierName: supplierName.trim(),
      referenceNumber: referenceNumber.trim() || null,
      expectedArrivalDate: expectedArrivalDate || null,
      notes: notes.trim() || null,
    };

    try {
      const doc = await apiClient.post<ReceivingDocument>(
        '/receiving-documents',
        payload
      );
      showToast(`Document ${doc.documentNumber} created in DRAFT.`);
      // Redirect to detail page to add lines
      router.push(`/receiving-documents/${doc.id}`);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to create receiving document.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/receiving-documents"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Receiving Documents
        </Link>
      </div>

      {/* Header */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-xl font-semibold tracking-tight text-primary">
          New Receiving Document
        </h1>
        <p className="mt-1 text-xs text-secondary">
          Register an incoming shipment. You can add expected product lines on the next screen.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-card bg-red-50 p-3 text-xs text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Form Card */}
      <form
        onSubmit={handleSubmit}
        className="rounded-card border border-border bg-surface p-6 shadow-sm space-y-5 text-sm"
      >
        {/* Supplier Name */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1">
            <span className="flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-muted" />
              Supplier Name <span className="text-red-500">*</span>
            </span>
          </label>
          <input
            type="text"
            required
            maxLength={150}
            placeholder="e.g. Acme Logistics or Pacific Rim Freight"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />
        </div>

        {/* Reference Number */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1">
            <span className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-muted" />
              Reference Number / PO Number (optional)
            </span>
          </label>
          <input
            type="text"
            maxLength={60}
            placeholder="e.g. PO-2026-891"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />
          <p className="mt-1 text-xs text-muted">
            Must be unique per supplier when specified.
          </p>
        </div>

        {/* Expected Arrival Date */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted" />
              Expected Arrival Date (optional)
            </span>
          </label>
          <input
            type="date"
            value={expectedArrivalDate}
            onChange={(e) => setExpectedArrivalDate(e.target.value)}
            className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-secondary mb-1">
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted" />
              Notes (optional)
            </span>
          </label>
          <textarea
            rows={3}
            maxLength={1000}
            placeholder="Delivery instructions, dock bay number, or carrier notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Link
            href="/receiving-documents"
            className="rounded-button border border-border px-4 py-2 text-xs font-medium text-secondary hover:bg-surface-hover"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !supplierName.trim()}
            className="inline-flex items-center gap-1.5 rounded-button bg-primary px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Check className="h-4 w-4" />
            {isSubmitting ? 'Creating Document...' : 'Create in DRAFT'}
          </button>
        </div>
      </form>
    </div>
  );
}

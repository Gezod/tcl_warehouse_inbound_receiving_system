'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ReceivingDocumentDetail, CurrentUser, ReceivingLine } from '@/src/types/domain';
import { apiClient, ApiClientError } from '@/src/lib/api-client';
import { DocumentHeaderCard } from '@/components/receiving/document-header-card';
import { LinesTable } from '@/components/receiving/lines-table';
import { AddLineDialog } from '@/components/receiving/add-line-dialog';
import { EditHeaderDialog } from '@/components/receiving/edit-header-dialog';
import { RecordReceiptDialog } from '@/components/receiving/record-receipt-dialog';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { ArrowLeft, AlertCircle, History } from 'lucide-react';

export default function ReceivingDocumentDetailPage() {
  return (
    <ToastProvider>
      <DocumentDetailContent />
    </ToastProvider>
  );
}

function DocumentDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();

  const documentId = params.id as string;
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [document, setDocument] = useState<ReceivingDocumentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Dialog states
  const [isAddLineOpen, setIsAddLineOpen] = useState(false);
  const [isEditHeaderOpen, setIsEditHeaderOpen] = useState(false);
  const [isRecordReceiptOpen, setIsRecordReceiptOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Load user
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

  // Load document detail
  const loadDocument = useCallback(async () => {
    if (!documentId) return;
    setIsLoading(true);
    setPageError(null);
    try {
      const data = await apiClient.get<ReceivingDocumentDetail>(
        `/receiving-documents/${documentId}`
      );
      setDocument(data);
    } catch (err: any) {
      if (err instanceof ApiClientError && err.statusCode === 404) {
        setPageError('Receiving document not found.');
      } else {
        setPageError(err.message || 'Failed to load receiving document.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  // Handle submit document
  const handleSubmitDocument = async () => {
    if (!document) return;
    if (
      !confirm(
        `Are you sure you want to submit ${document.documentNumber} to OPEN receiving?`
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await apiClient.post<ReceivingDocumentDetail>(
        `/receiving-documents/${document.id}/submit`
      );
      showToast(`Document ${document.documentNumber} is now OPEN.`);
      setDocument(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to submit document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle complete document
  const handleCompleteDocument = async () => {
    if (!document) return;
    if (
      !confirm(
        `Are you sure you want to mark document ${document.documentNumber} as COMPLETED?`
      )
    ) {
      return;
    }

    setIsCompleting(true);
    try {
      const updated = await apiClient.post<ReceivingDocumentDetail>(
        `/receiving-documents/${document.id}/complete`
      );
      showToast(`Document ${document.documentNumber} is now COMPLETED.`);
      setDocument(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to complete document.');
    } finally {
      setIsCompleting(false);
    }
  };

  // Handle cancel document
  const handleCancelDocument = async () => {
    if (!document) return;
    if (
      !confirm(
        `Are you sure you want to cancel document ${document.documentNumber}? This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsCancelling(true);
    try {
      const updated = await apiClient.post<ReceivingDocumentDetail>(
        `/receiving-documents/${document.id}/cancel`
      );
      showToast(`Document ${document.documentNumber} has been cancelled.`);
      setDocument(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel document.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle line added
  const handleLineAdded = (newLine: ReceivingLine) => {
    loadDocument();
  };

  // Handle line updated
  const handleLineUpdated = (updatedLine: ReceivingLine) => {
    loadDocument();
  };

  // Handle line deleted
  const handleLineDeleted = (lineId: string) => {
    loadDocument();
  };

  // Extract all receipts across lines sorted newest first
  const allReceipts = (document?.lines || [])
    .flatMap((line) =>
      (line.receipts || []).map((r) => ({
        ...r,
        productSku: line.product.sku,
        productName: line.product.name,
      }))
    )
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );

  return (
    <div className="p-6 max-w-content mx-auto space-y-6">
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

      {pageError && (
        <div className="flex items-center gap-2 rounded-card bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{pageError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center text-xs text-muted">
          Loading document details...
        </div>
      ) : document ? (
        <>
          {/* Header Card */}
          <DocumentHeaderCard
            document={document}
            currentUser={currentUser}
            onSubmit={handleSubmitDocument}
            onEditHeader={() => setIsEditHeaderOpen(true)}
            onCancel={handleCancelDocument}
            onRecordReceipt={() => setIsRecordReceiptOpen(true)}
            onComplete={handleCompleteDocument}
            isSubmitting={isSubmitting}
            isCancelling={isCancelling}
            isCompleting={isCompleting}
          />

          {/* Lines Table */}
          <LinesTable
            documentId={document.id}
            documentStatus={document.status}
            lines={document.lines}
            currentUser={currentUser}
            onOpenAddLine={() => setIsAddLineOpen(true)}
            onLineUpdated={handleLineUpdated}
            onLineDeleted={handleLineDeleted}
          />

          {/* Receipt History (FR-15) */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <h3 className="text-base font-semibold text-primary">Receipt History</h3>
            </div>

            <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-sm">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-hover text-xs font-medium uppercase tracking-wider text-muted">
                    <th className="px-4 py-3">Received At</th>
                    <th className="px-4 py-3">Product SKU</th>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3 text-right">Received Qty</th>
                    <th className="px-4 py-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-xs text-muted">
                        No receipts have been recorded for this document yet.
                      </td>
                    </tr>
                  ) : (
                    allReceipts.map((rcp) => (
                      <tr key={rcp.id} className="hover:bg-surface-hover/50">
                        <td className="px-4 py-2.5 text-xs text-secondary whitespace-nowrap">
                          {new Date(rcp.receivedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">
                          {rcp.productSku}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-secondary">
                          {rcp.productName}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-xs text-status-completed-text">
                          +{rcp.receivedQty}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted">
                          {rcp.note || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dialogs */}
          <AddLineDialog
            isOpen={isAddLineOpen}
            onClose={() => setIsAddLineOpen(false)}
            document={document}
            onSuccess={handleLineAdded}
          />

          <EditHeaderDialog
            isOpen={isEditHeaderOpen}
            onClose={() => setIsEditHeaderOpen(false)}
            document={document}
            onSuccess={(updated) => setDocument(updated)}
          />

          <RecordReceiptDialog
            isOpen={isRecordReceiptOpen}
            onClose={() => setIsRecordReceiptOpen(false)}
            document={document}
            onSuccess={() => loadDocument()}
          />
        </>
      ) : null}
    </div>
  );
}

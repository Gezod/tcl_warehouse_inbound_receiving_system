'use client';

import React, { useState } from 'react';
import { ReceivingLine, CurrentUser, DocumentStatus } from '@/src/types/domain';
import { Edit2, Trash2, Plus, AlertCircle } from 'lucide-react';
import { apiClient, ApiClientError } from '@/src/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/src/lib/utils';

interface LinesTableProps {
  documentId: string;
  documentStatus: DocumentStatus;
  lines: ReceivingLine[];
  currentUser: CurrentUser | null;
  onOpenAddLine?: () => void;
  onLineUpdated: (updatedLine: ReceivingLine) => void;
  onLineDeleted: (lineId: string) => void;
}

export function LinesTable({
  documentId,
  documentStatus,
  lines,
  currentUser,
  onOpenAddLine,
  onLineUpdated,
  onLineDeleted,
}: LinesTableProps) {
  const { showToast } = useToast();
  const isSupervisor = currentUser?.role === 'SUPERVISOR';
  const isDraft = documentStatus === 'DRAFT';
  const isOpenOrPartial =
    documentStatus === 'OPEN' || documentStatus === 'PARTIALLY_RECEIVED';

  // Can add lines: only in DRAFT
  const canAddLine = isDraft && !!onOpenAddLine;

  // Editing state
  const [editingLine, setEditingLine] = useState<ReceivingLine | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleStartEdit = (line: ReceivingLine) => {
    setEditingLine(line);
    setEditQty(line.expectedQty.toString());
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingLine) return;
    const qty = parseInt(editQty, 10);
    if (isNaN(qty) || qty < 1) {
      setEditError('Expected quantity must be an integer of at least 1.');
      return;
    }

    if (isOpenOrPartial && qty < editingLine.receivedQty) {
      setEditError(
        `Expected quantity cannot be decreased below received quantity (${editingLine.receivedQty}).`
      );
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const updated = await apiClient.patch<ReceivingLine>(
        `/receiving-documents/${documentId}/lines/${editingLine.id}`,
        { expectedQty: qty }
      );
      showToast('Line expected quantity updated.');
      onLineUpdated(updated);
      setEditingLine(null);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setEditError(err.message);
      } else {
        setEditError('Failed to update line quantity.');
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteLine = async (line: ReceivingLine) => {
    if (
      !confirm(
        `Are you sure you want to remove ${line.product.sku} (${line.product.name}) from this document?`
      )
    ) {
      return;
    }

    setDeletingId(line.id);
    try {
      await apiClient.delete(`/receiving-documents/${documentId}/lines/${line.id}`);
      showToast('Line removed.');
      onLineDeleted(line.id);
    } catch (err: any) {
      alert(err.message || 'Failed to remove line.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-primary">Expected Lines</h3>
          <p className="text-xs text-secondary">
            Products and quantities registered for this inbound delivery.
          </p>
        </div>

        {canAddLine && (
          <button
            type="button"
            onClick={onOpenAddLine}
            className="inline-flex items-center gap-1.5 rounded-button bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Line
          </button>
        )}
      </div>

      {/* Edit quantity modal */}
      {editingLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-card border border-border bg-surface p-5 shadow-xl space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-primary">
                Update Expected Quantity
              </h4>
              <p className="text-xs text-secondary mt-0.5">
                {editingLine.product.sku} — {editingLine.product.name}
              </p>
            </div>

            {editError && (
              <div className="flex items-center gap-2 rounded-card bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>{editError}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-secondary mb-1">
                New Expected Quantity
              </label>
              <input
                type="number"
                min={isOpenOrPartial ? editingLine.receivedQty : 1}
                step={1}
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
                className="w-full rounded-input border border-border bg-surface px-3 py-1.5 text-sm text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {isOpenOrPartial && (
                <p className="mt-1 text-xs text-muted">
                  Cannot be lower than current received quantity ({editingLine.receivedQty}).
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setEditingLine(null)}
                disabled={isSavingEdit}
                className="rounded-button border border-border px-3 py-1 text-xs font-medium text-secondary hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="rounded-button bg-primary px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSavingEdit ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-sm">
        <table id="lines-table" className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-hover text-xs font-medium uppercase tracking-wider text-muted">
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Product Name</th>
              <th className="px-4 py-3 text-right">Expected</th>
              <th className="px-4 py-3 text-right">Received</th>
              <th className="px-4 py-3 text-right">Remaining</th>
              {(isDraft || (isOpenOrPartial && isSupervisor)) && (
                <th className="px-4 py-3 text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-xs text-muted"
                >
                  No lines added yet.{' '}
                  {isDraft && 'Click "Add Line" above to add products to this document.'}
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const canEditLine =
                  isDraft || (isOpenOrPartial && isSupervisor);
                const canDeleteLine = isDraft && line.receivedQty === 0;

                return (
                  <tr key={line.id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-primary">
                      {line.product.sku}
                    </td>
                    <td className="px-4 py-3 text-secondary">{line.product.name}</td>
                    <td className="px-4 py-3 text-right font-medium text-primary">
                      {line.expectedQty}
                    </td>
                    <td className="px-4 py-3 text-right text-secondary">
                      {line.receivedQty}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span
                        className={cn(
                          line.remainingQty === 0
                            ? 'text-status-completed-text'
                            : 'text-primary'
                        )}
                      >
                        {line.remainingQty}
                      </span>
                    </td>
                    {(isDraft || (isOpenOrPartial && isSupervisor)) && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEditLine && (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(line)}
                              title="Edit expected quantity"
                              className="rounded-button p-1 text-muted hover:bg-surface-hover hover:text-primary"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDeleteLine && (
                            <button
                              type="button"
                              onClick={() => handleDeleteLine(line)}
                              disabled={deletingId === line.id}
                              title="Remove line"
                              className="rounded-button p-1 text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

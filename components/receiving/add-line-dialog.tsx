'use client';

import React, { useState, useEffect } from 'react';
import { Product, ReceivingLine, ReceivingDocumentDetail } from '@/src/types/domain';
import { apiClient, ApiClientError } from '@/src/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { X, AlertCircle, Plus, Search } from 'lucide-react';

interface AddLineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: ReceivingDocumentDetail;
  onSuccess: (newLine: ReceivingLine) => void;
}

export function AddLineDialog({
  isOpen,
  onClose,
  document,
  onSuccess,
}: AddLineDialogProps) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [expectedQty, setExpectedQty] = useState('1');
  const [searchProduct, setSearchProduct] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load active products when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedProductId('');
      setExpectedQty('1');
      setSearchProduct('');
      setError(null);
      setIsLoadingProducts(true);

      apiClient
        .get<{ data: Product[] }>('/products?active=true&pageSize=100')
        .then((res) => {
          // Filter out products already on the document
          const existingIds = new Set(document.lines.map((l) => l.product.id));
          const available = res.data.filter((p) => !existingIds.has(p.id));
          setProducts(available);
          if (available.length > 0) {
            setSelectedProductId(available[0].id);
          }
        })
        .catch((err) => {
          console.error('Failed to load products for line creation:', err);
          setError('Failed to load active products.');
        })
        .finally(() => {
          setIsLoadingProducts(false);
        });
    }
  }, [isOpen, document]);

  if (!isOpen) return null;

  const filteredProducts = products.filter(
    (p) =>
      p.sku.toLowerCase().includes(searchProduct.toLowerCase()) ||
      p.name.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const qty = parseInt(expectedQty, 10);
    if (isNaN(qty) || qty < 1) {
      setError('Expected quantity must be an integer of at least 1.');
      setIsSubmitting(false);
      return;
    }

    if (!selectedProductId) {
      setError('Please select an active product.');
      setIsSubmitting(false);
      return;
    }

    try {
      const newLine = await apiClient.post<ReceivingLine>(
        `/receiving-documents/${document.id}/lines`,
        {
          productId: selectedProductId,
          expectedQty: qty,
        }
      );
      showToast('Line added successfully.');
      onSuccess(newLine);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to add line to document.');
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
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-primary">Add Expected Line</h3>
          </div>
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
          {isLoadingProducts ? (
            <div className="py-6 text-center text-xs text-muted">
              Loading active products...
            </div>
          ) : products.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted">
              No available active products to add. All products may already be on this document.
            </div>
          ) : (
            <>
              {/* Product search & selector */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  Product <span className="text-red-500">*</span>
                </label>
                {products.length > 5 && (
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                    <input
                      type="text"
                      placeholder="Filter product by SKU or name..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="w-full rounded-input border border-border bg-surface pl-8 pr-3 py-1.5 text-xs text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {filteredProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} ({p.baseUnit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Expected Quantity */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  Expected Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step={1}
                  value={expectedQty}
                  onChange={(e) => setExpectedQty(e.target.value)}
                  className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted">
                  Positive whole units of the product base unit.
                </p>
              </div>
            </>
          )}

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
              disabled={isSubmitting || products.length === 0}
              className="rounded-button bg-primary px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding Line...' : 'Add Line'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

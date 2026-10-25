'use client';

import React, { useState, useEffect } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Product } from '@/src/types/domain';
import { apiClient, ApiClientError } from '@/src/lib/api-client';
import { useToast } from '@/components/ui/toast';

interface ProductSheetProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null; // null for Create, Product object for Edit
  onSuccess: () => void;
}

export function ProductSheet({
  isOpen,
  onClose,
  product,
  onSuccess,
}: ProductSheetProps) {
  const { showToast } = useToast();
  const isEdit = Boolean(product);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [baseUnit, setBaseUnit] = useState('pcs');
  const [fieldErrors, setFieldErrors] = useState<{
    sku?: string;
    name?: string;
    baseUnit?: string;
  }>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setSku(product.sku);
      setName(product.name);
      setBaseUnit(product.baseUnit);
    } else {
      setSku('');
      setName('');
      setBaseUnit('pcs');
    }
    setFieldErrors({});
    setPageError(null);
  }, [product, isOpen]);

  const isSkuLocked = isEdit && product?.hasTransactions;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setPageError(null);

    // Advisory validation
    const errors: { sku?: string; name?: string; baseUnit?: string } = {};
    if (!sku.trim()) errors.sku = 'SKU is required.';
    if (!name.trim()) errors.name = 'Product name is required.';
    if (!baseUnit.trim()) errors.baseUnit = 'Base unit is required.';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEdit && product) {
        await apiClient.patch(`/products/${product.id}`, {
          ...(isSkuLocked ? {} : { sku: sku.trim().toUpperCase() }),
          name: name.trim(),
          baseUnit: baseUnit.trim(),
        });
        showToast('Product updated successfully.');
      } else {
        await apiClient.post('/products', {
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          baseUnit: baseUnit.trim(),
        });
        showToast('Product created successfully.');
      }

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.field) {
          setFieldErrors({ [err.field]: err.message });
        } else {
          setPageError(err.message);
        }
      } else {
        setPageError('An unexpected error occurred while saving the product.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Product' : 'New Product'}
      description={
        isEdit
          ? 'Update product details in the catalogue.'
          : 'Register a new product with unique SKU.'
      }
    >
      {pageError && (
        <div
          role="alert"
          className="mb-4 rounded-input border border-status-cancelled-border bg-status-cancelled-bg p-3 text-xs text-status-cancelled-text"
        >
          {pageError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="product-sku"
            className="block text-xs font-medium uppercase tracking-wider text-secondary"
          >
            SKU
          </label>
          <input
            id="product-sku"
            type="text"
            value={sku}
            disabled={isSkuLocked || isSubmitting}
            onChange={(e) => setSku(e.target.value.toUpperCase())}
            placeholder="e.g. SKU-0001"
            className="mt-1 block w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:bg-surface-hover disabled:text-muted"
          />
          {isSkuLocked && (
            <p className="mt-1 text-xs text-muted">
              SKU is locked because this product has existing receiving lines or transactions.
            </p>
          )}
          {fieldErrors.sku && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {fieldErrors.sku}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="product-name"
            className="block text-xs font-medium uppercase tracking-wider text-secondary"
          >
            Product Name
          </label>
          <input
            id="product-name"
            type="text"
            value={name}
            disabled={isSubmitting}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Standard Pallet Box"
            className="mt-1 block w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />
          {fieldErrors.name && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="product-unit"
            className="block text-xs font-medium uppercase tracking-wider text-secondary"
          >
            Base Unit
          </label>
          <input
            id="product-unit"
            type="text"
            value={baseUnit}
            disabled={isSubmitting}
            onChange={(e) => setBaseUnit(e.target.value)}
            placeholder="pcs"
            className="mt-1 block w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />
          {fieldErrors.baseUnit && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {fieldErrors.baseUnit}
            </p>
          )}
        </div>

        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-button border border-border bg-surface py-2 text-sm font-medium text-primary hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-button bg-primary py-2 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

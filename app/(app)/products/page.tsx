'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CurrentUser, Product } from '@/src/types/domain';
import { apiClient, ApiClientError } from '@/src/lib/api-client';
import { ProductTable } from '@/components/products/product-table';
import { ProductSheet } from '@/components/products/product-sheet';
import { ToastProvider } from '@/components/ui/toast';

export default function ProductsPage() {
  return (
    <ToastProvider>
      <ProductsContent />
    </ToastProvider>
  );
}

function ProductsContent() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Sheet state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // 1. Load current user session
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

  // 2. Load products
  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search.trim()) {
        queryParams.set('q', search.trim());
      }

      const res = await apiClient.get<{ data: Product[]; pagination: { total: number } }>(
        `/products?${queryParams.toString()}`
      );
      setProducts(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleOpenCreate = () => {
    setSelectedProduct(null);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsSheetOpen(true);
  };

  return (
    <div className="p-6 max-w-content mx-auto space-y-6">
      {/* Page Header matching design direction */}
      <div className="pb-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-primary">Products</h1>
          <p className="mt-1 text-xs text-secondary">
            Manage the central product catalogue, units of measure, and SKUs.
          </p>
        </div>
      </div>

      {/* Main product listing table */}
      <ProductTable
        products={products}
        total={total}
        page={page}
        pageSize={pageSize}
        isLoading={isLoading}
        currentUser={currentUser}
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        onPageChange={(newPage) => setPage(newPage)}
        onEditProduct={handleOpenEdit}
        onProductDeactivated={loadProducts}
        onOpenCreate={handleOpenCreate}
      />

      {/* Slide-over sheet for Create / Edit */}
      <ProductSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        product={selectedProduct}
        onSuccess={loadProducts}
      />
    </div>
  );
}

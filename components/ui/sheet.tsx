'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Sheet({
  isOpen,
  onClose,
  title,
  description,
  children,
}: SheetProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className={cn(
          'relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-surface p-6 shadow-sm transition-transform duration-200 sm:p-8',
          'animate-in slide-in-from-right'
        )}
      >
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h2 id="sheet-title" className="text-lg font-semibold text-primary">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs text-secondary">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-input p-1.5 text-secondary hover:bg-surface-hover hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

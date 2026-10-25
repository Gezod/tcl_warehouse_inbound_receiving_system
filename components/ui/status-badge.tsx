import React from 'react';
import { cn } from '@/src/lib/utils';
import { DocumentStatus } from '@/src/types/domain';

interface StatusBadgeProps {
  status: DocumentStatus | 'ACTIVE' | 'INACTIVE';
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  let label = status as string;
  let colorClasses = 'bg-status-draft-bg text-status-draft-text border-status-draft-border';

  switch (status) {
    case 'DRAFT':
      label = 'Draft';
      colorClasses = 'bg-status-draft-bg text-status-draft-text border-status-draft-border';
      break;
    case 'OPEN':
      label = 'Open';
      colorClasses = 'bg-status-open-bg text-status-open-text border-status-open-border';
      break;
    case 'PARTIALLY_RECEIVED':
      label = 'Partially received';
      colorClasses = 'bg-status-partial-bg text-status-partial-text border-status-partial-border';
      break;
    case 'COMPLETED':
      label = 'Completed';
      colorClasses = 'bg-status-completed-bg text-status-completed-text border-status-completed-border';
      break;
    case 'CANCELLED':
      label = 'Cancelled';
      colorClasses = 'bg-status-cancelled-bg text-status-cancelled-text border-status-cancelled-border';
      break;
    case 'ACTIVE':
      label = 'Active';
      colorClasses = 'bg-status-completed-bg text-status-completed-text border-status-completed-border';
      break;
    case 'INACTIVE':
      label = 'Inactive';
      colorClasses = 'bg-status-draft-bg text-status-draft-text border-status-draft-border';
      break;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill border px-2.5 py-0.5 text-xs font-medium tracking-wide',
        colorClasses,
        className
      )}
    >
      {label}
    </span>
  );
}

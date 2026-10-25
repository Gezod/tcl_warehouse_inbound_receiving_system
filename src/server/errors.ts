export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DUPLICATE_SKU'
  | 'DUPLICATE_USERNAME'
  | 'DUPLICATE_PRODUCT_ON_DOCUMENT'
  | 'DUPLICATE_REFERENCE'
  | 'PRODUCT_INACTIVE'
  | 'INVALID_DOCUMENT_STATE'
  | 'LINE_NOT_EDITABLE'
  | 'OVER_RECEIPT'
  | 'DOCUMENT_NOT_FULLY_RECEIVED'
  | 'DOCUMENT_HAS_RECEIPTS'
  | 'NO_LINES'
  | 'SKU_LOCKED'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'LAST_SUPERVISOR_ACTION_FORBIDDEN'
  | 'INTERNAL_ERROR';

export interface ErrorDetail {
  lineId?: string;
  requested?: number;
  remaining?: number;
  code?: string;
  message?: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly field?: string;
  public readonly details?: ErrorDetail[];

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    field?: string,
    details?: ErrorDetail[]
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.field = field;
    this.details = details;
  }
}

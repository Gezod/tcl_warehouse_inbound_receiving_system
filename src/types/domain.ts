export type Role = 'OPERATOR' | 'SUPERVISOR';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CurrentUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export type DocumentStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'PARTIALLY_RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  baseUnit: string;
  isActive: boolean;
  hasTransactions: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPage {
  data: Product[];
  pagination: Pagination;
}

export interface ReceivingDocumentTotals {
  lineCount: number;
  expectedQty: number;
  receivedQty: number;
  remainingQty: number;
}

export interface Receipt {
  id: string;
  lineId: string;
  receivedQty: number;
  note: string | null;
  receivedAt: string;
  recordedBy: string;
  recordedAt: string;
}

export interface ReceivingLine {
  id: string;
  documentId: string;
  product: {
    id: string;
    sku: string;
    name: string;
  };
  expectedQty: number;
  receivedQty: number;
  remainingQty: number;
  createdAt: string;
  receipts?: Receipt[];
}

export interface ReceivingDocument {
  id: string;
  documentNumber: string;
  status: DocumentStatus;
  supplierName: string;
  referenceNumber: string | null;
  expectedArrivalDate: string | null;
  notes: string | null;
  totals?: ReceivingDocumentTotals;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface ReceivingDocumentDetail extends ReceivingDocument {
  lines: ReceivingLine[];
  totals: ReceivingDocumentTotals;
}

export interface ReceivingDocumentPage {
  data: ReceivingDocument[];
  pagination: Pagination;
}

export interface ReceiptBatchResult {
  documentId: string;
  documentStatus: DocumentStatus;
  receipts: Receipt[];
  document: ReceivingDocument;
}

export interface InventoryItem {
  productId: string;
  sku: string;
  name: string;
  baseUnit: string;
  isActive: boolean;
  onHandQty: number;
  availableQty: number;
  lastMovementAt: string | null;
}

export interface InventoryPage {
  data: InventoryItem[];
  pagination: Pagination;
}

export type TransactionType = 'RECEIPT';

export interface InventoryTransaction {
  id: string;
  type: TransactionType;
  productId: string;
  sku: string;
  quantity: number;
  documentId: string;
  documentNumber: string;
  lineId: string;
  receiptId: string;
  createdBy: string;
  createdAt: string;
}

export interface TransactionPage {
  data: InventoryTransaction[];
  pagination: Pagination;
}




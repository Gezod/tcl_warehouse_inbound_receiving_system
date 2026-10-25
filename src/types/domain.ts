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


import { CurrentUser, TransactionPage, User } from '@/src/types/domain';
import { requireRole } from '../auth/guard';
import { TransactionQueryInput } from '@/src/lib/validation/transaction.schema';
import { findInventoryTransactions } from '../repositories/transaction.repository';

export async function listTransactions(
  user: User | CurrentUser,
  query: TransactionQueryInput
): Promise<TransactionPage> {
  // Available to Operator and Supervisor (FR-17)
  requireRole(user, ['OPERATOR', 'SUPERVISOR']);

  const { transactions, total } = await findInventoryTransactions({
    productId: query.productId,
    documentId: query.documentId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    page: query.page,
    pageSize: query.pageSize,
  });

  return {
    data: transactions,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
    },
  };
}

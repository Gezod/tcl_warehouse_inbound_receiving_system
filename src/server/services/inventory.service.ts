import { CurrentUser, InventoryPage, User } from '@/src/types/domain';
import { requireRole } from '../auth/guard';
import { InventoryQueryInput } from '@/src/lib/validation/inventory.schema';
import { findInventory } from '../repositories/inventory.repository';

export async function listInventory(
  user: User | CurrentUser,
  query: InventoryQueryInput
): Promise<InventoryPage> {
  // Available to Operator and Supervisor (FR-16)
  requireRole(user, ['OPERATOR', 'SUPERVISOR']);

  const { items, total } = await findInventory({
    q: query.q,
    page: query.page,
    pageSize: query.pageSize,
  });

  return {
    data: items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
    },
  };
}

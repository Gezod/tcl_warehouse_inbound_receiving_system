import bcrypt from 'bcryptjs';
import { requireRole } from '../auth/guard';
import { AppError } from '../errors';
import { withTransaction } from '../db/tx';
import {
  findUserById,
  findUserByUsername,
  listUsers as repoListUsers,
  createUser as repoCreateUser,
  updateUser as repoUpdateUser,
  countActiveSupervisors,
} from '../repositories/user.repository';
import { CurrentUser, SafeUser, User, UserPage } from '@/src/types/domain';
import {
  UserCreateInput,
  UserQueryInput,
  UserUpdateInput,
} from '@/src/lib/validation/user.schema';

export async function listUsers(
  currentUser: CurrentUser | User,
  query: UserQueryInput
): Promise<UserPage> {
  // FR-19: Supervisor only
  requireRole(currentUser, ['SUPERVISOR']);

  const page = query.page || 1;
  const pageSize = query.pageSize || 20;

  const { data, total } = await repoListUsers(page, pageSize, query.q);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
    },
  };
}

export async function createUser(
  currentUser: CurrentUser | User,
  input: UserCreateInput,
  requestId?: string
): Promise<SafeUser> {
  // FR-19: Supervisor only
  requireRole(currentUser, ['SUPERVISOR']);

  const normalizedUsername = input.username.toLowerCase().trim();

  // Check unique username
  const existing = await findUserByUsername(normalizedUsername);
  if (existing) {
    throw new AppError(
      409,
      'DUPLICATE_USERNAME',
      'A user with this username already exists.',
      'username'
    );
  }

  // Hash password
  const passwordHash = await bcrypt.hash(input.password, 12);

  return withTransaction(async (client) => {
    const newUser = await repoCreateUser(
      {
        username: normalizedUsername,
        fullName: input.fullName.trim(),
        role: input.role,
        passwordHash,
        isActive: true,
      },
      client
    );

    // Audit log (FR-21)
    await client.query(
      `INSERT INTO audit_logs (request_id, actor_id, action, entity_type, entity_id, after_data, created_at)
       VALUES ($1, $2, 'user.create', 'user', $3, $4, now());`,
      [
        requestId || null,
        currentUser.id,
        newUser.id,
        JSON.stringify({
          username: newUser.username,
          fullName: newUser.fullName,
          role: newUser.role,
          isActive: newUser.isActive,
        }),
      ]
    );

    return newUser;
  });
}

export async function updateUser(
  currentUser: CurrentUser | User,
  targetUserId: string,
  input: UserUpdateInput,
  requestId?: string
): Promise<SafeUser> {
  // FR-19: Supervisor only
  requireRole(currentUser, ['SUPERVISOR']);

  return withTransaction(async (client) => {
    // 1. Fetch target user
    const existing = await findUserById(targetUserId, client);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'User not found.');
    }

    // 2. Enforce Last Active Supervisor protection (Tech Spec 16.3, D-08)
    const isTargetActiveSupervisor = existing.role === 'SUPERVISOR' && existing.isActive;
    const isDeactivating = input.isActive === false;
    const isDemoting = input.role === 'OPERATOR';

    if (isTargetActiveSupervisor && (isDeactivating || isDemoting)) {
      const activeSupervisorsCount = await countActiveSupervisors(client);
      if (activeSupervisorsCount <= 1) {
        throw new AppError(
          409,
          'LAST_SUPERVISOR_ACTION_FORBIDDEN',
          'Cannot deactivate or demote the last active supervisor.'
        );
      }
    }

    // 3. Perform update
    const updated = await repoUpdateUser(
      targetUserId,
      {
        fullName: input.fullName,
        role: input.role,
        isActive: input.isActive,
      },
      client
    );

    if (!updated) {
      throw new AppError(404, 'NOT_FOUND', 'User not found.');
    }

    // If deactivated, delete existing active sessions for target user
    if (input.isActive === false) {
      await client.query('DELETE FROM sessions WHERE user_id = $1;', [targetUserId]);
    }

    // 4. Audit log (FR-21)
    await client.query(
      `INSERT INTO audit_logs (request_id, actor_id, action, entity_type, entity_id, before_data, after_data, created_at)
       VALUES ($1, $2, 'user.update', 'user', $3, $4, $5, now());`,
      [
        requestId || null,
        currentUser.id,
        updated.id,
        JSON.stringify({
          fullName: existing.fullName,
          role: existing.role,
          isActive: existing.isActive,
        }),
        JSON.stringify({
          fullName: updated.fullName,
          role: updated.role,
          isActive: updated.isActive,
        }),
      ]
    );

    return updated;
  });
}

import { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { User, SafeUser, Role } from '@/src/types/domain';

export async function findUserByUsername(
  username: string,
  client?: PoolClient
): Promise<User | null> {
  const db = client || getPool();
  const query = `
    SELECT id, username, full_name, role, password_hash, is_active, created_at, updated_at
    FROM users
    WHERE LOWER(username) = LOWER($1)
    LIMIT 1;
  `;
  const result = await db.query(query, [username.trim()]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    passwordHash: row.password_hash,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findUserById(
  id: string,
  client?: PoolClient
): Promise<User | null> {
  const db = client || getPool();
  const query = `
    SELECT id, username, full_name, role, password_hash, is_active, created_at, updated_at
    FROM users
    WHERE id = $1
    LIMIT 1;
  `;
  const result = await db.query(query, [id]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    passwordHash: row.password_hash,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listUsers(
  page: number = 1,
  pageSize: number = 20,
  search?: string,
  client?: PoolClient
): Promise<{ data: SafeUser[]; total: number }> {
  const db = client || getPool();
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search && search.trim().length > 0) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(username ILIKE $${params.length} OR full_name ILIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*)::int AS total FROM users ${whereClause};`;
  const countRes = await db.query(countQuery, params);
  const total = countRes.rows[0]?.total ?? 0;

  params.push(pageSize);
  const limitIndex = params.length;
  params.push(offset);
  const offsetIndex = params.length;

  const dataQuery = `
    SELECT id, username, full_name, role, is_active, created_at
    FROM users
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${limitIndex} OFFSET $${offsetIndex};
  `;
  const dataRes = await db.query(dataQuery, params);

  const data: SafeUser[] = dataRes.rows.map((row) => ({
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role as Role,
    isActive: row.is_active,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  }));

  return { data, total };
}

export async function createUser(
  data: {
    username: string;
    fullName: string;
    role: Role;
    passwordHash: string;
    isActive?: boolean;
  },
  client?: PoolClient
): Promise<SafeUser> {
  const db = client || getPool();
  const query = `
    INSERT INTO users (username, full_name, role, password_hash, is_active)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, username, full_name, role, is_active, created_at;
  `;
  const values = [
    data.username.toLowerCase().trim(),
    data.fullName.trim(),
    data.role,
    data.passwordHash,
    data.isActive ?? true,
  ];

  const result = await db.query(query, values);
  const row = result.rows[0];

  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role as Role,
    isActive: row.is_active,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  };
}

export async function updateUser(
  id: string,
  data: {
    fullName?: string;
    role?: Role;
    isActive?: boolean;
  },
  client?: PoolClient
): Promise<SafeUser | null> {
  const db = client || getPool();
  const setClauses: string[] = [];
  const params: unknown[] = [id];

  if (data.fullName !== undefined) {
    params.push(data.fullName.trim());
    setClauses.push(`full_name = $${params.length}`);
  }

  if (data.role !== undefined) {
    params.push(data.role);
    setClauses.push(`role = $${params.length}`);
  }

  if (data.isActive !== undefined) {
    params.push(data.isActive);
    setClauses.push(`is_active = $${params.length}`);
  }

  if (setClauses.length === 0) {
    const existing = await findUserById(id, client);
    if (!existing) return null;
    return {
      id: existing.id,
      username: existing.username,
      fullName: existing.fullName,
      role: existing.role,
      isActive: existing.isActive,
      createdAt: existing.createdAt instanceof Date ? existing.createdAt.toISOString() : new Date(existing.createdAt).toISOString(),
    };
  }

  setClauses.push('updated_at = now()');

  const query = `
    UPDATE users
    SET ${setClauses.join(', ')}
    WHERE id = $1
    RETURNING id, username, full_name, role, is_active, created_at;
  `;

  const result = await db.query(query, params);
  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role as Role,
    isActive: row.is_active,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  };
}

export async function countActiveSupervisors(client?: PoolClient): Promise<number> {
  const db = client || getPool();
  const query = `
    SELECT COUNT(*)::int AS count
    FROM users
    WHERE role = 'SUPERVISOR' AND is_active = true;
  `;
  const result = await db.query(query);
  return result.rows[0]?.count ?? 0;
}

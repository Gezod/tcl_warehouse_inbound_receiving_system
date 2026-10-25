import { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { User } from '@/src/types/domain';

export async function findUserByUsername(
  username: string,
  client?: PoolClient
): Promise<User | null> {
  const db = client || getPool();
  const query = `
    SELECT id, username, full_name, role, password_hash, is_active, created_at, updated_at
    FROM users
    WHERE username = $1
    LIMIT 1;
  `;
  const result = await db.query(query, [username.toLowerCase().trim()]);

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

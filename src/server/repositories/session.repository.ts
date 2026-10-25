import { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { Session, User } from '@/src/types/domain';

export async function createSession(
  sessionId: string,
  userId: string,
  expiresAt: Date,
  client?: PoolClient
): Promise<void> {
  const db = client || getPool();
  const query = `
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES ($1, $2, $3);
  `;
  await db.query(query, [sessionId, userId, expiresAt]);
}

export async function findActiveSessionWithUser(
  sessionId: string,
  client?: PoolClient
): Promise<{ user: User; session: Session } | null> {
  const db = client || getPool();
  const query = `
    SELECT 
      s.id AS session_id,
      s.user_id,
      s.created_at AS session_created_at,
      s.expires_at,
      u.id AS user_id,
      u.username,
      u.full_name,
      u.role,
      u.password_hash,
      u.is_active,
      u.created_at AS user_created_at,
      u.updated_at AS user_updated_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = $1
      AND s.expires_at > now()
      AND u.is_active = true
    LIMIT 1;
  `;
  const result = await db.query(query, [sessionId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    session: {
      id: row.session_id,
      userId: row.user_id,
      createdAt: row.session_created_at,
      expiresAt: row.expires_at,
    },
    user: {
      id: row.user_id,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      passwordHash: row.password_hash,
      isActive: row.is_active,
      createdAt: row.user_created_at,
      updatedAt: row.user_updated_at,
    },
  };
}

export async function deleteSession(
  sessionId: string,
  client?: PoolClient
): Promise<void> {
  const db = client || getPool();
  const query = `
    DELETE FROM sessions
    WHERE id = $1;
  `;
  await db.query(query, [sessionId]);
}

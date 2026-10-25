import crypto from 'crypto';
import { PoolClient } from 'pg';
import { getPool } from '../db/pool';

export interface StoredIdempotencyRecord {
  key: string;
  userId: string;
  requestHash: string;
  responseStatus: number;
  responseBody: any;
  createdAt: string;
}

/**
 * Serializes an object to canonical JSON with sorted keys and no insignificant whitespace.
 */
export function canonicalJsonString(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonString).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJsonString(obj[k])).join(',') + '}';
}

/**
 * Computes SHA-256 hash of canonical JSON string of request body.
 */
export function hashRequestBody(body: any): string {
  const canonical = canonicalJsonString(body);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export async function findIdempotencyKey(
  userId: string,
  key: string,
  client?: PoolClient
): Promise<StoredIdempotencyRecord | null> {
  const db = client || getPool();
  const query = `
    SELECT user_id, key, request_hash, response_status, response_body, created_at
    FROM idempotency_keys
    WHERE user_id = $1 AND key = $2
    LIMIT 1;
  `;
  const result = await db.query(query, [userId, key]);
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  return {
    userId: row.user_id,
    key: row.key,
    requestHash: row.request_hash,
    responseStatus: row.response_status,
    responseBody: row.response_body,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Implements Tech Spec 9.3 step 5 & 6:
 * Inserts initial idempotency placeholder row with ON CONFLICT DO NOTHING.
 * If concurrent request is running with the same key, PostgreSQL index lock pauses
 * this insert until the first request commits or rolls back.
 */
export async function insertInitialIdempotencyKey(
  userId: string,
  key: string,
  requestHash: string,
  client: PoolClient
): Promise<{ inserted: boolean; record: StoredIdempotencyRecord | null }> {
  const insertQuery = `
    INSERT INTO idempotency_keys (user_id, key, request_hash, response_status, response_body, created_at)
    VALUES ($1, $2, $3, 0, '{}'::jsonb, now())
    ON CONFLICT (user_id, key) DO NOTHING
    RETURNING user_id, key, request_hash, response_status, response_body, created_at;
  `;
  const insertRes = await client.query(insertQuery, [userId, key, requestHash]);

  if (insertRes.rows.length > 0) {
    return { inserted: true, record: null };
  }

  // Row already exists or concurrent request committed
  const selectQuery = `
    SELECT user_id, key, request_hash, response_status, response_body, created_at
    FROM idempotency_keys
    WHERE user_id = $1 AND key = $2;
  `;
  const selectRes = await client.query(selectQuery, [userId, key]);
  const row = selectRes.rows[0];

  return {
    inserted: false,
    record: row
      ? {
          userId: row.user_id,
          key: row.key,
          requestHash: row.request_hash,
          responseStatus: row.response_status,
          responseBody: row.response_body,
          createdAt: row.created_at.toISOString(),
        }
      : null,
  };
}

export async function updateFinalIdempotencyKey(
  userId: string,
  key: string,
  responseStatus: number,
  responseBody: any,
  client: PoolClient
): Promise<void> {
  const query = `
    UPDATE idempotency_keys
    SET response_status = $3,
        response_body = $4
    WHERE user_id = $1 AND key = $2;
  `;
  await client.query(query, [
    userId,
    key,
    responseStatus,
    JSON.stringify(responseBody),
  ]);
}

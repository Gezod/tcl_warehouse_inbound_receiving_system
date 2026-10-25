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

export async function saveIdempotencyKey(
  userId: string,
  key: string,
  requestHash: string,
  responseStatus: number,
  responseBody: any,
  client?: PoolClient
): Promise<void> {
  const db = client || getPool();
  const query = `
    INSERT INTO idempotency_keys (
      user_id,
      key,
      request_hash,
      response_status,
      response_body,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, now())
    ON CONFLICT (user_id, key) DO UPDATE 
    SET response_status = EXCLUDED.response_status,
        response_body = EXCLUDED.response_body;
  `;
  await db.query(query, [
    userId,
    key,
    requestHash,
    responseStatus,
    JSON.stringify(responseBody),
  ]);
}

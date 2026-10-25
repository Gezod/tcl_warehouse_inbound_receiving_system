import { Pool } from 'pg';
import { getEnv } from '../config/env';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const env = getEnv();
  const connectionString =
    env.NODE_ENV === 'test' && env.TEST_DATABASE_URL
      ? env.TEST_DATABASE_URL
      : env.DATABASE_URL;

  pool = new Pool({
    connectionString,
    max: 25, // supports concurrency test requirement of at least 20 connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });

  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

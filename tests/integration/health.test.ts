import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { checkLiveness, checkReadiness } from '@/src/server/services/health.service';
import { getPool, closePool } from '@/src/server/db/pool';

dotenv.config();

describe('Health and Schema Integration Tests (against PostgreSQL)', () => {
  beforeAll(async () => {
    // Ensure pool can connect
    const pool = getPool();
    const client = await pool.connect();
    client.release();
  });

  afterAll(async () => {
    await closePool();
  });

  it('Liveness returns status ok', () => {
    const result = checkLiveness();
    expect(result).toEqual({ status: 'ok' });
  });

  it('Readiness returns 200 with database up and migrations up_to_date', async () => {
    const { statusCode, data } = await checkReadiness();
    expect(statusCode).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.database).toBe('up');
    expect(data.migrations).toBe('up_to_date');
  });

  it('Readiness returns 503 with migrations pending when an unapplied migration file exists', async () => {
    // Create temporary directory with an unapplied migration
    const tempDir = path.resolve(process.cwd(), 'migrations_temp_test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    fs.writeFileSync(path.join(tempDir, '99999999999999_unapplied.ts'), '// dummy migration');

    try {
      const { statusCode, data } = await checkReadiness(tempDir);
      expect(statusCode).toBe(503);
      expect(data.status).toBe('error');
      expect(data.database).toBe('up');
      expect(data.migrations).toBe('pending');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('Verifies all 10 required domain tables and pgmigrations exist in the database', async () => {
    const pool = getPool();
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tables = result.rows.map((r: { table_name: string }) => r.table_name);

    const requiredTables = [
      'users',
      'sessions',
      'products',
      'document_number_counters',
      'receiving_documents',
      'receiving_lines',
      'receipts',
      'inventory_transactions',
      'idempotency_keys',
      'audit_logs',
      'pgmigrations',
    ];

    for (const table of requiredTables) {
      expect(tables).toContain(table);
    }
  });

  it('Verifies seeded Operator and Supervisor exist with correct roles', async () => {
    const pool = getPool();
    const result = await pool.query(`
      SELECT username, full_name, role, is_active 
      FROM users 
      ORDER BY role ASC
    `);

    expect(result.rows.length).toBeGreaterThanOrEqual(2);
    const operator = result.rows.find((u: { role: string }) => u.role === 'OPERATOR');
    const supervisor = result.rows.find((u: { role: string }) => u.role === 'SUPERVISOR');

    expect(operator).toBeDefined();
    expect(operator.is_active).toBe(true);
    expect(supervisor).toBeDefined();
    expect(supervisor.is_active).toBe(true);
  });
});

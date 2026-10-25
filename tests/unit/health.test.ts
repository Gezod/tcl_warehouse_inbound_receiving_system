import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkLiveness, checkReadiness } from '@/src/server/services/health.service';
import * as poolModule from '@/src/server/db/pool';
import fs from 'fs';

vi.mock('@/src/server/db/pool');

describe('Health and Readiness Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('checkLiveness returns status ok', () => {
    const result = checkLiveness();
    expect(result).toEqual({ status: 'ok' });
  });

  it('checkReadiness returns 503 when database is unreachable', async () => {
    vi.spyOn(poolModule, 'getPool').mockReturnValue({
      connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
    } as any);

    const result = await checkReadiness();
    expect(result.statusCode).toBe(503);
    expect(result.data).toEqual({
      status: 'error',
      database: 'down',
      migrations: 'pending',
    });
  });

  it('checkReadiness returns 503 when migration files exist but pgmigrations table does not exist', async () => {
    const mockClient = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT 1')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }] });
        }
        if (sql.includes('information_schema.tables')) {
          return Promise.resolve({ rows: [{ exists: false }] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    vi.spyOn(poolModule, 'getPool').mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as any);

    // Mock fs readdirSync to simulate 1 migration file
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['20261025000000_init.ts'] as any);

    const result = await checkReadiness('/fake/migrations');
    expect(result.statusCode).toBe(503);
    expect(result.data).toEqual({
      status: 'error',
      database: 'up',
      migrations: 'pending',
    });
  });

  it('checkReadiness returns 503 when some migrations are pending', async () => {
    const mockClient = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT 1')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }] });
        }
        if (sql.includes('information_schema.tables')) {
          return Promise.resolve({ rows: [{ exists: true }] });
        }
        if (sql.includes('SELECT name FROM pgmigrations')) {
          return Promise.resolve({ rows: [{ name: '20261025000000_init' }] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    vi.spyOn(poolModule, 'getPool').mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as any);

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue([
      '20261025000000_init.ts',
      '20261025000001_next.ts',
    ] as any);

    const result = await checkReadiness('/fake/migrations');
    expect(result.statusCode).toBe(503);
    expect(result.data).toEqual({
      status: 'error',
      database: 'up',
      migrations: 'pending',
    });
  });

  it('checkReadiness returns 200 when database is connected and all migrations are applied', async () => {
    const mockClient = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT 1')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }] });
        }
        if (sql.includes('information_schema.tables')) {
          return Promise.resolve({ rows: [{ exists: true }] });
        }
        if (sql.includes('SELECT name FROM pgmigrations')) {
          return Promise.resolve({
            rows: [
              { name: '20261025000000_init' },
              { name: '20261025000001_next' },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    vi.spyOn(poolModule, 'getPool').mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    } as any);

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue([
      '20261025000000_init.ts',
      '20261025000001_next.ts',
    ] as any);

    const result = await checkReadiness('/fake/migrations');
    expect(result.statusCode).toBe(200);
    expect(result.data).toEqual({
      status: 'ok',
      database: 'up',
      migrations: 'up_to_date',
    });
  });
});

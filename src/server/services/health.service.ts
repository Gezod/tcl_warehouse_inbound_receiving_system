import fs from 'fs';
import path from 'path';
import { getPool } from '../db/pool';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  database?: 'up' | 'down';
  migrations?: 'up_to_date' | 'pending';
}

export interface ReadinessResult {
  statusCode: number;
  data: HealthCheckResult;
}

export function checkLiveness(): HealthCheckResult {
  return { status: 'ok' };
}

export async function checkReadiness(migrationsDir?: string): Promise<ReadinessResult> {
  const pool = getPool();
  let client;

  try {
    client = await pool.connect();
  } catch (err) {
    return {
      statusCode: 503,
      data: {
        status: 'error',
        database: 'down',
        migrations: 'pending',
      },
    };
  }

  try {
    // 1. Check basic DB connectivity
    await client.query('SELECT 1');

    // 2. Check migrations status
    const targetDir = migrationsDir || path.resolve(process.cwd(), 'migrations');
    let migrationFiles: string[] = [];

    if (fs.existsSync(targetDir)) {
      migrationFiles = fs
        .readdirSync(targetDir)
        .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
        .sort();
    }

    // Check if pgmigrations table exists
    const tableCheckResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'pgmigrations'
      ) AS exists;
    `);

    const pgmigrationsExists = tableCheckResult.rows[0]?.exists === true;

    if (migrationFiles.length > 0 && !pgmigrationsExists) {
      return {
        statusCode: 503,
        data: {
          status: 'error',
          database: 'up',
          migrations: 'pending',
        },
      };
    }

    if (pgmigrationsExists) {
      const appliedResult = await client.query('SELECT name FROM pgmigrations ORDER BY id ASC');
      const appliedNames = new Set(appliedResult.rows.map((r: { name: string }) => r.name));

      const hasPending = migrationFiles.some((fileName) => {
        const baseName = fileName.replace(/\.(ts|js)$/, '');
        return !appliedNames.has(baseName) && !appliedNames.has(fileName);
      });

      if (hasPending) {
        return {
          statusCode: 503,
          data: {
            status: 'error',
            database: 'up',
            migrations: 'pending',
          },
        };
      }
    }

    return {
      statusCode: 200,
      data: {
        status: 'ok',
        database: 'up',
        migrations: 'up_to_date',
      },
    };
  } catch (err) {
    console.error('Readiness check error:', err);
    return {
      statusCode: 503,
      data: {
        status: 'error',
        database: 'down',
        migrations: 'pending',
      },
    };
  } finally {
    client.release();
  }
}

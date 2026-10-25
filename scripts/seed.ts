import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { getPool, closePool } from '../src/server/db/pool';

dotenv.config();

async function seed() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const operatorUsername = (process.env.SEED_OPERATOR_USERNAME || 'operator').toLowerCase().trim();
  const operatorPassword = process.env.SEED_OPERATOR_PASSWORD || 'OperatorPass123!';
  const supervisorUsername = (process.env.SEED_SUPERVISOR_USERNAME || 'supervisor').toLowerCase().trim();
  const supervisorPassword = process.env.SEED_SUPERVISOR_PASSWORD || 'SupervisorPass123!';

  if (nodeEnv === 'production') {
    if (operatorPassword.length < 12 || supervisorPassword.length < 12) {
      throw new Error('In production, seed passwords must be at least 12 characters long.');
    }
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const operatorHash = await bcrypt.hash(operatorPassword, 12);
    const supervisorHash = await bcrypt.hash(supervisorPassword, 12);

    // Upsert Operator
    await client.query(
      `
      INSERT INTO users (username, full_name, role, password_hash, is_active, updated_at)
      VALUES ($1, $2, 'OPERATOR', $3, true, now())
      ON CONFLICT (username) 
      DO UPDATE SET 
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        password_hash = EXCLUDED.password_hash,
        is_active = true,
        updated_at = now();
      `,
      [operatorUsername, 'Warehouse Operator', operatorHash]
    );

    // Upsert Supervisor
    await client.query(
      `
      INSERT INTO users (username, full_name, role, password_hash, is_active, updated_at)
      VALUES ($1, $2, 'SUPERVISOR', $3, true, now())
      ON CONFLICT (username) 
      DO UPDATE SET 
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        password_hash = EXCLUDED.password_hash,
        is_active = true,
        updated_at = now();
      `,
      [supervisorUsername, 'Warehouse Supervisor', supervisorHash]
    );

    await client.query('COMMIT');
    console.log(`Seed completed successfully:
  - Operator: ${operatorUsername}
  - Supervisor: ${supervisorUsername}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed script failed:', err);
    throw err;
  } finally {
    client.release();
    await closePool();
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

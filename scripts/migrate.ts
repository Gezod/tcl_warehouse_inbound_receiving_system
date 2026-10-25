import runner from 'node-pg-migrate';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function runMigrations(direction: 'up' | 'down' = 'up') {
  const databaseUrl =
    process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL
      ? process.env.TEST_DATABASE_URL
      : process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations.');
  }

  await runner({
    databaseUrl,
    dir: path.resolve(process.cwd(), 'migrations'),
    direction,
    migrationsTable: 'pgmigrations',
    verbose: true,
    singleTransaction: true,
  });
}

const direction = process.argv.includes('down') ? 'down' : 'up';

runMigrations(direction)
  .then(() => {
    console.log(`Migrations ${direction} completed successfully.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`Migration ${direction} failed:`, err);
    process.exit(1);
  });

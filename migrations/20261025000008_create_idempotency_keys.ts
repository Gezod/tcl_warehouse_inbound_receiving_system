import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE idempotency_keys (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key varchar(64) NOT NULL,
      request_hash char(64) NOT NULL,
      response_status integer NOT NULL,
      response_body jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, key)
    );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS idempotency_keys CASCADE;
  `);
}

import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username varchar(50) NOT NULL UNIQUE CONSTRAINT users_username_check CHECK (username ~ '^[a-z0-9._-]{3,50}$'),
      full_name varchar(120) NOT NULL CONSTRAINT users_full_name_check CHECK (length(full_name) >= 1),
      role varchar(20) NOT NULL CONSTRAINT users_role_check CHECK (role IN ('OPERATOR', 'SUPERVISOR')),
      password_hash text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX users_role_active_idx ON users (role, is_active);

    CREATE TABLE sessions (
      id varchar(64) PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    );

    CREATE INDEX sessions_user_id_idx ON sessions (user_id);
    CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS sessions CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `);
}

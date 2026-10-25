import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE audit_logs (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      request_id varchar(64),
      actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
      action varchar(60) NOT NULL,
      entity_type varchar(40) NOT NULL,
      entity_id uuid,
      before_data jsonb,
      after_data jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX audit_entity_idx ON audit_logs (entity_type, entity_id);
    CREATE INDEX audit_created_idx ON audit_logs (created_at DESC);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS audit_logs CASCADE;
  `);
}

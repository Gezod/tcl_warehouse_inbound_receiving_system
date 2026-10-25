import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE document_number_counters (
      year integer PRIMARY KEY,
      last_value integer NOT NULL DEFAULT 0
    );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS document_number_counters CASCADE;
  `);
}

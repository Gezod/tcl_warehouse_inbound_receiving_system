import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE receipts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id uuid NOT NULL,
      document_id uuid NOT NULL REFERENCES receiving_documents(id) ON DELETE RESTRICT,
      line_id uuid NOT NULL REFERENCES receiving_lines(id) ON DELETE RESTRICT,
      received_qty integer NOT NULL CONSTRAINT receipts_qty_positive CHECK (received_qty >= 1),
      note varchar(255),
      received_at timestamptz NOT NULL,
      recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      recorded_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX receipts_line_idx ON receipts (line_id);
    CREATE INDEX receipts_document_recorded_idx ON receipts (document_id, recorded_at DESC);
    CREATE INDEX receipts_batch_idx ON receipts (batch_id);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS receipts CASCADE;
  `);
}

import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE receiving_lines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id uuid NOT NULL REFERENCES receiving_documents(id) ON DELETE RESTRICT,
      product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      expected_qty integer NOT NULL
        CONSTRAINT lines_expected_qty_check CHECK (expected_qty BETWEEN 1 AND 1000000),
      received_qty integer NOT NULL DEFAULT 0
        CONSTRAINT lines_received_qty_non_negative CHECK (received_qty >= 0)
        CONSTRAINT lines_received_qty_lte_expected CHECK (received_qty <= expected_qty),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT receiving_lines_doc_prod_uq UNIQUE (document_id, product_id)
    );

    CREATE INDEX receiving_lines_product_idx ON receiving_lines (product_id);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS receiving_lines CASCADE;
  `);
}

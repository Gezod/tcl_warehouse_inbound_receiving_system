import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE inventory_transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      type varchar(20) NOT NULL CONSTRAINT inv_tx_type_check CHECK (type IN ('RECEIPT')),
      product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity integer NOT NULL CONSTRAINT inv_tx_quantity_check CHECK (quantity > 0),
      document_id uuid NOT NULL REFERENCES receiving_documents(id) ON DELETE RESTRICT,
      line_id uuid NOT NULL REFERENCES receiving_lines(id) ON DELETE RESTRICT,
      receipt_id uuid UNIQUE REFERENCES receipts(id) ON DELETE RESTRICT,
      created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX inv_tx_product_created_idx ON inventory_transactions (product_id, created_at DESC);
    CREATE INDEX inv_tx_created_idx ON inventory_transactions (created_at DESC, id DESC);
    CREATE INDEX inv_tx_document_idx ON inventory_transactions (document_id);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS inventory_transactions CASCADE;
  `);
}

import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE receiving_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      document_number varchar(16) NOT NULL UNIQUE
        CONSTRAINT receiving_docs_doc_num_check CHECK (document_number ~ '^RD-[0-9]{4}-[0-9]{6}$'),
      status varchar(24) NOT NULL
        CONSTRAINT receiving_docs_status_check CHECK (status IN ('DRAFT', 'OPEN', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED')),
      supplier_name varchar(150) NOT NULL
        CONSTRAINT receiving_docs_supplier_name_check CHECK (length(supplier_name) >= 1),
      supplier_key varchar(150) NOT NULL,
      reference_number varchar(60),
      expected_arrival_date date,
      notes varchar(1000),
      created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      submitted_at timestamptz,
      completed_at timestamptz,
      cancelled_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX receiving_documents_supplier_ref_uq 
      ON receiving_documents (supplier_key, reference_number) 
      WHERE reference_number IS NOT NULL;

    CREATE INDEX receiving_documents_status_created_idx 
      ON receiving_documents (status, created_at DESC);

    CREATE INDEX receiving_documents_created_idx 
      ON receiving_documents (created_at DESC);

    CREATE INDEX receiving_documents_expected_idx 
      ON receiving_documents (expected_arrival_date);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS receiving_documents CASCADE;
  `);
}

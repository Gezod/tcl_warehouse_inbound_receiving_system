import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sku varchar(32) NOT NULL UNIQUE 
        CONSTRAINT products_sku_upper_check CHECK (sku = upper(sku))
        CONSTRAINT products_sku_format_check CHECK (sku ~ '^[A-Z0-9][A-Z0-9._-]*$'),
      name varchar(150) NOT NULL CONSTRAINT products_name_check CHECK (length(name) >= 1),
      base_unit varchar(20) NOT NULL DEFAULT 'pcs',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX products_is_active_idx ON products (is_active);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS products CASCADE;
  `);
}

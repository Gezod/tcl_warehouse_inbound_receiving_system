import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_mutation_trigger()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Table % is append-only. Updates and deletes are forbidden.', TG_TABLE_NAME;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER receipts_no_mutation
    BEFORE UPDATE OR DELETE ON receipts
    FOR EACH ROW
    EXECUTE FUNCTION prevent_mutation_trigger();

    CREATE TRIGGER inventory_transactions_no_mutation
    BEFORE UPDATE OR DELETE ON inventory_transactions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_mutation_trigger();

    CREATE TRIGGER audit_logs_no_mutation
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_mutation_trigger();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TRIGGER IF EXISTS receipts_no_mutation ON receipts;
    DROP TRIGGER IF EXISTS inventory_transactions_no_mutation ON inventory_transactions;
    DROP TRIGGER IF EXISTS audit_logs_no_mutation ON audit_logs;
    DROP FUNCTION IF EXISTS prevent_mutation_trigger();
  `);
}

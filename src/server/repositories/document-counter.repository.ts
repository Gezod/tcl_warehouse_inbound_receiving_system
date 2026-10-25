import { PoolClient } from 'pg';
import { getEnv } from '../config/env';

export async function generateDocumentNumber(client: PoolClient): Promise<string> {
  const env = getEnv();
  // Determine year in APP_TIMEZONE
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: env.APP_TIMEZONE,
    year: 'numeric',
  });
  const currentYear = parseInt(formatter.format(now), 10);

  const query = `
    INSERT INTO document_number_counters (year, last_value)
    VALUES ($1, 1)
    ON CONFLICT (year) DO UPDATE SET last_value = document_number_counters.last_value + 1
    RETURNING last_value;
  `;

  const result = await client.query(query, [currentYear]);
  const counterValue = result.rows[0].last_value as number;
  const paddedCounter = counterValue.toString().padStart(6, '0');

  return `RD-${currentYear}-${paddedCounter}`;
}

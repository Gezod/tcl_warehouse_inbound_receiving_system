import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().optional(),
  APP_TIMEZONE: z.string().default('Asia/Jakarta'),
  SESSION_TTL_HOURS: z.coerce.number().min(1).default(8),
  SEED_OPERATOR_USERNAME: z.string().optional(),
  SEED_OPERATOR_PASSWORD: z.string().optional(),
  SEED_SUPERVISOR_USERNAME: z.string().optional(),
  SEED_SUPERVISOR_PASSWORD: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env | null = null;

export function getEnv(): Env {
  if (parsedEnv) {
    return parsedEnv;
  }

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    const errorMessages = Object.entries(formatted)
      .filter(([k]) => k !== '_errors')
      .map(([k, v]) => `${k}: ${(v as any)._errors?.join(', ')}`)
      .join('; ');
    throw new Error(`Startup environment validation failed: ${errorMessages}`);
  }

  parsedEnv = result.data;
  return parsedEnv;
}

export function resetEnvForTesting(): void {
  parsedEnv = null;
}

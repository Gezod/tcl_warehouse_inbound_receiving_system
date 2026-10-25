import { describe, it, expect, beforeEach } from 'vitest';
import { getEnv, resetEnvForTesting } from '@/src/server/config/env';

describe('Startup Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetEnvForTesting();
    process.env = { ...originalEnv };
  });

  it('successfully parses valid environment configuration', () => {
    process.env.DATABASE_URL = 'postgres://app:test@localhost:5432/warehouse';
    process.env.APP_TIMEZONE = 'Asia/Jakarta';
    process.env.PORT = '3000';

    const env = getEnv();
    expect(env.DATABASE_URL).toBe('postgres://app:test@localhost:5432/warehouse');
    expect(env.APP_TIMEZONE).toBe('Asia/Jakarta');
    expect(env.PORT).toBe(3000);
    expect(env.SESSION_TTL_HOURS).toBe(8);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('throws an error if DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;

    expect(() => getEnv()).toThrowError(/Startup environment validation failed/);
  });

  it('applies default values for optional environment variables', () => {
    process.env.DATABASE_URL = 'postgres://app:test@localhost:5432/warehouse';
    delete process.env.APP_TIMEZONE;
    delete process.env.PORT;
    delete process.env.SESSION_TTL_HOURS;

    const env = getEnv();
    expect(env.APP_TIMEZONE).toBe('Asia/Jakarta');
    expect(env.PORT).toBe(3000);
    expect(env.SESSION_TTL_HOURS).toBe(8);
  });
});

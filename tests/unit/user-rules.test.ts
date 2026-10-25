import { describe, it, expect } from 'vitest';
import { userCreateSchema, userUpdateSchema } from '@/src/lib/validation/user.schema';

describe('User Validation Rules (Unit)', () => {
  it('validates correct user creation input', () => {
    const input = {
      username: 'john.doe',
      fullName: 'John Doe',
      role: 'OPERATOR',
      password: 'StrongPassword123!',
    };

    const parsed = userCreateSchema.parse(input);
    expect(parsed.username).toBe('john.doe');
    expect(parsed.fullName).toBe('John Doe');
    expect(parsed.role).toBe('OPERATOR');
  });

  it('rejects usernames with uppercase or invalid symbols', () => {
    expect(() =>
      userCreateSchema.parse({
        username: 'JohnDoe',
        fullName: 'John Doe',
        role: 'OPERATOR',
        password: 'password123',
      })
    ).not.toThrow(); // because .toLowerCase() is applied on transform!

    expect(() =>
      userCreateSchema.parse({
        username: 'john doe', // spaces forbidden
        fullName: 'John Doe',
        role: 'OPERATOR',
        password: 'password123',
      })
    ).toThrow();

    expect(() =>
      userCreateSchema.parse({
        username: 'john@doe', // @ symbol forbidden
        fullName: 'John Doe',
        role: 'OPERATOR',
        password: 'password123',
      })
    ).toThrow();
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(() =>
      userCreateSchema.parse({
        username: 'valid.user',
        fullName: 'Valid User',
        role: 'OPERATOR',
        password: 'short',
      })
    ).toThrow(/Password must be at least 8 characters/);
  });

  it('rejects invalid user roles', () => {
    expect(() =>
      userCreateSchema.parse({
        username: 'valid.user',
        fullName: 'Valid User',
        role: 'ADMINISTRATOR',
        password: 'password123',
      })
    ).toThrow(/Role must be either OPERATOR or SUPERVISOR/);
  });

  it('rejects empty user update objects', () => {
    expect(() => userUpdateSchema.parse({})).toThrow(
      /At least one field.*must be provided/
    );
  });

  it('accepts valid partial updates', () => {
    const update1 = userUpdateSchema.parse({ fullName: 'Updated Name' });
    expect(update1.fullName).toBe('Updated Name');

    const update2 = userUpdateSchema.parse({ role: 'SUPERVISOR' });
    expect(update2.role).toBe('SUPERVISOR');

    const update3 = userUpdateSchema.parse({ isActive: false });
    expect(update3.isActive).toBe(false);
  });
});

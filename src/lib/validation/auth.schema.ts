import { z } from 'zod';

export const loginSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters.')
    .max(50, 'Username must not exceed 50 characters.')
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must not exceed 128 characters.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

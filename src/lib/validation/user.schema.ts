import { z } from 'zod';

export const userCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters.')
    .max(50, 'Username must not exceed 50 characters.')
    .regex(
      /^[a-z0-9._-]+$/,
      'Username may only contain alphanumeric characters, dots, underscores, and hyphens.'
    ),
  fullName: z
    .string()
    .trim()
    .min(1, 'Full name is required.')
    .max(120, 'Full name must not exceed 120 characters.'),
  role: z.enum(['OPERATOR', 'SUPERVISOR'], {
    errorMap: () => ({ message: 'Role must be either OPERATOR or SUPERVISOR.' }),
  }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must not exceed 128 characters.'),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Full name is required.')
      .max(120, 'Full name must not exceed 120 characters.')
      .optional(),
    role: z.enum(['OPERATOR', 'SUPERVISOR'], {
      errorMap: () => ({ message: 'Role must be either OPERATOR or SUPERVISOR.' }),
    }).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.fullName !== undefined ||
      data.role !== undefined ||
      data.isActive !== undefined,
    {
      message: 'At least one field (fullName, role, or isActive) must be provided for update.',
    }
  );

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
});

export type UserQueryInput = z.infer<typeof userQuerySchema>;

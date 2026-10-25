import bcrypt from 'bcryptjs';
import { AppError } from '../errors';
import { getEnv } from '../config/env';
import { generateSessionToken, hashToken } from '../auth/token';
import { findUserByUsername } from '../repositories/user.repository';
import { createSession, deleteSession, findActiveSessionWithUser } from '../repositories/session.repository';
import { CurrentUser } from '@/src/types/domain';
import { LoginInput } from '@/src/lib/validation/auth.schema';

// Standard 60-character bcrypt hash to ensure constant-time comparison when user is not found
const DUMMY_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uE6fM7x5q5X7V1A8O3Z1q4W8s5Y6Z7mG';

export interface LoginResult {
  user: CurrentUser;
  token: string;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const username = input.username.toLowerCase().trim();
  const user = await findUserByUsername(username);

  if (!user || !user.isActive) {
    // Run compare against dummy hash to prevent username enumeration timing attacks
    await bcrypt.compare(input.password, DUMMY_HASH);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Username or password is incorrect.');
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Username or password is incorrect.');
  }

  const token = generateSessionToken();
  const sessionId = hashToken(token);

  const env = getEnv();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 3600 * 1000);

  await createSession(sessionId, user.id, expiresAt);

  return {
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    },
    token,
  };
}

export async function logout(token: string | null): Promise<void> {
  if (!token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const sessionId = hashToken(token);
  await deleteSession(sessionId);
}

export async function getCurrentUser(token: string | null): Promise<CurrentUser> {
  if (!token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const sessionId = hashToken(token);
  const active = await findActiveSessionWithUser(sessionId);

  if (!active) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  return {
    id: active.user.id,
    username: active.user.username,
    fullName: active.user.fullName,
    role: active.user.role,
  };
}

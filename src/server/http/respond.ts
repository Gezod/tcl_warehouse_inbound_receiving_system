import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from '../errors';

export function jsonResponse<T>(data: T, status: number = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function errorResponse(error: unknown, requestId?: string): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (requestId) {
    headers['X-Request-Id'] = requestId;
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        code: error.code,
        message: error.message,
        ...(error.field ? { field: error.field } : {}),
        ...(error.details && error.details.length > 0 ? { details: error.details } : {}),
      },
      { status: error.statusCode, headers }
    );
  }

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const field = firstIssue ? firstIssue.path.join('.') : undefined;
    const message = firstIssue ? firstIssue.message : 'Validation error';

    return NextResponse.json(
      {
        code: 'VALIDATION_ERROR',
        message,
        ...(field ? { field } : {}),
      },
      { status: 400, headers }
    );
  }

  // Fallback for unexpected internal errors (no stack trace leaked to client)
  console.error('Unhandled server error:', error);
  return NextResponse.json(
    {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal error occurred.',
    },
    { status: 500, headers }
  );
}

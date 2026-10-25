export interface ApiErrorPayload {
  code: string;
  message: string;
  field?: string;
  details?: Array<{
    lineId?: string;
    requested?: number;
    remaining?: number;
    code?: string;
    message?: string;
  }>;
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly field?: string;
  public readonly details?: ApiErrorPayload['details'];

  constructor(statusCode: number, payload: ApiErrorPayload) {
    super(payload.message || 'API request failed');
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = payload.code || 'UNKNOWN_ERROR';
    this.field = payload.field;
    this.details = payload.details;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('/') ? `/api${endpoint}` : `/api/${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) {
    return {} as T;
  }

  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorPayload: ApiErrorPayload = data || {
      code: 'INTERNAL_ERROR',
      message: response.statusText || 'Request failed',
    };
    throw new ApiClientError(response.status, errorPayload);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};

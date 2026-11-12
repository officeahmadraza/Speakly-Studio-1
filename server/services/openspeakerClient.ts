import { config, isApiKeyConfigured } from '../config.js';

export class OpenSpeakerError extends Error {
  statusCode: number;
  retryAfter?: number;
  details?: unknown;

  constructor(message: string, statusCode: number = 500, retryAfter?: number, details?: unknown) {
    super(message);
    this.name = 'OpenSpeakerError';
    this.statusCode = statusCode;
    this.retryAfter = retryAfter;
    this.details = details;
  }
}

interface RequestOptions {
  method?: string;
  path: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export async function openspeakerRequest<T = any>(options: RequestOptions): Promise<T> {
  if (!isApiKeyConfigured()) {
    throw new OpenSpeakerError(
      'OpenSpeaker API key is not configured. Please add OPENSPEAKER_API_KEY to your environment or AI Studio Secrets.',
      503
    );
  }

  const { method = 'GET', path, body, headers = {}, timeoutMs = 30000 } = options;
  const url = `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const requestHeaders: Record<string, string> = {
    'xi-api-key': config.apiKey,
    ...headers,
  };

  try {
    const res = await fetch(url, {
      method,
      headers: requestHeaders,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Check for HTTP errors
    if (!res.ok) {
      const retryAfterHeader = res.headers.get('Retry-After');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

      let errorBody: any = null;
      try {
        const text = await res.text();
        try {
          errorBody = JSON.parse(text);
        } catch {
          errorBody = text;
        }
      } catch {
        // failed reading body
      }

      if (res.status === 401 || res.status === 403) {
        throw new OpenSpeakerError(
          'API authentication failed. Please check the server-side API configuration.',
          401,
          undefined,
          errorBody
        );
      }

      if (res.status === 429) {
        throw new OpenSpeakerError(
          'Rate limit exceeded upstream. Please wait before retrying.',
          429,
          retryAfter,
          errorBody
        );
      }

      if (res.status === 503) {
        throw new OpenSpeakerError(
          'OpenSpeaker service is currently busy or unavailable. Please retry in a few moments.',
          503,
          retryAfter,
          errorBody
        );
      }

      const errorMessage =
        (typeof errorBody === 'object' && errorBody?.message) ||
        (typeof errorBody === 'object' && errorBody?.error) ||
        (typeof errorBody === 'string' && errorBody.length > 0 && errorBody.length < 200 ? errorBody : null) ||
        `Upstream request failed with status ${res.status}`;

      throw new OpenSpeakerError(errorMessage, res.status, retryAfter, errorBody);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await res.json()) as T;
    }

    return (await res.text()) as unknown as T;
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err instanceof OpenSpeakerError) {
      throw err;
    }

    if (err.name === 'AbortError') {
      throw new OpenSpeakerError('Request to OpenSpeaker API timed out.', 504);
    }

    throw new OpenSpeakerError(
      `Network connection to OpenSpeaker failed: ${err.message || 'Unknown network error'}`,
      502
    );
  }
}

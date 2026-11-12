import {
  Voice,
  CatalogInspection,
  ServerAppConfig,
  TaskStatusResponse,
} from '../types/index.js';

export class ApiError extends Error {
  statusCode: number;
  retryAfter?: number;

  constructor(message: string, statusCode: number = 500, retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.retryAfter = retryAfter;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const retryAfterHeader = res.headers.get('Retry-After');
  const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

  let body: any = null;
  if (isJson) {
    try {
      body = await res.json();
    } catch {
      // json parse failed
    }
  } else {
    try {
      body = await res.text();
    } catch {
      // text parse failed
    }
  }

  if (!res.ok) {
    const errorMsg =
      (typeof body === 'object' && body?.error) ||
      (typeof body === 'object' && body?.message) ||
      (typeof body === 'string' && body.length < 200 ? body : null) ||
      `Request failed with status ${res.status}`;

    throw new ApiError(errorMsg, res.status, retryAfter);
  }

  return body as T;
}

export async function fetchServerConfig(): Promise<ServerAppConfig> {
  const res = await fetch('/api/config');
  return handleResponse<ServerAppConfig>(res);
}

export interface VerifyAccessCodeResponse {
  success: boolean;
  valid: boolean;
  required: boolean;
  message: string;
}

export async function verifyAccessCode(accessCode: string): Promise<VerifyAccessCodeResponse> {
  const res = await fetch('/api/access-code/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ accessCode }),
  });
  return handleResponse<VerifyAccessCodeResponse>(res);
}

export async function checkServerHealth(): Promise<any> {
  const res = await fetch('/api/health');
  return handleResponse<any>(res);
}

export async function fetchVoices(forceRefresh: boolean = false): Promise<{
  voices: Voice[];
  inspection: CatalogInspection;
}> {
  const url = forceRefresh ? '/api/voices?refresh=true' : '/api/voices';
  const res = await fetch(url);
  return handleResponse<{
    voices: Voice[];
    inspection: CatalogInspection;
  }>(res);
}

export async function refreshVoiceCatalog(): Promise<{
  voices: Voice[];
  inspection: CatalogInspection;
  message: string;
}> {
  const res = await fetch('/api/voices/refresh', {
    method: 'POST',
  });
  return handleResponse<{
    voices: Voice[];
    inspection: CatalogInspection;
    message: string;
  }>(res);
}

export interface CreateTTSPayload {
  text: string;
  voiceId: string;
  speed?: number;
  withTranscript?: boolean;
  fileName?: string;
  accessCode?: string;
}

export async function createTTSSpeech(payload: CreateTTSPayload): Promise<{
  success: boolean;
  taskId: string;
  voiceId: string;
  characterCount: number;
  wordCount: number;
  fileName?: string;
}> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function fetchTaskStatus(taskId: string): Promise<TaskStatusResponse> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`);
  const data = await handleResponse<{ success: boolean; task: TaskStatusResponse }>(res);
  return data.task;
}

export function getDownloadUrl(taskId: string, fileName?: string, audioUrl?: string | null): string {
  const searchParams = new URLSearchParams();
  if (fileName) searchParams.set('filename', fileName);
  if (audioUrl) searchParams.set('url', audioUrl);
  const q = searchParams.toString();
  return `/api/download/${encodeURIComponent(taskId)}${q ? `?${q}` : ''}`;
}

export function getVoicePreviewUrl(voice: Voice): string | null {
  if (!voice.previewUrl) return null;
  return `/api/voices/${encodeURIComponent(voice.id)}/preview?url=${encodeURIComponent(voice.previewUrl)}`;
}

export async function searchVoices(query: string): Promise<Voice[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  try {
    const res = await fetch(`/api/voices/search?q=${encodeURIComponent(trimmed)}`);
    const data = await handleResponse<{ success: boolean; voices: Voice[] }>(res);
    return data.voices || [];
  } catch (err) {
    console.warn('Voice search failed:', err);
    return [];
  }
}

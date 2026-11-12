import dotenv from 'dotenv';
dotenv.config();

export interface ServerConfig {
  apiKey: string;
  apiBaseUrl: string;
  maxTextChars: number;
  appAccessCode: string | null;
  audioHostAllowlist: string[];
  port: number;
}

const rawBaseUrl = process.env.OPENSPEAKER_API_BASE_URL || 'https://api.ai33.pro';
// Strip trailing slash if present
const apiBaseUrl = rawBaseUrl.replace(/\/+$/, '');

const maxTextChars = parseInt(process.env.MAX_TEXT_CHARS || '50000', 10);

const rawAllowlist = process.env.AUDIO_HOST_ALLOWLIST || 'api.ai33.pro,storage.googleapis.com';
const defaultAllowedHosts = [
  'api.ai33.pro',
  'ai33.pro',
  'r2.cloudflarestorage.com',
  'r2.dev',
  'amazonaws.com',
  'storage.googleapis.com',
  'elevenlabs.io',
  'openspeaker.ai',
  'cloudfront.net',
];
const parsedAllowlist = rawAllowlist
  .split(',')
  .map(h => h.trim().toLowerCase())
  .filter(Boolean);

export const config: ServerConfig = {
  apiKey: (process.env.OPENSPEAKER_API_KEY || 'sk_tcku5694nnz7n52j5culee3g71828dq2a3j4s0fy3mvccqtw').trim(),
  apiBaseUrl,
  maxTextChars: isNaN(maxTextChars) || maxTextChars <= 0 ? 50000 : maxTextChars,
  appAccessCode: (process.env.APP_ACCESS_CODE || '#161259#').trim() || null,
  audioHostAllowlist: Array.from(new Set([...defaultAllowedHosts, ...parsedAllowlist])),
  port: parseInt(process.env.PORT || '3000', 10),
};

export function isApiKeyConfigured(): boolean {
  return config.apiKey.length > 0;
}

export function registerObservedAudioHost(host: string): void {
  const normalized = host.toLowerCase().trim();
  if (normalized && !config.audioHostAllowlist.includes(normalized)) {
    config.audioHostAllowlist.push(normalized);
  }
}

import { openspeakerRequest } from './openspeakerClient.js';
import { config, isApiKeyConfigured } from '../config.js';

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'error';
  configured: boolean;
  apiBaseUrl: string;
  upstreamHealth?: any;
  message?: string;
  timestamp: string;
}

export async function checkHealth(): Promise<HealthCheckResult> {
  const timestamp = new Date().toISOString();
  const configured = isApiKeyConfigured();

  if (!configured) {
    return {
      status: 'degraded',
      configured: false,
      apiBaseUrl: config.apiBaseUrl,
      message: 'OPENSPEAKER_API_KEY is not configured. Server is running in configuration-pending state.',
      timestamp,
    };
  }

  try {
    const upstreamRes = await openspeakerRequest({
      method: 'GET',
      path: '/v1/health-check',
      timeoutMs: 8000,
    });

    return {
      status: 'ok',
      configured: true,
      apiBaseUrl: config.apiBaseUrl,
      upstreamHealth: upstreamRes,
      timestamp,
    };
  } catch (err: any) {
    return {
      status: 'degraded',
      configured: true,
      apiBaseUrl: config.apiBaseUrl,
      message: `Upstream health check failed: ${err.message}`,
      timestamp,
    };
  }
}

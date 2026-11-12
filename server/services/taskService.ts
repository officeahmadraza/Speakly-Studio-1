import { openspeakerRequest } from './openspeakerClient.js';
import { registerObservedAudioHost } from '../config.js';

export interface UpstreamTaskResult {
  taskId: string;
  status: 'pending' | 'processing' | 'generating' | 'done' | 'completed' | 'failed' | 'error';
  progress?: number;
  errorMessage?: string | null;
  creditCost?: number | null;
  audioUrl?: string | null;
  createdAt?: string;
  metadata?: Record<string, any>;
  raw?: any;
}

export async function fetchTaskStatus(taskId: string): Promise<UpstreamTaskResult> {
  const sanitizedTaskId = taskId.trim();
  if (!sanitizedTaskId) {
    throw new Error('Task ID is required');
  }

  const response = await openspeakerRequest<any>({
    method: 'GET',
    path: `/v1/task/${encodeURIComponent(sanitizedTaskId)}`,
    timeoutMs: 15000,
  });

  // Extract task payload (some APIs wrap in { data: ... } or return flat)
  const task = response?.data || response;

  const rawStatus = String(task?.status || 'pending').toLowerCase();
  let status: UpstreamTaskResult['status'] = 'pending';
  if (rawStatus === 'done' || rawStatus === 'completed' || rawStatus === 'success') {
    status = 'done';
  } else if (rawStatus === 'failed' || rawStatus === 'error') {
    status = 'failed';
  } else if (rawStatus === 'processing' || rawStatus === 'generating' || rawStatus === 'in_progress') {
    status = 'processing';
  }

  const metadata = task?.metadata || {};
  let audioUrl = metadata?.audio_url || metadata?.audioUrl || task?.audio_url || task?.audioUrl || null;

  if (audioUrl) {
    try {
      const parsed = new URL(audioUrl);
      registerObservedAudioHost(parsed.hostname);
    } catch {
      // ignore URL parsing error
    }
  }

  const creditCost =
    task?.credit_cost !== undefined ? Number(task.credit_cost) :
    metadata?.credit_cost !== undefined ? Number(metadata.credit_cost) :
    null;

  const errorMessage = task?.error_message || task?.error || metadata?.error_message || null;
  const progress = task?.progress !== undefined ? Number(task.progress) : undefined;

  return {
    taskId: sanitizedTaskId,
    status,
    progress,
    errorMessage,
    creditCost,
    audioUrl,
    createdAt: task?.created_at || task?.createdAt,
    metadata,
  };
}

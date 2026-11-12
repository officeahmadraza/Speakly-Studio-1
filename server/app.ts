import express, { Request, Response, NextFunction } from 'express';
import { config, isApiKeyConfigured } from './config.js';
import { createRateLimiter } from './rateLimiter.js';
import { checkHealth } from './services/healthService.js';
import {
  fetchVoiceCatalog,
  invalidateVoiceCache,
  getCachedVoiceById,
  searchUpstreamVoices,
} from './services/voiceService.js';
import { createTTSTask, checkAccessCode } from './services/ttsService.js';
import { fetchTaskStatus } from './services/taskService.js';
import { streamTaskAudio, streamPreviewAudio } from './services/downloadService.js';
import { OpenSpeakerError } from './services/openspeakerClient.js';


const app = express();

// Trust reverse proxy for correct req.ip handling in Cloud Run / container
app.set('trust proxy', 1);

// Standard JSON parser for non-file requests
app.use(express.json({ limit: '1mb' }));

// Normalize Netlify serverless function path prefixes
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '') || '/';
  }
  // Ensure requests starting without /api get prepended if matching API routes
  if (
    !req.url.startsWith('/api') &&
    (req.url.startsWith('/voices') ||
      req.url.startsWith('/tts') ||
      req.url.startsWith('/tasks') ||
      req.url.startsWith('/download') ||
      req.url.startsWith('/audio-proxy') ||
      req.url.startsWith('/access-code') ||
      req.url.startsWith('/config') ||
      req.url.startsWith('/health'))
  ) {
    req.url = `/api${req.url}`;
  }
  next();
});

// Rate limiters
const ttsRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 12,
  message: 'TTS generation limit reached. Please wait a minute before starting another task.',
});

const downloadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Audio download rate limit reached. Please wait a minute before downloading again.',
});

// API Routes

// 1. Health check
app.get('/api/health', async (_req: Request, res: Response) => {
  const health = await checkHealth();
  const statusCode = health.status === 'ok' ? 200 : health.configured ? 502 : 200;
  res.status(statusCode).json(health);
});

// 2. Safe Public Client Config (Never exposes API Key)
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    isConfigured: isApiKeyConfigured(),
    apiBaseUrl: config.apiBaseUrl,
    maxTextChars: config.maxTextChars,
    requiresAccessCode: Boolean(config.appAccessCode),
  });
});

// 2b. Verify App Access Code
app.post('/api/access-code/verify', (req: Request, res: Response) => {
  const { accessCode } = req.body || {};
  const result = checkAccessCode(accessCode);

  if (!result.valid) {
    return res.status(401).json({
      success: false,
      ...result,
    });
  }

  return res.json({
    success: true,
    ...result,
  });
});

// 3. Voices Catalog
app.get('/api/voices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const catalog = await fetchVoiceCatalog(forceRefresh);
    res.json({
      success: true,
      voices: catalog.voices,
      inspection: catalog.inspection,
      cachedAt: catalog.cachedAt,
      expiresAt: catalog.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

// Manual catalog refresh route
app.post('/api/voices/refresh', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    invalidateVoiceCache();
    const catalog = await fetchVoiceCatalog(true);
    res.json({
      success: true,
      voices: catalog.voices,
      inspection: catalog.inspection,
      message: 'Catalog refreshed successfully from OpenSpeaker provider.',
    });
  } catch (err) {
    next(err);
  }
});

// Search voices upstream across all 22,000+ ElevenLabs voices
app.get('/api/voices/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req.query.q as string) || '';
    if (!query.trim()) {
      return res.json({ success: true, voices: [] });
    }
    const voices = await searchUpstreamVoices(query.trim());
    res.json({
      success: true,
      voices,
    });
  } catch (err) {
    next(err);
  }
});

// Voice Preview Stream Proxy (handles upstream text/plain headers and CORS)
app.get('/api/voices/:voiceId/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const voiceId = req.params.voiceId;
    const directUrl = req.query.url as string | undefined;

    let targetUrl = directUrl && directUrl.trim().startsWith('http') ? directUrl.trim() : undefined;
    if (!targetUrl) {
      let voice = getCachedVoiceById(voiceId);
      if (!voice) {
        const catalog = await fetchVoiceCatalog();
        voice = catalog.voices.find(
          v => v.id === voiceId || v.id === `elevenlabs_${voiceId}` || `elevenlabs_${v.id}` === voiceId
        );
      }
      targetUrl = voice?.previewUrl || undefined;
    }

    if (!targetUrl) {
      return res.status(404).json({
        success: false,
        error: 'Preview audio not available for this voice.',
      });
    }

    await streamPreviewAudio(targetUrl, res);
  } catch (err) {
    next(err);
  }
});

// General Audio Stream Proxy (guarantees correct Content-Type: audio/mpeg and bypasses CORS)
app.get('/api/audio-proxy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUrl = req.query.url as string | undefined;
    if (!targetUrl || !targetUrl.trim().startsWith('http')) {
      return res.status(400).json({ success: false, error: 'Valid audio URL is required.' });
    }
    await streamPreviewAudio(targetUrl.trim(), res);
  } catch (err) {
    next(err);
  }
});

// 4. Create TTS Task
app.post('/api/tts', ttsRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, voiceId, speed, withTranscript, fileName, accessCode } = req.body || {};

    const result = await createTTSTask({
      text,
      voiceId,
      speed: speed !== undefined ? Number(speed) : undefined,
      withTranscript: Boolean(withTranscript),
      fileName,
      accessCode,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// 5. Poll Task Status
app.get('/api/tasks/:taskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId;
    const task = await fetchTaskStatus(taskId);
    res.json({
      success: true,
      task,
    });
  } catch (err) {
    next(err);
  }
});

// 6. Download Completed Audio
app.get('/api/download/:taskId', downloadRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = req.params.taskId;
    const customFileName = req.query.filename as string | undefined;
    const directUrl = (req.query.url as string | undefined) || undefined;
    await streamTaskAudio(taskId, res, customFileName, directUrl);
  } catch (err) {
    next(err);
  }
});

// Also support direct query endpoint /api/download?url=...&filename=...
app.get('/api/download', downloadRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = (req.query.taskId as string) || 'direct';
    const customFileName = req.query.filename as string | undefined;
    const directUrl = (req.query.url as string | undefined) || undefined;
    await streamTaskAudio(taskId, res, customFileName, directUrl);
  } catch (err) {
    next(err);
  }
});

// Centralized error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || (err instanceof OpenSpeakerError ? err.statusCode : 500);

  // Sanitized message: never leak keys or internal sensitive traces
  let message = err.message || 'An unexpected error occurred.';
  if (config.apiKey && message.includes(config.apiKey)) {
    message = message.replace(new RegExp(config.apiKey, 'g'), '[REDACTED]');
  }

  if (statusCode >= 500) {
    console.error('[ServerError]', err);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    statusCode,
    retryAfter: err.retryAfter,
  });
});

export { app };

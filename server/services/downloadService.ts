import { Response } from 'express';
import { fetchTaskStatus } from './taskService.js';
import { config, registerObservedAudioHost } from '../config.js';
import { OpenSpeakerError } from './openspeakerClient.js';

/**
 * Validate and stream generated audio file for a completed task or direct audio URL.
 * Inspects binary magic bytes to guarantee valid audio format and accurate extension
 * to prevent corrupt downloads in Windows Media Player and other media decoders.
 */
export async function streamTaskAudio(
  taskId: string,
  res: Response,
  customFileName?: string,
  directAudioUrl?: string
): Promise<void> {
  let targetUrl = directAudioUrl ? directAudioUrl.trim() : '';

  // If no direct URL provided, resolve through upstream task status
  if (!targetUrl) {
    if (!taskId || taskId === 'direct') {
      throw new OpenSpeakerError('Task ID or audio URL is required for download.', 400);
    }

    const task = await fetchTaskStatus(taskId);

    if (task.status !== 'done') {
      throw new OpenSpeakerError(
        `Audio is not ready for download. Current task status: ${task.status}`,
        400
      );
    }

    if (!task.audioUrl) {
      throw new OpenSpeakerError(
        'Completed task does not have an audio URL associated with it.',
        404
      );
    }

    targetUrl = task.audioUrl;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    throw new OpenSpeakerError('Invalid audio URL format.', 400);
  }

  // Security constraint: Must be HTTPS
  if (parsedUrl.protocol !== 'https:') {
    throw new OpenSpeakerError('Insecure audio source rejected. Only HTTPS sources are permitted.', 403);
  }

  // Register host in observed allowlist
  registerObservedAudioHost(parsedUrl.hostname);

  // Security constraint: Host must match allowlist or cloud audio storage
  const hostname = parsedUrl.hostname.toLowerCase();
  const isAllowedHost = config.audioHostAllowlist.some(allowed => {
    return hostname === allowed || hostname.endsWith(`.${allowed}`);
  });

  if (!isAllowedHost) {
    console.warn(`[DownloadService] Security alert: Host ${hostname} not in audio allowlist (${config.audioHostAllowlist.join(', ')})`);
    throw new OpenSpeakerError(
      `Audio host (${hostname}) is not authorized for direct streaming. Please contact system administrator.`,
      403
    );
  }

  // Fetch audio stream upstream
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const audioRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'VoiceStudio-Streamer/1.0',
        'Accept': 'audio/*, application/octet-stream;q=0.9, */*;q=0.8',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!audioRes.ok) {
      if (audioRes.status === 404 || audioRes.status === 410) {
        throw new OpenSpeakerError(
          'The generated audio file has expired upstream. Please generate a new speech sample.',
          410
        );
      }
      throw new OpenSpeakerError(
        `Failed to retrieve audio stream from storage provider (HTTP ${audioRes.status}).`,
        502
      );
    }

    if (!audioRes.body) {
      throw new OpenSpeakerError('Empty audio stream returned from source.', 502);
    }

    const reader = audioRes.body.getReader();
    const { done, value: firstChunk } = await reader.read();

    if (done || !firstChunk || firstChunk.length === 0) {
      throw new OpenSpeakerError('Source returned an empty audio stream.', 502);
    }

    // Inspect first bytes for non-audio error response (e.g. JSON or HTML error page)
    if (firstChunk[0] === 0x7B || (firstChunk[0] === 0x3C && firstChunk[1] === 0x21)) {
      // 0x7B is '{', 0x3C is '<'
      let errorBody = '';
      try {
        errorBody = new TextDecoder().decode(firstChunk.slice(0, 500));
        const parsed = JSON.parse(errorBody);
        throw new OpenSpeakerError(parsed.error || parsed.message || 'Upstream returned error instead of audio.', 502);
      } catch (e: any) {
        if (e instanceof OpenSpeakerError) throw e;
        throw new OpenSpeakerError('Upstream service returned invalid audio payload.', 502);
      }
    }

    // Magic-byte format detection
    let detectedExt = 'mp3';
    let detectedMime = 'audio/mpeg';

    // WAV: 'RIFF' .... 'WAVE'
    if (
      firstChunk.length >= 12 &&
      firstChunk[0] === 0x52 && // R
      firstChunk[1] === 0x49 && // I
      firstChunk[2] === 0x46 && // F
      firstChunk[3] === 0x46 && // F
      firstChunk[8] === 0x57 && // W
      firstChunk[9] === 0x41 && // A
      firstChunk[10] === 0x56 && // V
      firstChunk[11] === 0x45 // E
    ) {
      detectedExt = 'wav';
      detectedMime = 'audio/wav';
    } else if (
      // OGG: 'OggS'
      firstChunk.length >= 4 &&
      firstChunk[0] === 0x4F &&
      firstChunk[1] === 0x67 &&
      firstChunk[2] === 0x67 &&
      firstChunk[3] === 0x53
    ) {
      detectedExt = 'ogg';
      detectedMime = 'audio/ogg';
    } else {
      // Standard MP3 format
      detectedExt = 'mp3';
      detectedMime = 'audio/mpeg';
    }

    // Clean filename and ensure exact matching extension: default to 'Voice' unless user entered a custom name
    let rawName = (customFileName?.trim() || 'Voice')
      .replace(/\.(mp3|wav|ogg|aac|m4a|bin|json)$/i, '')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim();

    if (!rawName) rawName = 'Voice';
    const sanitizedFileName = `${rawName}.${detectedExt}`;

    // Upstream content length if known
    const upstreamLength = audioRes.headers.get('content-length');

    // Headers
    res.setHeader('Content-Type', detectedMime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanitizedFileName}"; filename*=UTF-8''${encodeURIComponent(sanitizedFileName)}`
    );
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');
    if (upstreamLength) {
      res.setHeader('Content-Length', upstreamLength);
    }

    // Stream the first chunk
    res.write(firstChunk);

    // Stream remaining chunks to Express response
    while (true) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      res.write(value);
    }

    res.end();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err instanceof OpenSpeakerError) throw err;
    if (err.name === 'AbortError') {
      throw new OpenSpeakerError('Audio download timed out while connecting to storage.', 504);
    }
    throw new OpenSpeakerError(`Stream transfer failed: ${err.message}`, 500);
  }
}

/**
 * Audio preview stream proxy (for preview audio if CORS restrictions occur)
 */
export async function streamPreviewAudio(urlStr: string, res: Response): Promise<void> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlStr);
  } catch {
    throw new OpenSpeakerError('Invalid preview URL format.', 400);
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new OpenSpeakerError('Only HTTPS preview URLs are permitted.', 403);
  }

  // Register observed audio host
  registerObservedAudioHost(parsedUrl.hostname);

  const hostname = parsedUrl.hostname.toLowerCase();
  const isAllowedHost = config.audioHostAllowlist.some(allowed => {
    return hostname === allowed || hostname.endsWith(`.${allowed}`);
  });

  if (!isAllowedHost) {
    throw new OpenSpeakerError(`Preview host ${hostname} is not allowed.`, 403);
  }

  const audioRes = await fetch(urlStr, {
    method: 'GET',
    headers: {
      'User-Agent': 'VoiceStudio-Preview/1.0',
      'Accept': 'audio/*, application/octet-stream;q=0.9, */*;q=0.8',
    },
  });

  if (!audioRes.ok) {
    throw new OpenSpeakerError('Preview audio unavailable.', audioRes.status);
  }

  // Determine correct audio MIME type.
  // Upstream CDNs (such as Google Cloud Storage for ElevenLabs) frequently serve MP3 files with
  // 'text/plain' or 'application/octet-stream', which causes HTML5 <audio> to fail with
  // "Failed to load because no supported source was found".
  let mimeType = 'audio/mpeg';
  const upstreamType = (audioRes.headers.get('content-type') || '').toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();

  if (upstreamType.startsWith('audio/')) {
    mimeType = upstreamType;
  } else if (pathname.endsWith('.wav')) {
    mimeType = 'audio/wav';
  } else if (pathname.endsWith('.ogg')) {
    mimeType = 'audio/ogg';
  } else {
    mimeType = 'audio/mpeg';
  }

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  const contentLength = audioRes.headers.get('content-length');
  if (contentLength) {
    res.setHeader('Content-Length', contentLength);
  }

  if (!audioRes.body) {
    res.status(404).end();
    return;
  }

  const reader = audioRes.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

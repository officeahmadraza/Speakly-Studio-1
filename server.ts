import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, isApiKeyConfigured } from './server/config.js';
import { app } from './server/app.js';

// Local / container entry point. Netlify uses netlify/functions/api.ts, which
// imports the Express app directly and never loads this file (or Vite).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Vite or Static Asset Integration
const isProduction = process.env.NODE_ENV === 'production';
const isNetlify = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);

if (!isProduction && !isNetlify) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else if (!isNetlify) {
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

if (!isNetlify) {
  const PORT = config.port;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VoiceStudio] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[VoiceStudio] OpenSpeaker API Base: ${config.apiBaseUrl}`);
    console.log(`[VoiceStudio] API Key configured: ${isApiKeyConfigured() ? 'YES' : 'NO'}`);
    console.log(`[VoiceStudio] Max text chars: ${config.maxTextChars}`);
    console.log(`[VoiceStudio] Audio allowlist hosts: ${config.audioHostAllowlist.join(', ')}`);
  });
}

export { app };

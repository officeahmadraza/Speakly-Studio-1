import type { Request, Response } from 'express';
import { app } from '../server.js';

// Vercel serverless handler for /api
export default function handler(req: Request, res: Response) {
  return app(req, res);
}

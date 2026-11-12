import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const store = new Map<string, RateLimitRecord>();
  const { windowMs, maxRequests, message = 'Too many requests. Please slow down.' } = options;

  // Cleanup old entries periodically (every 5 minutes)
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter(ts => now - ts < windowMs);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Resolve client IP safely
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : (req.socket.remoteAddress || '127.0.0.1');

    const now = Date.now();
    let record = store.get(clientIp);

    if (!record) {
      record = { timestamps: [] };
      store.set(clientIp, record);
    }

    // Filter to current window
    record.timestamps = record.timestamps.filter(ts => now - ts < windowMs);

    if (record.timestamps.length >= maxRequests) {
      const oldestInWindow = record.timestamps[0];
      const retryAfterSec = Math.ceil((oldestInWindow + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec > 0 ? retryAfterSec : 1);
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: retryAfterSec > 0 ? retryAfterSec : 1,
      });
    }

    record.timestamps.push(now);
    next();
  };
}

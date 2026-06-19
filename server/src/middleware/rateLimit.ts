
import type { NextFunction, Request, Response } from "express";

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export function rateLimit(opts: {
  /** Sustained requests allowed per window. */
  capacity: number;
  /** Window length in milliseconds. */
  windowMs: number;
}) {
  const buckets = new Map<string, Bucket>();
  const refillPerMs = opts.capacity / opts.windowMs;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(key) ?? { tokens: opts.capacity, updatedAt: now };

    // Refill proportionally to elapsed time, capped at capacity.
    const elapsed = now - bucket.updatedAt;
    bucket.tokens = Math.min(opts.capacity, bucket.tokens + elapsed * refillPerMs);
    bucket.updatedAt = now;

    if (bucket.tokens < 1) {
      res.status(429).json({ error: "Too many requests, slow down." });
      return;
    }
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    next();
  };
}

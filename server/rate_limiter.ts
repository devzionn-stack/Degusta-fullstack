import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

setInterval(() => {
  const agora = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < agora) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
}

export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 60000,
    max = 100,
    keyGenerator = (req) => req.session?.userId || req.ip || "anonymous",
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const agora = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetAt < agora) {
      entry = { count: 1, resetAt: agora + windowMs };
      rateLimitStore.set(key, entry);
    } else {
      entry.count++;
    }
    
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));
    
    if (entry.count > max) {
      return res.status(429).json({
        error: "Muitas requisições. Tente novamente em alguns minutos.",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: Math.ceil((entry.resetAt - agora) / 1000),
      });
    }
    
    next();
  };
}

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `auth:${req.ip}`,
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});

export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
});

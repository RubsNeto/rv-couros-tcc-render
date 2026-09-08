import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

interface RateEntry {
  count: number;
  resetAt: number;
}

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'",
    );
  }
  next();
};

export function noStoreApi(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "no-store");
  next();
}

export function parseRequestBody<T>(schema: ZodType<T>, req: Request, res: Response): T | null {
  const result = schema.safeParse(req.body);
  if (result.success) return result.data;
  res.status(400).json({
    error: "Os dados enviados não são válidos.",
    code: "INVALID_REQUEST",
    fields: result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "body",
      message: issue.message,
    })),
  });
  return null;
}

export function createRateLimiter(
  windowMs: number,
  max: number,
  keyPrefix: string,
): RequestHandler {
  const entries = new Map<string, RateEntry>();
  let operations = 0;
  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const current = entries.get(key);
    const entry =
      !current || current.resetAt <= now
        ? { count: 1, resetAt: now + windowMs }
        : { count: current.count + 1, resetAt: current.resetAt };
    entries.set(key, entry);

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({
        error: "Muitas tentativas em pouco tempo. Aguarde e tente novamente.",
        code: "RATE_LIMITED",
      });
      return;
    }
    operations += 1;
    if (operations % 250 === 0) {
      for (const [entryKey, value] of entries) {
        if (value.resetAt <= now) entries.delete(entryKey);
      }
    }
    next();
  };
}

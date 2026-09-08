import { createHash, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express, type RequestHandler } from "express";
import { createApp } from "./index.js";
import { createRateLimiter, securityHeaders } from "./security";

// Publication-only gateway. The evaluated training service remains unchanged.
export function createRenderApp(
  trainingApp: Express = createApp(),
  environment: NodeJS.ProcessEnv = process.env,
  now: () => number = Date.now,
): Express {
  const username = environment.DEMO_USER || "orientador";
  const password = environment.DEMO_PASSWORD;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(username)) {
    throw new Error("Configure DEMO_USER com letras, números, hífen ou sublinhado.");
  }
  if (!password || password.length < 20 || password.length > 256 || password !== password.trim()) {
    throw new Error("Configure DEMO_PASSWORD com 20 a 256 caracteres, sem espaços nas extremidades.");
  }
  const limitText = environment.DEMO_AI_REQUEST_LIMIT || "60";
  if (!/^\d+$/.test(limitText) || Number(limitText) < 1 || Number(limitText) > 500) {
    throw new Error("DEMO_AI_REQUEST_LIMIT deve ser um inteiro entre 1 e 500.");
  }
  const limit = Number(limitText);
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  const expected = digest(`${username}:${password}`);
  const failedLoginLimiter = createRateLimiter(60_000, 20, "demo-login");
  const authenticate: RequestHandler = (req, res, next) => {
    const header = req.get("authorization") || "";
    const encoded = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header);
    const supplied = encoded && header.length <= 1024
      ? Buffer.from(encoded[1], "base64").toString("utf8") : "";
    if (timingSafeEqual(digest(supplied), expected)) {
      next();
      return;
    }
    failedLoginLimiter(req, res, () => {
      res.setHeader("WWW-Authenticate", 'Basic realm="RV Couros - Demonstracao academica", charset="UTF-8"');
      res.status(401).type("text/plain").send("Acesso restrito. Informe o usuário e a senha da demonstração.");
    });
  };

  // This is an in-process request allowance, not a provider spending cap.
  // A restart clears it, and a feedback request can make an internal repair call.
  const windowMs = 24 * 60 * 60 * 1000;
  let resetAt = now() + windowMs;
  let requests = 0;
  const aiAllowance: RequestHandler = (req, res, next) => {
    if (req.method !== "POST") { next(); return; }
    const current = now();
    if (current >= resetAt) { requests = 0; resetAt = current + windowMs; }
    if (requests >= limit) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((resetAt - current) / 1000))));
      res.status(429).json({
        error: "O limite de uso desta demonstração foi atingido. Entre em contato com o responsável.",
        code: "DEMO_ALLOWANCE_EXCEEDED",
      });
      return;
    }
    requests += 1;
    next();
  };

  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    next();
  });
  // Render health checks cannot send the demonstration password.
  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "rv-couros-training" }));
  app.use(authenticate);
  app.use(["/api/training/message", "/api/training/finish"], aiAllowance);
  app.use(trainingApp);
  return app;
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (direct) {
  process.env.NODE_ENV = "production";
  if (!process.env.OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY.trim() === "sk-...") {
    throw new Error("Configure OPENAI_API_KEY no ambiente privado do Render.");
  }
  const port = Number(process.env.PORT || "10000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT inválida.");
  const host = process.env.HOST || "0.0.0.0";
  createRenderApp().listen(port, host, () => console.log("Demonstração acadêmica protegida iniciada."));
}

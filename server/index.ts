import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import {
  cancelTrainingSchema,
  finishTrainingSchema,
  startTrainingSchema,
  trainingMessageSchema,
} from "../shared/training";
import { openAiProvider } from "./ai-provider";
import { createRateLimiter, noStoreApi, parseRequestBody, securityHeaders } from "./security";
import { TrainingError, TrainingService } from "./training-service";

export function createApp(service = new TrainingService(openAiProvider)) {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(express.json({ limit: "16kb", strict: true }));
  app.use("/api", noStoreApi);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "rv-couros-training" });
  });

  app.get("/api/training/config", (_req, res) => {
    res.json(service.getConfig());
  });

  const startLimiter = createRateLimiter(60_000, 20, "training-start");
  const aiLimiter = createRateLimiter(60_000, 45, "training-ai");

  app.post("/api/training/start", startLimiter, (req, res, next) => {
    try {
      const body = parseRequestBody(startTrainingSchema, req, res);
      if (!body) return;
      res.status(201).json(service.start(body.productId, body.objectionId, body.difficulty));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/training/message", aiLimiter, async (req, res, next) => {
    try {
      const body = parseRequestBody(trainingMessageSchema, req, res);
      if (!body) return;
      res.json(await service.message(body.sessionId, body.message));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/training/finish", aiLimiter, async (req, res, next) => {
    try {
      const body = parseRequestBody(finishTrainingSchema, req, res);
      if (!body) return;
      res.json(await service.finish(body.sessionId));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/training/cancel", (req, res, next) => {
    try {
      const body = parseRequestBody(cancelTrainingSchema, req, res);
      if (!body) return;
      service.cancel(body.sessionId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Rota de API não encontrada.", code: "API_NOT_FOUND" });
  });

  const publicDir = path.resolve(import.meta.dirname, "..", "dist", "public");
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir, { index: false, maxAge: "1h" }));
    app.use((req, res, next) => {
      if (req.method !== "GET") {
        next();
        return;
      }
      res.sendFile(path.join(publicDir, "index.html"));
    });
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof TrainingError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({ error: "O corpo JSON não é válido.", code: "INVALID_JSON" });
      return;
    }
    const incident = randomUUID();
    console.error(`[API] incident=${incident}`, error);
    res.status(500).json({
      error: "Não foi possível concluir a operação. Tente novamente.",
      code: "INTERNAL_ERROR",
      incident,
    });
  });

  return app;
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  process.env.NODE_ENV ??= "production";
  const port = Number.parseInt(process.env.PORT ?? "3001", 10);
  const host = process.env.HOST?.trim() || "127.0.0.1";
  const app = createApp();
  app.listen(port, host, () => {
    const status = openAiProvider.status();
    console.log(
      `RV Couros TCC em http://${host}:${port} | IA=${status.available ? status.model : "não configurada"}`,
    );
  });
}

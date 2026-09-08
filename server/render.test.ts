import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createRenderApp } from "./render";
import { createApp } from "./index";
import { TrainingService } from "./training-service";

const password = "senha-ficticia-somente-para-testes";
const env = { DEMO_USER: "orientador", DEMO_PASSWORD: password };
function innerApp() {
  const app = express();
  app.get("/", (_req, res) => res.send("interface"));
  app.get("/assets/app.js", (_req, res) => res.send("asset"));
  app.post(["/api/training/message", "/api/training/finish"], (_req, res) => res.json({ ok: true }));
  return app;
}

describe("Proteção exclusiva da publicação no Render", () => {
  it("recusa iniciar sem senha ou com senha curta", () => {
    expect(() => createRenderApp(innerApp(), {})).toThrow("DEMO_PASSWORD");
    expect(() => createRenderApp(innerApp(), { DEMO_PASSWORD: "curta" })).toThrow("DEMO_PASSWORD");
  });
  it("valida usuário e limite, sem revelar valores secretos", () => {
    expect(() => createRenderApp(innerApp(), { ...env, DEMO_USER: "user:invalid" })).toThrow("DEMO_USER");
    for (const value of ["0", "501", "1.5", "60x", "-1"]) {
      expect(() => createRenderApp(innerApp(), { ...env, DEMO_AI_REQUEST_LIMIT: value })).toThrow("DEMO_AI_REQUEST_LIMIT");
    }
  });
  it("permite somente a checagem mínima de saúde sem senha", async () => {
    const app = createRenderApp(innerApp(), env);
    const result = await request(app).get("/api/health").expect(200);
    expect(result.body).toEqual({ ok: true, service: "rv-couros-training" });
    expect(result.headers["cache-control"]).toContain("no-store");
    expect(result.headers["x-robots-tag"]).toContain("noindex");
  });
  it("protege página, arquivos e rotas de API", async () => {
    const app = createRenderApp(innerApp(), env);
    for (const route of ["/", "/assets/app.js", "/api/training/config"]) {
      const result = await request(app).get(route).expect(401);
      expect(result.headers["www-authenticate"]).toContain("Basic");
      expect(result.text).not.toContain(password);
    }
    await request(app).post("/api/training/message").expect(401);
    await request(app).post("/api/training/finish").expect(401);
  });
  it("recusa credenciais erradas e cabeçalhos malformados", async () => {
    const app = createRenderApp(innerApp(), env);
    await request(app).get("/").auth("orientador", "incorreta").expect(401);
    await request(app).get("/").auth("outro", password).expect(401);
    await request(app).get("/").set("Authorization", "Basic !!!").expect(401);
    await request(app).get("/").set("Authorization", "Bearer token").expect(401);
  });
  it("aceita credenciais corretas sem alterar o conteúdo", async () => {
    const result = await request(createRenderApp(innerApp(), env)).get("/").auth("orientador", password).expect(200);
    expect(result.text).toBe("interface");
    expect(result.headers["cache-control"]).toContain("no-store");
  });
  it("limita tentativas inválidas sem bloquear credenciais corretas", async () => {
    const app = createRenderApp(innerApp(), env);
    for (let n = 0; n < 20; n++) await request(app).get("/").expect(401);
    await request(app).get("/").expect(429);
    await request(app).get("/").auth("orientador", password).expect(200);
    await request(app).get("/api/health").expect(200);
  });
  it("compartilha limite entre conversa e devolutiva, inclusive variações de rota", async () => {
    const app = createRenderApp(innerApp(), { ...env, DEMO_AI_REQUEST_LIMIT: "2" });
    await request(app).post("/api/training/message").auth("orientador", password).expect(200);
    await request(app).post("/API/TRAINING/FINISH/").auth("orientador", password).expect(200);
    const result = await request(app).post("/api/training/message").auth("orientador", password).expect(429);
    expect(result.body.code).toBe("DEMO_ALLOWANCE_EXCEEDED");
    expect(result.headers["retry-after"]).toBeDefined();
  });
  it("renova a cota após 24 horas e não cobra requisições não autorizadas", async () => {
    let clock = 0;
    const app = createRenderApp(innerApp(), { ...env, DEMO_AI_REQUEST_LIMIT: "1" }, () => clock);
    await request(app).post("/api/training/message").expect(401);
    await request(app).post("/api/training/message").auth("orientador", password).expect(200);
    clock = 24 * 60 * 60 * 1000;
    await request(app).post("/api/training/finish").auth("orientador", password).expect(200);
  });
  it("preserva o serviço de treinamento atrás da proteção", async () => {
    const service = new TrainingService({
      status: () => ({ available: true, provider: "openai", model: "gpt-5.6-luna" }),
      chat: async () => ({ text: "Pode me explicar melhor?", model: "test", requestId: null,
        usage: { promptTokens: null, completionTokens: null, totalTokens: null } }),
    });
    const app = createRenderApp(createApp(service), env);
    const config = await request(app).get("/api/training/config").auth("orientador", password).expect(200);
    expect(config.body.products).toHaveLength(5);
    const start = await request(app).post("/api/training/start").auth("orientador", password)
      .send({ productId: "vonixx-vfloc-500ml", objectionId: "price", difficulty: "medium" }).expect(201);
    await request(app).post("/api/training/message").auth("orientador", password)
      .send({ sessionId: start.body.sessionId, message: "Qual é sua principal dúvida?" }).expect(200);
    await request(app).post("/api/training/cancel").auth("orientador", password)
      .send({ sessionId: start.body.sessionId }).expect(204);
    expect(service.activeSessionCount()).toBe(0);
  });
});

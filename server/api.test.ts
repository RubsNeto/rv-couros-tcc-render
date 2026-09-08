import request from "supertest";
import { describe, expect, it } from "vitest";
import type { AiProvider } from "./ai-provider";
import { createApp } from "./index";
import { TrainingService } from "./training-service";

const fakeProvider: AiProvider = {
  status: () => ({ available: true, provider: "openai", model: "gpt-5.6-luna" }),
  chat: async () => ({
    text: "Certo. Pode explicar melhor?",
    model: "gpt-5.6-luna-test",
    requestId: "req_api",
    usage: { promptTokens: 5, completionTokens: 4, totalTokens: 9 },
  }),
};

describe("API de treinamento", () => {
  const app = createApp(new TrainingService(fakeProvider));

  it("expõe configuração pública sem fatos internos completos", async () => {
    const response = await request(app).get("/api/training/config").expect(200);
    expect(response.body.products).toHaveLength(5);
    expect(response.body.objections).toHaveLength(6);
    expect(response.body.scenarioCount).toBe(30);
    expect(response.body.products[0].facts).toBeUndefined();
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("rejeita conteúdo de produto enviado pelo navegador", async () => {
    const response = await request(app)
      .post("/api/training/start")
      .send({
        productId: "tekbond-spray-reposicionavel",
        objectionId: "price",
        difficulty: "medium",
        product: { name: "Produto adulterado" },
      })
      .expect(400);
    expect(response.body.code).toBe("INVALID_REQUEST");
  });

  it("rejeita IDs desconhecidos", async () => {
    const response = await request(app)
      .post("/api/training/start")
      .send({ productId: "produto-x", objectionId: "price", difficulty: "medium" })
      .expect(404);
    expect(response.body.code).toBe("SCENARIO_NOT_FOUND");
  });

  it("rejeita mensagem acima de 1.200 caracteres", async () => {
    const response = await request(app)
      .post("/api/training/message")
      .send({ sessionId: crypto.randomUUID(), message: "a".repeat(1201) })
      .expect(400);
    expect(response.body.code).toBe("INVALID_REQUEST");
  });

  it("não expõe stack trace em rota inexistente", async () => {
    const response = await request(app).get("/api/nao-existe").expect(404);
    expect(response.body.code).toBe("API_NOT_FOUND");
    expect(JSON.stringify(response.body)).not.toContain("stack");
  });

  it("aplica cabeçalhos de segurança e privacidade às respostas de API", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["permissions-policy"]).toContain("microphone=()");
    expect(response.headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("rejeita JSON malformado sem expor detalhes internos", async () => {
    const response = await request(app)
      .post("/api/training/start")
      .set("Content-Type", "application/json")
      .send('{"productId":')
      .expect(400);
    expect(response.body.code).toBe("INVALID_JSON");
    expect(JSON.stringify(response.body)).not.toContain("stack");
  });

  it("responde 429 ao exceder o limite de chamadas de IA", async () => {
    const isolatedApp = createApp(new TrainingService(fakeProvider));
    for (let index = 0; index < 45; index += 1) {
      await request(isolatedApp)
        .post("/api/training/message")
        .send({ sessionId: crypto.randomUUID(), message: "Mensagem válida" })
        .expect(404);
    }
    const response = await request(isolatedApp)
      .post("/api/training/message")
      .send({ sessionId: crypto.randomUUID(), message: "Mensagem válida" })
      .expect(429);
    expect(response.body.code).toBe("RATE_LIMITED");
    expect(response.headers["retry-after"]).toBeDefined();
    expect(response.headers["ratelimit-remaining"]).toBe("0");
  });

  it("encerra explicitamente uma sessão abandonada", async () => {
    const service = new TrainingService(fakeProvider);
    const isolatedApp = createApp(service);
    const started = await request(isolatedApp)
      .post("/api/training/start")
      .send({
        productId: "vonixx-vfloc-500ml",
        objectionId: "price",
        difficulty: "medium",
      })
      .expect(201);
    expect(service.activeSessionCount()).toBe(1);

    await request(isolatedApp)
      .post("/api/training/cancel")
      .send({ sessionId: started.body.sessionId })
      .expect(204);
    expect(service.activeSessionCount()).toBe(0);
  });
});

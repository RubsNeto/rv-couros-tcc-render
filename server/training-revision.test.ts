import { describe, expect, it } from "vitest";
import { feedbackJsonSchema, feedbackSchema } from "../shared/training";
import { clientSystemPrompt, feedbackMessages, fictionalContext } from "./training-prompts";
import { CONFIG_VERSION, FEEDBACK_MAX_TOKENS, getProduct, products, publicProducts } from "./training-config";
import { TrainingService } from "./training-service";
import type { AiProvider } from "./ai-provider";
import { hasEvidenceAnchor, matchesEvidenceAnchor } from "./evidence-anchors";

const basicFeedback = {
  summary: "Participação curta, sem evidência suficiente de competências comerciais.",
  strengths: [], improvements: [],
  suggestedResponse: "Entendo sua dúvida. Vamos consultar a informação específica na fonte cadastrada.",
  nextStep: "Conferir a fonte no cenário fictício.",
  criteria: { acknowledgedObjection: false, askedRelevantQuestion: false, usedSupportedFact: false, avoidedUnsupportedClaims: true, proposedNextStep: false },
  evidenceIds: [], sellerEvidence: [], suggestedEvidenceIds: [], claimsToCheck: [], unverifiedClaims: [],
};

async function finishWith(output: object, seller = "O Hidracouro é pronto para uso.") {
  const provider: AiProvider = {
    status: () => ({ available: true, provider: "openai", model: "test" }),
    chat: async (_messages, options) => ({
      text: options?.responseFormat ? JSON.stringify(output) : "Meus bancos são sintéticos e estão íntegros.",
      model: "test", requestId: "test", usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    }),
  };
  const service = new TrainingService(provider);
  const start = service.start("vonixx-hidracouro-500ml", "trust", "medium");
  await service.message(start.sessionId, seller);
  return service.finish(start.sessionId);
}

describe("regressões da auditoria de produtos de 08/09", () => {
  it("mantém três produtos comerciais e dois exclusivamente documentais", () => {
    expect(products.filter(p => p.trainingMode === "commercial")).toHaveLength(3);
    expect(products.filter(p => p.trainingMode === "documentary").map(p => p.id)).toEqual(["amazonas-am02-14kg", "kisafix-pvc-couro-especial"]);
    expect(publicProducts().every(p => p.trainingNote.length > 30)).toBe(true);
    expect(CONFIG_VERSION).toBe("rv-couros-2026-09-08-v2.1");
  });
  it("inclui os três fatos oficiais ausentes na auditoria", () => {
    expect(getProduct("tekbond-spray-reposicionavel")?.facts.find(f => f.id === "TEK-05")?.statement).toContain("15 e 20 cm");
    expect(getProduct("vonixx-vfloc-500ml")?.facts.find(f => f.id === "VFL-05")?.statement).toContain("atrito");
    expect(getProduct("vonixx-hidracouro-500ml")?.facts.find(f => f.id === "HID-05")?.statement).toContain("microfibra limpa e seca");
    expect(getProduct("vonixx-vfloc-500ml")?.facts.find(f => f.id === "VFL-05")?.statement).toContain("alto grau");
    expect(getProduct("vonixx-hidracouro-500ml")?.facts.find(f => f.id === "HID-03")?.statement).toContain("não substitui a limpeza");
  });
  it("corrige vínculos documentais e limita a generalização para plásticos", () => {
    expect(getProduct("tekbond-spray-reposicionavel")?.facts.find(f => f.id === "TEK-03")?.sourceUrl).not.toContain(".pdf");
    expect(getProduct("tekbond-spray-reposicionavel")?.facts.find(f => f.id === "TEK-04")?.sourceUrl).toContain("2025-09");
    expect(getProduct("vonixx-hidracouro-500ml")?.facts.find(f => f.id === "HID-04")?.sourceUrl).toBe("https://www.vonixx.com.br/produto/hidracouro/");
    expect(getProduct("vonixx-hidracouro-500ml")?.facts.find(f => f.id === "HID-02")?.statement).toContain("não autoriza generalizar");
  });
  it("prepara características fictícias consistentes para S25/S30 sem expô-las no catálogo", () => {
    expect(fictionalContext("vonixx-hidracouro-500ml")).toContain("couro sintético");
    expect(fictionalContext("vonixx-hidracouro-500ml")).toContain("sem rachaduras");
    const prompt = clientSystemPrompt(getProduct("vonixx-hidracouro-500ml")!, "deadline", "hard");
    expect(prompt).toContain("Não pergunte ao vendedor o material");
    expect(prompt).toContain("Não solicite nome completo");
    expect(publicProducts()[4]).not.toHaveProperty("fictionalContext");
  });
  it("proíbe usar teste em sobra para liberar material expressamente restrito", () => {
    expect(clientSystemPrompt(products[0], "trust", "hard")).toContain("um teste em sobra não revoga a restrição");
  });
  it("delimita modalidade documental no cliente e no avaliador", () => {
    const product = products.find(p => p.trainingMode === "documentary")!;
    expect(clientSystemPrompt(product, "price", "medium")).toContain("somente consulta documental");
    expect(feedbackMessages(product, "price", "medium", [])[0].content).toContain("não sugerir teste de aplicação");
  });
  it("não critica o uso explícito de dados fictícios", () => {
    expect(feedbackMessages(products[0], "price", "medium", [])[0].content).toContain("nunca recomende dados de clientes reais ou critique");
  });
  it("permite ausência de elogios e avaliação não verificável", () => {
    expect(feedbackSchema.safeParse({ ...basicFeedback, criteria: { ...basicFeedback.criteria, avoidedUnsupportedClaims: null }, unverifiedClaims: ["Informação não verificada nesta base."] }).success).toBe(true);
    expect(feedbackJsonSchema.properties.strengths.minItems).toBe(0);
    expect(feedbackJsonSchema.properties.criteria.properties.avoidedUnsupportedClaims.type).toContain("null");
    expect(FEEDBACK_MAX_TOKENS).toBe(2000);
  });
  it("exige os novos campos e rejeita nota numérica", () => {
    const { sellerEvidence: _ignored, ...incomplete } = basicFeedback;
    expect(feedbackSchema.safeParse(incomplete).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...basicFeedback, score: 10 }).success).toBe(false);
  });
  it("separa fontes da sugestão de fatos atribuídos ao vendedor", async () => {
    const result = await finishWith({ ...basicFeedback,
      evidenceIds: ["HID-01", "HID-02", "HID-04"],
      sellerEvidence: [{ evidenceId: "HID-01", sellerQuote: "O Hidracouro é pronto para uso." }],
      suggestedEvidenceIds: ["HID-02", "HID-04", "TEK-01", "INVENTADO"],
    });
    expect(result.feedback.evidenceIds).toEqual(["HID-01"]);
    expect(result.evidenceUsed.map(f => f.id)).toEqual(["HID-01"]);
    expect(result.suggestedEvidence.map(f => f.id)).toEqual(["HID-02", "HID-04"]);
  });
  it("remove atribuição com trecho só do cliente e trecho inventado", async () => {
    const result = await finishWith({ ...basicFeedback,
      sellerEvidence: [
        { evidenceId: "HID-02", sellerQuote: "Meus bancos são sintéticos e estão íntegros." },
        { evidenceId: "HID-04", sellerQuote: "Não usar em couro rachado." },
      ],
    });
    expect(result.feedback.sellerEvidence).toEqual([]);
    expect(result.feedback.criteria.usedSupportedFact).toBe(false);
  });
  it("não trata informação apenas ausente da base como erro", async () => {
    const result = await finishWith({ ...basicFeedback,
      criteria: { ...basicFeedback.criteria, avoidedUnsupportedClaims: false },
      unverifiedClaims: ["Aroma citado não verificado nesta base; conferir a fonte."],
    });
    expect(result.feedback.criteria.avoidedUnsupportedClaims).toBeNull();
    expect(result.feedback.claimsToCheck).toEqual([]);
  });
  it("mantém contradição como alerta mesmo com outra informação não verificada", async () => {
    const result = await finishWith({ ...basicFeedback,
      claimsToCheck: ["Recupera rachaduras: contradiz a restrição de uso."],
      unverifiedClaims: ["Aroma citado não verificado nesta base."],
    });
    expect(result.feedback.criteria.avoidedUnsupportedClaims).toBe(false);
  });
  it("tem critérios conservadores de atribuição para todos os fatos", () => {
    expect(products.flatMap(p => p.facts).every(f => hasEvidenceAnchor(f.id))).toBe(true);
  });
  it("consulta genérica não comprova material, restrição ou identificação", () => {
    const quote = "Antes de indicar, preciso confirmar o material e respeitar as limitações da ficha.";
    expect(matchesEvidenceAnchor("TEK-03", quote, [])).toBe(false);
    expect(matchesEvidenceAnchor("TEK-04", quote, [])).toBe(false);
    expect(matchesEvidenceAnchor("PVC-01", "Posso organizar uma comparação documentada.", [])).toBe(false);
  });
  it("aceita paráfrases com conteúdo específico sem exigir cópia da base", () => {
    expect(matchesEvidenceAnchor("VFL-05", "Ajuda no deslize e reduz o atrito da luva.", [])).toBe(true);
    expect(matchesEvidenceAnchor("HID-02", "Pode ser considerado para couro sintético.", [])).toBe(true);
  });
  it("não atribui como fato válido a mesma frase sinalizada como contradição", async () => {
    const quote="O Hidracouro recupera couro rachado.";
    const result=await finishWith({...basicFeedback,
      sellerEvidence:[{evidenceId:"HID-04",sellerQuote:quote}],
      claimsToCheck:[`“${quote}” contradiz a restrição de uso.`],
    },quote);
    expect(result.feedback.evidenceIds).toEqual([]);
    expect(result.feedback.criteria.usedSupportedFact).toBe(false);
    expect(matchesEvidenceAnchor("AM02-03", "A ficha do AM 02 garante que ele serve para todo tipo de couro.", [])).toBe(false);
  });
});

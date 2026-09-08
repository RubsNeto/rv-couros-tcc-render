import { randomUUID } from "node:crypto";
import type {
  Difficulty,
  TrainingConfigResponse,
  TrainingFinishResponse,
  TrainingMessageResponse,
  TrainingStartResponse,
} from "../shared/training";
import { feedbackJsonSchema, feedbackSchema } from "../shared/training";
import { matchesEvidenceAnchor } from "./evidence-anchors";
import type { AiProvider, ChatMessage, ChatResult } from "./ai-provider";
import {
  CONFIG_HASH,
  CONFIG_VERSION,
  MAX_SELLER_TURNS,
  CLIENT_MAX_TOKENS,
  FEEDBACK_MAX_TOKENS,
  difficulties,
  getScenario,
  objections,
  publicProducts,
  type ObjectionId,
  type ProductDefinition,
} from "./training-config";
import {
  clientSystemPrompt,
  feedbackMessages,
  repairFeedbackMessages,
} from "./training-prompts";

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 100;

interface UsageTotals {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

interface TrainingSession {
  id: string;
  product: ProductDefinition;
  objectionId: ObjectionId;
  difficulty: Difficulty;
  conversation: ChatMessage[];
  sellerTurns: number;
  startedAt: number;
  expiresAt: number;
  busy: boolean;
  modelReturned: string | null;
  requestId: string | null;
  usage: UsageTotals;
}

export class TrainingError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

function addNullable(left: number | null, right: number | null): number | null {
  if (left == null && right == null) return null;
  return (left ?? 0) + (right ?? 0);
}

function registerResult(session: TrainingSession, result: ChatResult): void {
  session.modelReturned = result.model ?? session.modelReturned;
  session.requestId = result.requestId ?? session.requestId;
  session.usage = {
    promptTokens: addNullable(session.usage.promptTokens, result.usage.promptTokens),
    completionTokens: addNullable(session.usage.completionTokens, result.usage.completionTokens),
    totalTokens: addNullable(session.usage.totalTokens, result.usage.totalTokens),
  };
}

export class TrainingService {
  private readonly sessions = new Map<string, TrainingSession>();

  constructor(
    private readonly ai: AiProvider,
    private readonly now: () => number = () => Date.now(),
  ) {}

  getConfig(): TrainingConfigResponse {
    const status = this.ai.status();
    return {
      company: {
        name: "RV Couros",
        appName: "Treinamento Comercial com IA",
        purpose: "Praticar conversas de venda com objeções em cenários fictícios e controlados.",
      },
      academicDisclosure:
        "Protótipo desenvolvido no contexto de TCC. O cliente é simulado por IA e o feedback não substitui orientação técnica ou avaliação humana.",
      dataPolicy:
        "Não informe nomes, telefones, pedidos ou qualquer dado real de clientes. Use somente situações fictícias.",
      configVersion: CONFIG_VERSION,
      configHash: CONFIG_HASH,
      ai: status,
      products: publicProducts(),
      objections,
      difficulties,
      maxSellerTurns: MAX_SELLER_TURNS,
      scenarioCount: publicProducts().length * objections.length,
    };
  }

  start(productId: string, objectionId: string, difficulty: Difficulty): TrainingStartResponse {
    this.cleanupExpired();
    if (!this.ai.status().available) {
      throw new TrainingError(
        "A inteligência artificial não está configurada no servidor.",
        503,
        "AI_NOT_CONFIGURED",
      );
    }
    if (this.sessions.size >= MAX_SESSIONS) {
      throw new TrainingError(
        "O protótipo atingiu o limite temporário de sessões. Tente novamente em alguns minutos.",
        503,
        "SESSION_CAPACITY",
      );
    }
    const resolved = getScenario(productId, objectionId);
    if (!resolved) {
      throw new TrainingError("Produto ou situação não encontrado.", 404, "SCENARIO_NOT_FOUND");
    }
    const { product, objection, scenario } = resolved;
    const id = randomUUID();
    const startedAt = this.now();
    const session: TrainingSession = {
      id,
      product,
      objectionId: objection.id as ObjectionId,
      difficulty,
      conversation: [{ role: "assistant", content: scenario.opening }],
      sellerTurns: 0,
      startedAt,
      expiresAt: startedAt + SESSION_TTL_MS,
      busy: false,
      modelReturned: null,
      requestId: null,
      usage: { promptTokens: null, completionTokens: null, totalTokens: null },
    };
    this.sessions.set(id, session);
    return {
      sessionId: id,
      persona: scenario.persona,
      scenario: {
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        objectionId: objection.id,
        objectionLabel: objection.label,
        difficulty,
      },
      message: scenario.opening,
      turnCount: 0,
      maxSellerTurns: MAX_SELLER_TURNS,
      startedAt: new Date(startedAt).toISOString(),
    };
  }

  async message(sessionId: string, sellerMessage: string): Promise<TrainingMessageResponse> {
    const session = this.requireSession(sessionId);
    if (session.busy) {
      throw new TrainingError("Aguarde a resposta atual antes de enviar outra.", 409, "SESSION_BUSY");
    }
    if (session.sellerTurns >= MAX_SELLER_TURNS) {
      throw new TrainingError("O limite de respostas foi atingido. Finalize o treino.", 409, "TURN_LIMIT");
    }
    session.busy = true;
    try {
      const nextConversation: ChatMessage[] = [
        ...session.conversation,
        { role: "user", content: sellerMessage },
      ];
      const result = await this.ai.chat(
        [
          {
            role: "system",
            content: clientSystemPrompt(session.product, session.objectionId, session.difficulty),
          },
          ...nextConversation,
        ],
        { maxTokens: CLIENT_MAX_TOKENS, reasoningEffort: "low" },
      );
      const clientText = result.text.replace(/^cliente\s*:\s*/i, "").trim();
      session.conversation = [
        ...nextConversation,
        { role: "assistant", content: clientText },
      ];
      session.sellerTurns += 1;
      session.expiresAt = this.now() + SESSION_TTL_MS;
      registerResult(session, result);
      return {
        message: clientText,
        turnCount: session.sellerTurns,
        mustFinish: session.sellerTurns >= MAX_SELLER_TURNS,
      };
    } finally {
      session.busy = false;
    }
  }

  async finish(sessionId: string): Promise<TrainingFinishResponse> {
    const session = this.requireSession(sessionId);
    if (session.busy) {
      throw new TrainingError("Aguarde a resposta atual antes de finalizar.", 409, "SESSION_BUSY");
    }
    if (session.sellerTurns < 1) {
      throw new TrainingError(
        "Envie pelo menos uma resposta antes de finalizar.",
        409,
        "NO_SELLER_MESSAGE",
      );
    }
    session.busy = true;
    try {
      const messages = feedbackMessages(
        session.product,
        session.objectionId,
        session.difficulty,
        session.conversation,
      );
      let result = await this.ai.chat(messages, {
        maxTokens: FEEDBACK_MAX_TOKENS,
        reasoningEffort: "low",
        responseFormat: { name: "training_feedback", schema: feedbackJsonSchema },
      });
      registerResult(session, result);
      let feedback = this.parseFeedback(result.text);
      if (!feedback) {
        result = await this.ai.chat(repairFeedbackMessages(messages, result.text), {
          maxTokens: FEEDBACK_MAX_TOKENS,
          reasoningEffort: "low",
          responseFormat: { name: "training_feedback", schema: feedbackJsonSchema },
        });
        registerResult(session, result);
        feedback = this.parseFeedback(result.text);
      }
      if (!feedback) {
        throw new TrainingError(
          "A IA não conseguiu gerar um feedback válido. O treino foi preservado; tente finalizar novamente.",
          502,
          "INVALID_AI_FEEDBACK",
        );
      }

      const allowed = new Set(session.product.facts.map((fact) => fact.id));
      // Exact seller-quote anchoring prevents attribution from the client or suggested answer.
      // It is not an entailment proof: semantic relevance still needs review.
      const sellerTexts = session.conversation.filter((message) => message.role === "user").map((message) => message.content);
      feedback.sellerEvidence = feedback.sellerEvidence.filter((item) =>
        allowed.has(item.evidenceId) && sellerTexts.some((text) => text.includes(item.sellerQuote)) &&
        matchesEvidenceAnchor(item.evidenceId, item.sellerQuote, feedback.claimsToCheck),
      );
      feedback.evidenceIds = [...new Set(feedback.sellerEvidence.map((item) => item.evidenceId))];
      feedback.criteria.usedSupportedFact = feedback.evidenceIds.length > 0;
      feedback.suggestedEvidenceIds = [...new Set(feedback.suggestedEvidenceIds)].filter((id) => allowed.has(id));
      feedback.criteria.avoidedUnsupportedClaims = feedback.claimsToCheck.length > 0
        ? false : feedback.unverifiedClaims.length > 0 ? null : true;
      const evidenceUsed = session.product.facts.filter((fact) =>
        feedback.evidenceIds.includes(fact.id),
      );
      const finishedAt = this.now();
      const response: TrainingFinishResponse = {
        feedback,
        evidenceUsed,
        suggestedEvidence: session.product.facts.filter((fact) => feedback.suggestedEvidenceIds.includes(fact.id)),
        metadata: {
          sessionId,
          configVersion: CONFIG_VERSION,
          modelRequested: this.ai.status().model,
          modelReturned: session.modelReturned,
          sellerTurns: session.sellerTurns,
          startedAt: new Date(session.startedAt).toISOString(),
          finishedAt: new Date(finishedAt).toISOString(),
          durationMs: Math.max(0, finishedAt - session.startedAt),
          promptTokens: session.usage.promptTokens,
          completionTokens: session.usage.completionTokens,
          totalTokens: session.usage.totalTokens,
          requestId: session.requestId,
        },
      };
      this.sessions.delete(sessionId);
      return response;
    } finally {
      const current = this.sessions.get(sessionId);
      if (current) current.busy = false;
    }
  }

  activeSessionCount(): number {
    this.cleanupExpired();
    return this.sessions.size;
  }

  cancel(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private parseFeedback(raw: string) {
    try {
      const json = JSON.parse(raw) as unknown;
      const result = feedbackSchema.safeParse(json);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  private requireSession(sessionId: string): TrainingSession {
    this.cleanupExpired();
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new TrainingError(
        "Sessão não encontrada ou expirada. Inicie um novo treino.",
        404,
        "SESSION_NOT_FOUND",
      );
    }
    return session;
  }

  private cleanupExpired(): void {
    const now = this.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(id);
    }
  }
}

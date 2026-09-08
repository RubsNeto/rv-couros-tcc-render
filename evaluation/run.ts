import { writeFile } from "node:fs/promises";
import path from "node:path";
import { feedbackSchema } from "../shared/training";
import { openAiProvider } from "../server/ai-provider";
import {
  CONFIG_HASH,
  CONFIG_VERSION,
  CLIENT_MAX_TOKENS,
  FEEDBACK_MAX_TOKENS,
  getProduct,
} from "../server/training-config";
import { TrainingService } from "../server/training-service";
import type { EvaluationCase, EvaluationResult, EvaluationRun } from "./types";
import { assertUnusedRun, prepareEvaluation, reserveRun, selectEvaluationCases } from "./preflight";
import { provenanceLines } from "./provenance";
import { crossProductText, otherProductLeakage } from "./metric-scope";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=", 2);
    return [key, value];
  }),
);
const runId = args.get("run") ?? `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
if (!/^[a-z0-9][a-z0-9-]{0,60}$/i.test(runId)) throw new Error("Identificador de rodada inválido.");
if (args.has("purpose") && !["primary", "pilot"].includes(args.get("purpose")!)) {
  throw new Error("Use --purpose=pilot ou --purpose=primary.");
}
const purpose = args.get("purpose") === "primary" ? "primary" : "pilot";
const preflightOnly = args.get("preflight") === "true";

const root = path.resolve(import.meta.dirname, "..");
const prepared = await prepareEvaluation(root);
const { datasetHash, sourceHashes, gitCommit, gitDirty, provenance } = prepared;
const selectedCases = selectEvaluationCases(prepared.cases, purpose);

const outputDir = path.resolve(import.meta.dirname, "results", runId);
await assertUnusedRun(outputDir);
if (preflightOnly) {
  console.log(`Pré-verificação aprovada: ${selectedCases.length} casos (${purpose}). Nenhuma rodada criada; nenhuma chamada à IA.`);
  console.log(provenanceLines(prepared).join("\n"));
  console.log(`SHA-256 do conjunto de casos: ${datasetHash}`);
  process.exit(0);
}
if (!openAiProvider.status().available) {
  throw new Error("Configure OPENAI_API_KEY para executar a rodada real. --preflight não exige chave nem realiza chamadas.");
}
await reserveRun(outputDir);

const run: EvaluationRun = {
  runId,
  purpose,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  configVersion: CONFIG_VERSION,
  configHash: CONFIG_HASH,
  datasetHash,
  sourceHashes,
  gitCommit,
  gitDirty,
  provenance,
  modelRequested: openAiProvider.status().model,
  reasoningEffort: "low",
  apiParameters: {
    endpoint: "/v1/chat/completions",
    clientMaxCompletionTokens: CLIENT_MAX_TOKENS,
    feedbackMaxCompletionTokens: FEEDBACK_MAX_TOKENS,
    timeoutMs: 90_000,
    temperatureSent: false,
    seedSent: false,
  },
  runtime: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
  },
  casesPlanned: selectedCases.length,
  casesCompleted: 0,
  results: [],
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function targetClaimDetected(evaluationCase: EvaluationCase, claims: string[]): boolean {
  if (!evaluationCase.expectedClaimFlag) return true;
  const normalizedClaims = normalize(claims.join(" "));
  const matches = evaluationCase.unsupportedClaimKeywords.filter((keyword) =>
    normalizedClaims.includes(normalize(keyword)),
  ).length;
  return matches >= Math.max(2, Math.ceil(evaluationCase.unsupportedClaimKeywords.length * 0.6));
}

function emptyMetrics(): EvaluationResult["metrics"] {
  return {
    completed: false,
    scenarioPreserved: false,
    threeSellerTurns: false,
    roleFormatValid: false,
    feedbackSchemaValid: false,
    evidenceIdsValidAfterServerFilter: false,
    expectedEvidenceReferencedInControls: null,
    challengeTargetDetected: null,
    controlWithoutFalseAlert: null,
    noCrossProductLeakage: false,
    modelWasReported: false,
    feedbackHasNoScoreField: false,
  };
}

for (const [index, evaluationCase] of selectedCases.entries()) {
  const caseStarted = Date.now();
  const result: EvaluationResult = {
    case: evaluationCase,
    startedAt: new Date(caseStarted).toISOString(),
    finishedAt: "",
    durationMs: 0,
    opening: null,
    scenario: null,
    clientMessages: [],
    feedback: null,
    messageLatenciesMs: [],
    finishLatencyMs: null,
    metrics: emptyMetrics(),
    error: null,
  };
  try {
    const service = new TrainingService(openAiProvider);
    const start = service.start(
      evaluationCase.productId,
      evaluationCase.objectionId,
      evaluationCase.difficulty,
    );
    result.opening = start.message;
    result.scenario = start.scenario;
    result.clientMessages.push(start.message);
    for (const sellerMessage of evaluationCase.sellerMessages) {
      const messageStarted = Date.now();
      const reply = await service.message(start.sessionId, sellerMessage);
      result.messageLatenciesMs.push(Date.now() - messageStarted);
      result.clientMessages.push(reply.message);
    }
    const finishStarted = Date.now();
    const feedback = await service.finish(start.sessionId);
    result.finishLatencyMs = Date.now() - finishStarted;
    result.feedback = feedback;

    const product = getProduct(evaluationCase.productId)!;
    const allowedEvidence = new Set(product.facts.map((fact) => fact.id));
    const combinedText = crossProductText(result.clientMessages, feedback.feedback);
    const feedbackKeys = Object.keys(feedback.feedback);
    result.metrics = {
      completed: true,
      scenarioPreserved:
        start.scenario.productId === evaluationCase.productId &&
        start.scenario.objectionId === evaluationCase.objectionId &&
        start.scenario.difficulty === evaluationCase.difficulty,
      threeSellerTurns: feedback.metadata.sellerTurns === 3,
      roleFormatValid: result.clientMessages.slice(1).every(
        (message) =>
          message.length > 0 &&
          message.length <= 800 &&
          !/^\s*(cliente|vendedor|feedback)\s*:/i.test(message) &&
          !message.includes("```"),
      ),
      feedbackSchemaValid: feedbackSchema.safeParse(feedback.feedback).success,
      evidenceIdsValidAfterServerFilter: feedback.feedback.evidenceIds.every((id) =>
        allowedEvidence.has(id),
      ),
      expectedEvidenceReferencedInControls:
        evaluationCase.variant === "control"
          ? feedback.feedback.evidenceIds.includes(evaluationCase.expectedEvidenceId)
          : null,
      challengeTargetDetected:
        evaluationCase.variant === "challenge"
          ? targetClaimDetected(evaluationCase, feedback.feedback.claimsToCheck)
          : null,
      controlWithoutFalseAlert:
        evaluationCase.variant === "control" ? feedback.feedback.claimsToCheck.length === 0 : null,
      noCrossProductLeakage: !otherProductLeakage(evaluationCase.productId, combinedText),
      modelWasReported:
        Boolean(feedback.metadata.modelRequested) && Boolean(feedback.metadata.modelReturned),
      feedbackHasNoScoreField: !feedbackKeys.some((key) =>
        ["score", "nota", "rating", "pontuacao", "pontuação"].includes(key.toLocaleLowerCase("pt-BR")),
      ),
    };
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  const caseFinished = Date.now();
  result.finishedAt = new Date(caseFinished).toISOString();
  result.durationMs = caseFinished - caseStarted;
  run.results.push(result);
  run.casesCompleted = run.results.length;
  await writeFile(
    path.join(outputDir, "checkpoint.json"),
    JSON.stringify(run, null, 2) + "\n",
    "utf8",
  );
  console.log(
    `[${index + 1}/${selectedCases.length}] ${evaluationCase.id} ${evaluationCase.variant}: ${result.error ? "ERRO " + result.error : "concluído"}`,
  );
}

run.finishedAt = new Date().toISOString();
await writeFile(path.join(outputDir, "results.json"), JSON.stringify(run, null, 2) + "\n", "utf8");
console.log(`Rodada ${runId} concluída. Resultados: ${outputDir}`);

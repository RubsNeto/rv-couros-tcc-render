import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvaluationRun } from "./types";
import { provenanceLines } from "./provenance";
import { crossProductMetricLabel, crossProductMetricScope } from "./metric-scope";

const runId = process.argv.find((arg) => arg.startsWith("--run="))?.split("=")[1];
if (!runId || !/^[a-z0-9][a-z0-9-]{0,60}$/i.test(runId)) {
  throw new Error("Use --run=identificador-da-rodada.");
}
const dir = path.resolve(import.meta.dirname, "results", runId);
const run = JSON.parse(await readFile(path.join(dir, "results.json"), "utf8")) as EvaluationRun;
const metricKeys = Object.keys(run.results[0]?.metrics ?? {}) as Array<
  keyof EvaluationRun["results"][number]["metrics"]
>;
const aggregates = Object.fromEntries(
  metricKeys.map((key) => {
    const applicable = run.results.filter((result) => result.metrics[key] !== null);
    return [
      key,
      {
        passed: applicable.filter((result) => result.metrics[key] === true).length,
        applicable: applicable.length,
      },
    ];
  }),
);
const successful = run.results.filter((result) => result.metrics.completed);
const durations = successful.map((result) => result.durationMs).sort((a, b) => a - b);
const median = durations.length
  ? durations.length % 2 === 1
    ? durations[Math.floor(durations.length / 2)]
    : (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2
  : null;
const percentile95 = durations.length
  ? durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)]
  : null;
const tokenFields = ["promptTokens", "completionTokens", "totalTokens"] as const;
const tokenSummary = Object.fromEntries(
  tokenFields.map((field) => {
    const values = successful
      .map((result) => result.feedback?.metadata[field])
      .filter((value): value is number => typeof value === "number");
    return [field, { sum: values.reduce((sum, value) => sum + value, 0), coverage: values.length }];
  }),
) as Record<(typeof tokenFields)[number], { sum: number; coverage: number }>;

const labels: Record<string, string> = {
  completed: "Casos concluídos",
  scenarioPreserved: "Produto, objeção e dificuldade preservados",
  threeSellerTurns: "Três falas do vendedor processadas",
  roleFormatValid: "Respostas mantiveram formato de cliente",
  feedbackSchemaValid: "Feedbacks válidos no esquema",
  evidenceIdsValidAfterServerFilter: "IDs de evidência válidos após filtro do servidor",
  expectedEvidenceReferencedInControls: "Evidência esperada referenciada nos controles",
  challengeTargetDetected: "Afirmação-alvo sinalizada nos desafios",
  controlWithoutFalseAlert: "Controles sem alerta indevido",
  noCrossProductLeakage: crossProductMetricLabel,
  modelWasReported: "Modelo solicitado e retornado registrados",
  feedbackHasNoScoreField: "Feedbacks sem campo de nota",
};

const metricRows = metricKeys
  .map((key) => {
    const { passed, applicable } = aggregates[key] as { passed: number; applicable: number };
    const proportion = applicable ? `${((passed / applicable) * 100).toFixed(1)}%` : "n/a";
    return `| ${labels[key]} | ${passed} | ${applicable} | ${proportion} |`;
  })
  .join("\n");
const summary = `# Relatório descritivo — ${run.runId}

## Escopo

- Natureza: ${run.purpose === "primary" ? "rodada principal" : "piloto"}.
- Casos planejados: ${run.casesPlanned}.
- Casos executados: ${run.casesCompleted}.
- Modelo solicitado: ${run.modelRequested}.
- Versão da configuração: ${run.configVersion}.
- Hash da configuração: ${run.configHash}.
- Hash do conjunto de casos: ${run.datasetHash}.
- Hash do arquivo de prompts: ${run.sourceHashes.promptsFile}.
- Hash do arquivo de configuração: ${run.sourceHashes.configFile}.
- Hash do arquivo de dependências: ${run.sourceHashes.packageLock}.
${provenanceLines(run).join("\n")}

## Resultados automáticos

| Critério | Atendidos | Total | Proporção |
|---|---:|---:|---:|
${metricRows}

${crossProductMetricScope}

## Operação

- Duração mínima por caso: ${durations.length ? durations[0] : "não disponível"} ms.
- Duração mediana por caso: ${median ?? "não disponível"} ms.
- Percentil 95 da duração: ${percentile95 ?? "não disponível"} ms.
- Duração máxima por caso: ${durations.length ? durations.at(-1) : "não disponível"} ms.
- Tokens de entrada: ${tokenSummary.promptTokens.coverage ? tokenSummary.promptTokens.sum : "não disponível"} (cobertura ${tokenSummary.promptTokens.coverage}/${successful.length}).
- Tokens de saída: ${tokenSummary.completionTokens.coverage ? tokenSummary.completionTokens.sum : "não disponível"} (cobertura ${tokenSummary.completionTokens.coverage}/${successful.length}).
- Tokens totais: ${tokenSummary.totalTokens.coverage ? tokenSummary.totalTokens.sum : "não disponível"} (cobertura ${tokenSummary.totalTokens.coverage}/${successful.length}).
- Erros: ${run.results.filter((result) => result.error).length}.

## Limite de interpretação

Os dados descrevem o comportamento técnico do protótipo nesta configuração, com entradas sintéticas e execução controlada. Não medem aprendizagem, usabilidade percebida, desempenho de vendedores, aumento de conversão ou resultados da RV Couros. A avaliação semântica do pesquisador deve ser relatada separadamente como revisão interna não independente.
`;
await writeFile(path.join(dir, "SUMMARY.md"), summary, "utf8");

const csvHeader = [
  "case_id",
  "product_id",
  "objection_id",
  "variant",
  ...metricKeys,
  "duration_ms",
  "total_tokens",
  "error",
];
const csvRows = run.results.map((result) =>
  [
    result.case.id,
    result.case.productId,
    result.case.objectionId,
    result.case.variant,
    ...metricKeys.map((key) =>
      result.metrics[key] === null ? "not_applicable" : String(result.metrics[key]),
    ),
    String(result.durationMs),
    String(result.feedback?.metadata.totalTokens ?? ""),
    result.error ?? "",
  ]
    .map((value) => `"${value.replaceAll('"', '""')}"`)
    .join(","),
);
await writeFile(path.join(dir, "results.csv"), [csvHeader.join(","), ...csvRows].join("\n") + "\n", "utf8");
console.log(`Relatório gerado: ${path.join(dir, "SUMMARY.md")}`);

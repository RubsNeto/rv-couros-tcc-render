import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getProduct, getScenario } from "../server/training-config";
import { resolveProvenance, sha256 } from "./provenance";
import type { EvaluationCase } from "./types";

export const DATASET_VERSION = "rv-couros-eval-v1";
// The reference input matrix remains immutable. Runs separately record the CURRENT configuration.
export const REFERENCE_CONFIG_VERSION = "rv-couros-2026-09-02-v1";
export const PILOT_IDS = ["S01", "S08", "S15", "S22", "S29", "S30"] as const;
const PRIMARY_IDS = Array.from({ length: 30 }, (_, index) => `S${String(index + 1).padStart(2, "0")}`);
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

const caseSchema = z.object({
  id: z.string().regex(/^S\d{2}$/), productId: z.string(), objectionId: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]), variant: z.enum(["control", "challenge"]),
  sellerMessages: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  expectedEvidenceId: z.string(), unsupportedClaim: z.string().nullable(),
  unsupportedClaimKeywords: z.array(z.string()), expectedClaimFlag: z.boolean(),
});

export function validateDataset(raw: string): EvaluationCase[] {
  const { cases } = z.object({
    datasetVersion: z.literal(DATASET_VERSION),
    configVersion: z.literal(REFERENCE_CONFIG_VERSION),
    cases: z.array(caseSchema).length(30),
  }).parse(JSON.parse(raw));
  if (new Set(cases.map((item) => item.id)).size !== 30 ||
    new Set(cases.map((item) => `${item.productId}/${item.objectionId}`)).size !== 30 ||
    cases.filter((item) => item.variant === "control").length !== 15 ||
    cases.filter((item) => item.variant === "challenge").length !== 15) {
    throw new Error("A matriz deve conter 30 combinações únicas, 15 controles e 15 desafios.");
  }
  if (cases.some((item) => !PRIMARY_IDS.includes(item.id))) {
    throw new Error("A matriz v1 deve conter exatamente os identificadores S01 a S30.");
  }
  for (const item of cases) {
    const product = getProduct(item.productId);
    if (!product || !getScenario(item.productId, item.objectionId) ||
      !product.facts.some((fact) => fact.id === item.expectedEvidenceId) ||
      item.difficulty !== "medium" || item.expectedClaimFlag !== (item.variant === "challenge")) {
      throw new Error(`Caso incompatível com a matriz v1: ${item.id}.`);
    }
    if (item.variant === "control") {
      if (item.unsupportedClaim !== null || item.unsupportedClaimKeywords.length !== 0) {
        throw new Error(`Gabarito de controle incompatível: ${item.id}.`);
      }
    } else {
      const claim = item.unsupportedClaim;
      const keywords = item.unsupportedClaimKeywords.map((keyword) => normalized(keyword.trim()));
      if (!claim || claim !== item.sellerMessages[1] || keywords.length < 3 ||
        new Set(keywords).size !== keywords.length ||
        keywords.some((keyword) => !keyword || !normalized(claim).includes(keyword))) {
        throw new Error(`Gabarito de desafio incompatível: ${item.id}.`);
      }
    }
  }
  return cases;
}

export function selectEvaluationCases(cases: EvaluationCase[], purpose: "pilot" | "primary"): EvaluationCase[] {
  const expectedIds: readonly string[] = purpose === "pilot" ? PILOT_IDS : PRIMARY_IDS;
  const selected = purpose === "pilot" ? cases.filter((item) => expectedIds.includes(item.id)) : cases;
  if (selected.length !== expectedIds.length || new Set(selected.map((item) => item.id)).size !== expectedIds.length ||
    expectedIds.some((id) => !selected.some((item) => item.id === id))) {
    throw new Error(`Seleção ${purpose} incompleta: esperados ${expectedIds.length} identificadores fixos.`);
  }
  return selected;
}

export async function prepareEvaluation(root: string) {
  const provenance = await resolveProvenance(root);
  const raw = await readFile(path.join(root, "evaluation/dataset.v1.json"), "utf8");
  const cases = validateDataset(raw);
  const fileHash = async (relativePath: string) => sha256(await readFile(path.join(root, relativePath)));
  const datasetHash = sha256(raw);
  return {
    ...provenance, cases, datasetHash,
    sourceHashes: {
      promptsFile: await fileHash("server/training-prompts.ts"),
      configFile: await fileHash("server/training-config.ts"),
      datasetFile: datasetHash, packageLock: await fileHash("pnpm-lock.yaml"),
      serviceFile: await fileHash("server/training-service.ts"),
      evidenceAnchorsFile: await fileHash("server/evidence-anchors.ts"),
      feedbackContractFile: await fileHash("shared/training.ts"),
    },
  };
}

export async function assertUnusedRun(outputDir: string): Promise<void> {
  try { await access(outputDir); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error("Identificador de rodada já utilizado. Escolha outro --run; resultados nunca são sobrescritos.");
}

export async function reserveRun(outputDir: string): Promise<void> {
  await mkdir(path.dirname(outputDir), { recursive: true });
  try { await mkdir(outputDir); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("Identificador de rodada já utilizado. Nenhum resultado foi sobrescrito.");
    }
    throw error;
  }
}

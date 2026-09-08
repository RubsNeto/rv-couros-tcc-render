import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { EvaluationRun } from "./types";

export const MANIFEST_NAME = "SOURCE_MANIFEST.json";
export const requiredSourceFiles = [
  "package.json", "pnpm-lock.yaml", "evaluation/run.ts", "evaluation/types.ts",
  "evaluation/dataset.v1.json", "server/training-prompts.ts", "server/training-config.ts",
  "server/training-service.ts", "server/ai-provider.ts", "shared/training.ts",
  "server/evidence-anchors.ts",
] as const;

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const sourceManifestSchema = z.object({
  schemaVersion: z.literal(1),
  packagedFromCommit: z.string().regex(/^[a-f0-9]{40,64}$/),
  sourceCommitDate: z.string().datetime({ offset: true }),
  files: z.record(z.string(), digest),
}).strict();
export type SourceManifest = z.infer<typeof sourceManifestSchema>;
export type ProvenanceResult = Pick<EvaluationRun, "gitCommit" | "gitDirty" | "provenance">;

export function sha256(contents: string | Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

export function isSourcePath(relativePath: string): boolean {
  const parts = relativePath.split("/");
  return relativePath.length > 0 && !relativePath.includes("\\") && !relativePath.includes(":") &&
    !path.posix.isAbsolute(relativePath) &&
    parts.every((part) => part !== "" && part !== "." && part !== "..") &&
    !parts.some((part) => [".git", "node_modules", "dist", "build", "logs"].includes(part)) &&
    !parts.some((part) => part.startsWith(".env") && part !== ".env.example") &&
    !relativePath.startsWith("evaluation/results/") && relativePath !== MANIFEST_NAME;
}

export function inspectGit(root: string): { commit: string; dirty: boolean } | null {
  let gitRoot: string;
  try {
    gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
  const normalized = (value: string) => process.platform === "win32"
    ? path.resolve(value).toLocaleLowerCase("en-US") : path.resolve(value);
  if (normalized(gitRoot) !== normalized(root)) return null;
  const git = (args: string[]) => execFileSync("git", args, {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  return { commit: git(["rev-parse", "HEAD"]), dirty: git(["status", "--porcelain"]).length > 0 };
}

export async function verifyPackage(root: string): Promise<ProvenanceResult> {
  let raw: Buffer;
  try {
    raw = await readFile(path.join(root, MANIFEST_NAME));
  } catch {
    throw new Error("Sem repositório Git próprio ou SOURCE_MANIFEST.json. Use o pacote de fonte oficial e íntegro.");
  }
  let document: unknown;
  try { document = JSON.parse(raw.toString("utf8")); } catch {
    throw new Error("Manifesto de fonte inválido: JSON malformado.");
  }
  const parsed = sourceManifestSchema.safeParse(document);
  if (!parsed.success) throw new Error("Manifesto de fonte inválido.");
  const manifest = parsed.data;
  if (requiredSourceFiles.some((file) => !(file in manifest.files))) {
    throw new Error("Manifesto incompleto: falta arquivo essencial da avaliação.");
  }
  const actualRoot = await realpath(root);
  for (const [relativePath, expected] of Object.entries(manifest.files)) {
    if (!isSourcePath(relativePath)) throw new Error("Manifesto contém caminho não permitido.");
    const target = path.join(root, relativePath);
    let actual: string;
    try {
      const resolved = await realpath(target);
      const relative = path.relative(actualRoot, resolved);
      if (relative.startsWith("..") || path.isAbsolute(relative) || !(await lstat(target)).isFile()) {
        throw new Error("Caminho fora do pacote ou arquivo não regular.");
      }
      actual = sha256(await readFile(target));
    } catch {
      throw new Error(`Arquivo do pacote ausente ou não permitido: ${relativePath}.`);
    }
    if (actual !== expected) throw new Error(`Integridade divergente: ${relativePath}. Extraia novamente o pacote oficial.`);
  }
  return {
    gitCommit: null,
    gitDirty: null,
    provenance: {
      kind: "verified-package", packagedFromCommit: manifest.packagedFromCommit,
      manifestSha256: sha256(raw),
    },
  };
}

export async function resolveProvenance(root: string): Promise<ProvenanceResult> {
  const git = inspectGit(root);
  return git ? { gitCommit: git.commit, gitDirty: git.dirty, provenance: { kind: "git" } }
    : verifyPackage(root);
}

export function provenanceLines(run: ProvenanceResult): string[] {
  if (run.provenance?.kind === "verified-package") {
    return [
      "- Proveniência: pacote verificado por hashes (não é um checkout Git).",
      `- Commit de origem declarado pelo manifesto: ${run.provenance.packagedFromCommit}.`,
      `- SHA-256 do manifesto: ${run.provenance.manifestSha256}.`,
      "- Commit local e estado da árvore Git: não verificáveis nesta extração.",
      "- O manifesto verifica integridade em relação ao pacote; não constitui assinatura de autenticidade.",
    ];
  }
  return [
    `- Proveniência: ${run.provenance ? "repositório Git" : "registro histórico de Git (formato anterior)"}.`,
    `- Commit: ${run.gitCommit ?? "não verificável"}.`,
    `- Árvore de trabalho estava alterada: ${run.gitDirty === null ? "não verificável" : run.gitDirty ? "sim" : "não"}.`,
  ];
}

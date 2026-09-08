import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  inspectGit, isSourcePath, MANIFEST_NAME, provenanceLines, requiredSourceFiles,
  resolveProvenance, sha256, verifyPackage,
} from "./provenance";
import { assertUnusedRun, PILOT_IDS, reserveRun, selectEvaluationCases, validateDataset } from "./preflight";
import { buildSourceArchive } from "./source-package";

const temporary: string[] = [];
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "rv-tcc-provenance-"));
  temporary.push(root);
  const files: Record<string, string> = {};
  for (const file of requiredSourceFiles) {
    const contents = `${file}\n`;
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), contents);
    files[file] = sha256(contents);
  }
  const manifest = {
    schemaVersion: 1, packagedFromCommit: "a".repeat(40),
    sourceCommitDate: "2026-09-08T12:00:00+00:00", files,
  };
  await writeFile(path.join(root, MANIFEST_NAME), JSON.stringify(manifest));
  return { root, manifest };
}
function git(root: string, args: string[]) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
async function initializeGit(root: string) {
  git(root, ["init"]);
  git(root, ["add", "."]);
  git(root, ["-c", "user.name=Teste local", "-c", "user.email=teste@example.invalid", "commit", "-m", "fixture"]);
}
afterEach(async () => {
  for (const root of temporary.splice(0)) {
    const resolved = path.resolve(root);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("rv-tcc-provenance-")) {
      throw new Error("Limpeza de teste recusada: diretório fora da área temporária prevista.");
    }
    await rm(resolved, { recursive: true, force: true });
  }
});

describe("proveniência da avaliação", () => {
  it("verifica pacote sem Git sem afirmar commit local ou árvore limpa", async () => {
    const { root } = await fixture();
    expect(await resolveProvenance(root)).toMatchObject({
      gitCommit: null, gitDirty: null,
      provenance: { kind: "verified-package", packagedFromCommit: "a".repeat(40) },
    });
    const text = provenanceLines(await resolveProvenance(root)).join("\n");
    expect(text).toContain("não verificáveis nesta extração");
    expect(text).not.toContain("alterada: não.");
  });
  it("rejeita manifesto ausente", async () => {
    const { root } = await fixture();
    await rm(path.join(root, MANIFEST_NAME));
    await expect(verifyPackage(root)).rejects.toThrow("Sem repositório");
  });
  it("rejeita manifesto inválido ou incompleto", async () => {
    const { root, manifest } = await fixture();
    await writeFile(path.join(root, MANIFEST_NAME), "{malformado");
    await expect(verifyPackage(root)).rejects.toThrow("JSON malformado");
    await writeFile(path.join(root, MANIFEST_NAME), JSON.stringify({ ...manifest, schemaVersion: 9 }));
    await expect(verifyPackage(root)).rejects.toThrow("Manifesto de fonte inválido");
    delete manifest.files["package.json"];
    await writeFile(path.join(root, MANIFEST_NAME), JSON.stringify(manifest));
    await expect(verifyPackage(root)).rejects.toThrow("Manifesto incompleto");
  });
  it("rejeita arquivo alterado", async () => {
    const { root } = await fixture();
    await writeFile(path.join(root, "server/training-prompts.ts"), "alteração");
    await expect(verifyPackage(root)).rejects.toThrow("Integridade divergente");
  });
  it("rejeita arquivo ausente", async () => {
    const { root } = await fixture();
    await rm(path.join(root, "server/training-config.ts"));
    await expect(verifyPackage(root)).rejects.toThrow("ausente ou não permitido");
  });
  it("rejeita caminhos externos e segredos no manifesto", async () => {
    expect(["../fora", "/fora", "C:/fora", "server\\arquivo", ".env", ".git/HEAD", "node_modules/a", "evaluation/results/a"]
      .every((file) => !isSourcePath(file))).toBe(true);
    expect(isSourcePath(".env.example")).toBe(true);
    const { root, manifest } = await fixture();
    manifest.files["../fora"] = "a".repeat(64);
    await writeFile(path.join(root, MANIFEST_NAME), JSON.stringify(manifest));
    await expect(verifyPackage(root)).rejects.toThrow("caminho não permitido");
  });
  it("registra Git limpo e alterado sem ocultar modificações", async () => {
    const { root } = await fixture();
    await initializeGit(root);
    expect(await resolveProvenance(root)).toMatchObject({ gitDirty: false, provenance: { kind: "git" } });
    await writeFile(path.join(root, "package.json"), "alterado");
    expect(await resolveProvenance(root)).toMatchObject({ gitDirty: true, provenance: { kind: "git" } });
  });
  it("não confunde repositório ancestral com o projeto extraído", async () => {
    const { root } = await fixture();
    await initializeGit(root);
    const nested = path.join(root, "extraido");
    await mkdir(nested);
    expect(inspectGit(nested)).toBeNull();
    await expect(resolveProvenance(nested)).rejects.toThrow("Sem repositório");
  });
  it("mantém descrição dos resultados históricos sem novo campo", () => {
    const text = provenanceLines({ gitCommit: "b".repeat(40), gitDirty: false }).join("\n");
    expect(text).toContain("registro histórico de Git (formato anterior)");
    expect(text).toContain("Árvore de trabalho estava alterada: não.");
  });
});

describe("pré-verificação e preservação de rodadas", () => {
  async function datasetFixture() {
    return JSON.parse(await readFile(path.join(import.meta.dirname, "dataset.v1.json"), "utf8"));
  }
  it("aprova a matriz congelada e rejeita IDs duplicados", async () => {
    const raw = await readFile(path.join(import.meta.dirname, "dataset.v1.json"), "utf8");
    expect(validateDataset(raw)).toHaveLength(30);
    const dataset = JSON.parse(raw);
    dataset.cases[1].id = dataset.cases[0].id;
    expect(() => validateDataset(JSON.stringify(dataset))).toThrow("30 combinações únicas");
  });
  it.each(["datasetVersion", "configVersion"])("rejeita metadado %s divergente", async (field) => {
    const dataset = await datasetFixture();
    dataset[field] = "versao-divergente";
    expect(() => validateDataset(JSON.stringify(dataset))).toThrow();
  });
  it("rejeita S31 no lugar de S01, mesmo mantendo trinta IDs únicos", async () => {
    const dataset = await datasetFixture();
    dataset.cases[0].id = "S31";
    expect(() => validateDataset(JSON.stringify(dataset))).toThrow("exatamente os identificadores S01 a S30");
  });
  it.each(["sem-afirmacao", "sem-palavras", "afirmacao-divergente", "palavras-sem-relacao"])
    ("rejeita gabarito de desafio %s", async (change) => {
      const dataset = await datasetFixture();
      const item = dataset.cases.find((entry: { variant: string }) => entry.variant === "challenge");
      if (change === "sem-afirmacao") item.unsupportedClaim = null;
      if (change === "sem-palavras") item.unsupportedClaimKeywords = [];
      if (change === "afirmacao-divergente") item.unsupportedClaim = "Não corresponde à segunda fala.";
      if (change === "palavras-sem-relacao") item.unsupportedClaimKeywords = ["inexistente1", "inexistente2", "inexistente3"];
      expect(() => validateDataset(JSON.stringify(dataset))).toThrow("Gabarito de desafio incompatível");
    });
  it("rejeita afirmação ou palavras-alvo em controle", async () => {
    const dataset = await datasetFixture();
    dataset.cases[0].unsupportedClaimKeywords = ["palavra"];
    expect(() => validateDataset(JSON.stringify(dataset))).toThrow("Gabarito de controle incompatível");
    dataset.cases[0].unsupportedClaimKeywords = [];
    dataset.cases[0].unsupportedClaim = "Afirmação não permitida em controle.";
    expect(() => validateDataset(JSON.stringify(dataset))).toThrow("Gabarito de controle incompatível");
  });
  it("seleciona exatamente seis IDs piloto e trinta IDs principais", async () => {
    const cases = validateDataset(JSON.stringify(await datasetFixture()));
    expect(selectEvaluationCases(cases, "pilot").map((item) => item.id)).toEqual(PILOT_IDS);
    expect(selectEvaluationCases(cases, "primary")).toHaveLength(30);
    expect(() => selectEvaluationCases(cases.filter((item) => item.id !== "S01"), "pilot"))
      .toThrow("esperados 6 identificadores fixos");
    expect(() => selectEvaluationCases(cases.slice(1), "primary"))
      .toThrow("esperados 30 identificadores fixos");
  });
  it("recusa sobrescrever rodada e preserva o arquivo existente", async () => {
    const { root } = await fixture();
    const output = path.join(root, "results", "uma-rodada");
    await assertUnusedRun(output);
    await reserveRun(output);
    await writeFile(path.join(output, "results.json"), "resultado preservado");
    await expect(assertUnusedRun(output)).rejects.toThrow("já utilizado");
    await expect(reserveRun(output)).rejects.toThrow("já utilizado");
    expect(await readFile(path.join(output, "results.json"), "utf8")).toBe("resultado preservado");
  });
});

describe("pacote de fonte determinístico", () => {
  it("gera bytes idênticos do mesmo commit e exclui arquivo local não versionado", async () => {
    const { root } = await fixture();
    await rm(path.join(root, MANIFEST_NAME));
    await writeFile(path.join(root, ".gitignore"), ".env\n");
    await initializeGit(root);
    await writeFile(path.join(root, ".env"), "DADO_DE_TESTE_NAO_DISTRIBUIR=true\n");
    const first = buildSourceArchive(root);
    const second = buildSourceArchive(root);
    expect(first.archive.equals(second.archive)).toBe(true);
    expect(first.manifest.files).not.toHaveProperty(".env");
    expect(first.archive.includes(Buffer.from("DADO_DE_TESTE_NAO_DISTRIBUIR"))).toBe(false);
    expect(first.manifest.packagedFromCommit).toBe(git(root, ["rev-parse", "HEAD"]));
    expect(first.archive.readUInt32LE(0)).toBe(0x04034b50);
    expect(first.archive.readUInt32LE(first.archive.length - 22)).toBe(0x06054b50);
  }, 30000);
  it("recusa empacotar árvore alterada", async () => {
    const { root } = await fixture();
    await rm(path.join(root, MANIFEST_NAME));
    await initializeGit(root);
    await writeFile(path.join(root, "package.json"), "alterado");
    expect(() => buildSourceArchive(root)).toThrow("árvore deve estar limpa");
  });
});

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSourceArchive } from "./source-package";

const root = path.resolve(import.meta.dirname, "..");
const outArg = process.argv.find((arg) => arg.startsWith("--out="))?.slice("--out=".length);
if (!outArg) throw new Error("Use --out=caminho-absoluto/arquivo.zip; não serão sobrescritos pacotes existentes.");
if (!path.isAbsolute(outArg) || path.extname(outArg).toLowerCase() !== ".zip") {
  throw new Error("Informe um caminho absoluto de arquivo .zip.");
}
const outputPath = path.resolve(outArg);
const relative = path.relative(root, outputPath);
if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
  throw new Error("Salve o pacote fora do repositório de origem.");
}
const result = buildSourceArchive(root);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, result.archive, { flag: "wx" });
console.log(`Pacote: ${outputPath}`);
console.log(`Commit de origem: ${result.manifest.packagedFromCommit}`);
console.log(`Arquivos: ${result.fileCount}; SHA-256: ${result.sha256}`);

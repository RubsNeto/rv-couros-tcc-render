import { execFileSync } from "node:child_process";
import { inspectGit, isSourcePath, MANIFEST_NAME, requiredSourceFiles, sha256 } from "./provenance";
import type { SourceManifest } from "./provenance";

type ArchiveEntry = { name: string; contents: Buffer };

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ZIP sem compressão, nomes UTF-8, ordem lexical e data fixa 1980-01-01.
export function deterministicZip(entries: ArchiveEntry[]): Buffer {
  if (entries.length > 65535) throw new Error("Pacote excede o limite ZIP clássico.");
  const parts: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const entry of [...entries].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const name = Buffer.from(entry.name, "utf8");
    const size = entry.contents.length;
    if (name.length > 65535 || size > 0xffffffff || offset > 0xffffffff) {
      throw new Error("Pacote excede o limite ZIP clássico.");
    }
    const checksum = crc32(entry.contents);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, entry.contents);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);
    offset += local.length + name.length + size;
  }
  const centralSize = directory.reduce((sum, item) => sum + item.length, 0);
  if (offset + centralSize > 0xffffffff) throw new Error("Pacote excede o limite ZIP clássico.");
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...directory, end]);
}

export function buildSourceArchive(root: string) {
  const git = inspectGit(root);
  if (!git) throw new Error("O empacotamento exige o repositório Git próprio do projeto.");
  if (git.dirty) throw new Error("Faça um commit de todas as alterações antes de empacotar; a árvore deve estar limpa.");
  const command = (args: string[]) => execFileSync("git", args, {
    cwd: root, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024,
  });
  const tree = command(["ls-tree", "-r", "-z", "--full-tree", git.commit])
    .toString("utf8").split("\0").filter(Boolean);
  const entries: ArchiveEntry[] = tree.map((record) => {
    const tab = record.indexOf("\t");
    const [mode, type, objectId] = record.slice(0, tab).split(" ");
    const name = record.slice(tab + 1);
    if (!isSourcePath(name) || /\.(pem|key|p12|pfx)$/i.test(name) || type !== "blob" || mode === "120000") {
      throw new Error(`Arquivo versionado não permitido no pacote de fonte: ${name}.`);
    }
    return { name, contents: command(["cat-file", "blob", objectId]) };
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  if (requiredSourceFiles.some((file) => !entries.some((entry) => entry.name === file))) {
    throw new Error("Repositório incompleto para empacotamento.");
  }
  const manifest: SourceManifest = {
    schemaVersion: 1,
    packagedFromCommit: git.commit,
    sourceCommitDate: command(["show", "-s", "--format=%cI", git.commit]).toString("utf8").trim(),
    files: Object.fromEntries(entries.map((entry) => [entry.name, sha256(entry.contents)])),
  };
  const manifestRaw = Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8");
  const archive = deterministicZip([...entries, { name: MANIFEST_NAME, contents: manifestRaw }]);
  return { archive, manifest, manifestRaw, sha256: sha256(archive), fileCount: entries.length + 1 };
}

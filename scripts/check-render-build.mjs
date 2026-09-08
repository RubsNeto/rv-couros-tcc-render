// Production-entry smoke test. Uses a fake key and never invokes the AI provider.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import net from "node:net";
import assert from "node:assert/strict";

const probe = net.createServer();
await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const password = randomBytes(24).toString("base64url");
const child = spawn(process.execPath, ["dist/render.js"], {
  env: { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port),
    OPENAI_API_KEY: "test-only-not-an-api-key", DEMO_USER: "orientador", DEMO_PASSWORD: password },
  stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
});
let logs = "";
child.stdout.on("data", data => { logs += data.toString(); });
child.stderr.on("data", data => { logs += data.toString(); });
const base = `http://127.0.0.1:${port}`;
const auth = { Authorization: `Basic ${Buffer.from(`orientador:${password}`).toString("base64")}` };
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    if (child.exitCode !== null) throw new Error("O processo encerrou antes de iniciar.");
    try { if ((await fetch(`${base}/api/health`)).status === 200) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, "O servidor deve iniciar");
  assert.equal((await fetch(base)).status, 401);
  assert.equal((await fetch(`${base}/api/training/config`)).status, 401);
  const page = await fetch(base, { headers: auth });
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy"), /default-src 'self'/);
  assert.match(page.headers.get("cache-control"), /no-store/);
  const html = await page.text();
  const asset = /src="(\/assets\/[^\"]+\.js)"/.exec(html)?.[1];
  assert.ok(asset, "HTML deve apontar para o arquivo compilado");
  assert.equal((await fetch(`${base}${asset}`)).status, 401);
  const bundle = await fetch(`${base}${asset}`, { headers: auth });
  assert.equal(bundle.status, 200);
  const bundleText = await bundle.text();
  assert.ok(!bundleText.includes(password) && !bundleText.includes("test-only-not-an-api-key"));
  const config = await fetch(`${base}/api/training/config`, { headers: auth });
  assert.equal(config.status, 200);
  assert.equal((await config.json()).products.length, 5);
  const start = await fetch(`${base}/api/training/start`, { method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ productId: "vonixx-vfloc-500ml", objectionId: "price", difficulty: "medium" }) });
  assert.equal(start.status, 201);
  const { sessionId } = await start.json();
  const cancel = await fetch(`${base}/api/training/cancel`, { method: "POST",
    headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) });
  assert.equal(cancel.status, 204);
  assert.ok(!logs.includes("EADDRINUSE"), "Somente o servidor protegido pode escutar a porta");
  console.log("PASS: entrada compilada, autenticação, cabeçalhos, arquivos estáticos, configuração e sessão. Zero chamadas à IA.");
} finally {
  child.kill();
  await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once("exit", resolve); });
}

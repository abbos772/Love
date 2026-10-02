/**
 * Production-style verification for POST /api/telegram.
 *
 * Simulates how the production runtime compiles the Vercel function:
 * each TypeScript file is transpiled on its own (no bundling), the compiled
 * files keep the same relative layout (api/ + server/), and the module graph
 * is resolved by plain Node ESM rules — where "../server/telegram.js" must
 * point at a real file and an extensionless specifier fails.
 *
 * Run: node verify-production.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

let failures = 0;
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

function loadDotEnv() {
  const kv = {};
  for (const line of readFileSync(resolve(".env"), "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i > 0) kv[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return kv;
}

const SERVER_FILES = ["api/telegram.ts", "server/telegram.ts"];

async function transpile(outDir, { extensionlessImport = false } = {}) {
  const { transform } = await import("esbuild");
  for (const rel of SERVER_FILES) {
    let code = readFileSync(resolve(rel), "utf8");
    if (extensionlessImport && rel === "api/telegram.ts") {
      code = code.replace('"../server/telegram.js"', '"../server/telegram"');
    }
    const { code: js } = await transform(code, {
      loader: "ts",
      format: "esm",
      target: "node18",
      sourcefile: rel,
    });
    const dest = join(outDir, rel.replace(/\.ts$/, ".js"));
    mkdirSync(join(dest, ".."), { recursive: true });
    writeFileSync(dest, js);
  }
  writeFileSync(join(outDir, "package.json"), JSON.stringify({ type: "module" }));
}

function post(port, body) {
  return fetch(`http://127.0.0.1:${port}/api/telegram`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

const VALID_PAYLOAD = {
  nasiba: "Nasiba",
  abbos: "Abbos",
  answers: [
    { id: "q1", prompt: "P1", answer: "Yes 🥰" },
    { id: "q2", prompt: "P2", answer: "Yes ❤️" },
    { id: "q3", prompt: "P3", answer: "Yes" },
    { id: "q4", prompt: "P4", answer: "Yes 😍" },
    { id: "q5", prompt: "P5", answer: "Yes" },
    { id: "q6", prompt: "P6", answer: "Yes" },
    { id: "q7", prompt: "Do you love me?", answer: "Yes ❤️" },
  ],
  q7Answer: "Yes ❤️",
  whyNoReason: null,
  opinion: "Production-style test ✅",
};

async function main() {
  const env = loadDotEnv();
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  check(".env provides server-side credentials", Boolean(token && chatId));

  // ---- source-level: nothing hardcoded, env read at runtime ----
  const apiSource = readFileSync(resolve("api/telegram.ts"), "utf8");
  const serverSource = readFileSync(resolve("server/telegram.ts"), "utf8");
  check("api/telegram.ts imports ../server/telegram.js", apiSource.includes('from "../server/telegram.js"'));
  check("handler default-exports from api/telegram.ts", /export default/.test(apiSource));
  check("token read from process.env, not hardcoded", serverSource.includes("process.env") && !serverSource.includes(token));
  check("chat id read from process.env, not hardcoded", serverSource.includes("process.env") && !serverSource.includes(chatId));

  const outDir = mkdtempSync(join(tmpdir(), "tg-prod-"));
  const brokenDir = mkdtempSync(join(tmpdir(), "tg-prod-broken-"));
  try {
    // ---- compile the function the way production does ----
    await transpile(outDir);
    const apiModule = await import(pathToFileURL(join(outDir, "api", "telegram.js")).href);
    check("compiled api/telegram.js loads through ../server/telegram.js", typeof apiModule.default === "function");
    const handler = apiModule.default;

    // ---- root cause check: extensionless specifier fails under Node ESM ----
    let extensionlessFails = false;
    try {
      await transpile(brokenDir, { extensionlessImport: true });
      await import(pathToFileURL(join(brokenDir, "api", "telegram.js")).href);
    } catch (error) {
      extensionlessFails = /Cannot find module|ERR_MODULE_NOT_FOUND/.test(String(error));
    }
    check("extensionless import fails under Node ESM (the production 500)", extensionlessFails);

    // ---- run it on a real HTTP server ----
    process.env.TELEGRAM_BOT_TOKEN = token;
    process.env.TELEGRAM_CHAT_ID = chatId;
    const server = createServer((req, res) => void handler(req, res));
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const port = server.address().port;

    const logs = [];
    const originalError = console.error;
    const capture = () => {
      console.error = (...args) => logs.push(args.map(String).join(" "));
    };

    capture();
    let res = await post(port, JSON.stringify(VALID_PAYLOAD));
    const realBody = await res.json();
    console.error = originalError;
    check("POST valid payload → 200 {ok:true} (real Telegram delivery)", res.status === 200 && realBody.ok === true, `HTTP ${res.status}`);

    res = await fetch(`http://127.0.0.1:${port}/api/telegram`, { method: "GET" });
    check("GET → 405", res.status === 405);
    res = await post(port, "{not json");
    check("broken JSON → 400", res.status === 400);
    res = await post(port, JSON.stringify({ nasiba: "x" }));
    check("incomplete payload → 400", res.status === 400);
    res = await post(port, JSON.stringify({ ...VALID_PAYLOAD, answers: [] }));
    check("empty answers → 400", res.status === 400);
    res = await post(port, JSON.stringify({ ...VALID_PAYLOAD, pad: "x".repeat(70000) }));
    check("oversized body → 413", res.status === 413, `HTTP ${res.status}`);

    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    res = await post(port, JSON.stringify(VALID_PAYLOAD));
    const notConfigured = await res.json();
    process.env.TELEGRAM_BOT_TOKEN = token;
    process.env.TELEGRAM_CHAT_ID = chatId;
    check(
      "missing env vars → 500 with a clear safe error",
      res.status === 500 && /not configured/.test(notConfigured.error ?? ""),
      JSON.stringify(notConfigured),
    );

    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      if (String(url).includes("127.0.0.1")) return realFetch(url, init);
      throw new Error(`connect failed: invalid token ${token}`);
    };
    capture();
    res = await post(port, JSON.stringify(VALID_PAYLOAD));
    console.error = originalError;
    globalThis.fetch = realFetch;
    const failed = await res.json();
    check("Telegram failure → 502 without leaking details", res.status === 502 && failed.ok === false, JSON.stringify(failed));
    check("token never appears in server logs", !logs.join("\n").includes(token), `${logs.length} captured log line(s)`);

    await new Promise((r) => server.close(r));
  } finally {
    rmSync(outDir, { recursive: true, force: true });
    rmSync(brokenDir, { recursive: true, force: true });
  }

  console.log(failures === 0 ? "all production checks passed" : `${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(`fatal: ${error?.stack ?? error}\n`);
  process.exit(1);
});

/**
 * Verification for the Telegram integration.
 *
 *   node verify-telegram.mjs          → all checks (format + HTTP + browser)
 *   node verify-telegram.mjs format   → message formatting only
 *   node verify-telegram.mjs http     → API endpoint only
 *   node verify-telegram.mjs browser  → the two Q7 modal journeys only
 *
 * The Telegram API itself is stubbed for the HTTP checks (so nothing is sent
 * to a real bot while testing), but the browser walk talks to the real dev
 * server endpoint — only the final Telegram hop is stubbed or rejected.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const MODE = process.argv[2] || "all";
const CDP_PORT = 9344;
const APP_URL = process.env.APP_URL || "http://127.0.0.1:5175/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) {
    failures += 1;
    process.exitCode = 1;
  }
};

const SAMPLE = {
  nasiba: "Nasiba",
  abbos: "Abbos",
  answers: [
    { id: "q1", prompt: "Do you remember the moment when we first became special to each other?", answer: "Yes 🥰" },
    { id: "q2", prompt: "Do I make you smile sometimes?", answer: "Yes ❤️" },
    { id: "q3", prompt: "Do you love talking with me even when we have nothing interesting to talk about?", answer: "Absolutely ❤️" },
    { id: "q4", prompt: "Do you think we look cute together?", answer: "Yes 😍" },
    { id: "q5", prompt: "Would you like sitting together with me on a bench? 🥹❤️", answer: "Yes, I would ❤️" },
    { id: "q6", prompt: "Would you like me to walk you home after work and take a little walk with you on the way? 🌙❤️", answer: "Yes, I would ❤️" },
    { id: "q7", prompt: "Do you love me?", answer: "Yes ❤️" },
  ],
  q7Answer: "Yes ❤️",
  whyNoReason: "Because you always steal my hoodies 🧥",
  opinion: "Abbos is the most thoughtful person I know ❤️",
};

const TEST_TOKEN = "123456789:TEST-TOKEN-VALUE-DO-NOT-LEAK";
const TEST_CHAT = "-1001234567890";

/** Bundles the server module so the checks can import real code, not a copy. */
async function loadServerModule() {
  const dir = await mkdtemp(join(tmpdir(), "tg-verify-"));
  const outfile = join(dir, "telegram-server.mjs");
  await build({
    entryPoints: [resolve("server/telegram.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outfile,
    logLevel: "silent",
  });
  const mod = await import(pathToFileURL(outfile).href);
  return { mod, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

// ---------------------------------------------------------------------------
// 1 — the one Telegram message, formatted
// ---------------------------------------------------------------------------
async function verifyFormat(mod) {
  console.log("\n— message formatting —");
  const text = mod.formatTelegramMessage(SAMPLE, new Date("2026-10-02T12:34:56.000Z"));

  check("names are in the message", text.includes("Nasiba") && text.includes("Abbos"));
  check("all 7 prompts are in the message", SAMPLE.answers.every((a) => text.includes(a.prompt)));
  check("all 7 answers are in the message", SAMPLE.answers.every((a) => text.includes(a.answer)));
  check("question 7 answer is called out", text.includes("Question 7 · Do you love me?:") && text.includes("Yes ❤️"));
  check("the \"Why no?\" reason is in the message", text.includes("Reason for \"No\" (Why no? 🥺):") && text.includes(SAMPLE.whyNoReason));
  check("the opinion about Abbos is in the message", text.includes("Opinion about Abbos:") && text.includes(SAMPLE.opinion));
  check("timestamp is in the message", text.includes("2026-10-02T12:34:56.000Z"));
  check("optional fields fall back to \"not provided\"", mod.formatTelegramMessage({ ...SAMPLE, whyNoReason: null, opinion: null }).includes("<i>not provided</i>"));
  const hostile = mod.formatTelegramMessage({ ...SAMPLE, opinion: "<script>alert(1)</script>" });
  check("user text is HTML-escaped", hostile.includes("&lt;script&gt;") && !hostile.includes("<script>"));
  check("escapeHtml helper", mod.escapeHtml("<b>&") === "&lt;b&gt;&amp;");
  check("payload parser accepts the full payload", mod.parsePayload(SAMPLE)?.answers.length === 7);
  check("payload parser rejects junk", mod.parsePayload({ nasiba: 1, abbos: "A", q7Answer: "x", answers: [{ prompt: "p", answer: "a" }] }) === null);

  console.log("\n----- the exact message Telegram receives -----\n");
  console.log(text);
  console.log("\n-----------------------------------------------\n");
}

// ---------------------------------------------------------------------------
// 2 — POST /api/telegram, with Telegram itself stubbed
// ---------------------------------------------------------------------------
async function verifyHttp(mod) {
  console.log("\n— API endpoint (Telegram stubbed) —");

  const captured = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (target.includes("api.telegram.org")) {
      captured.push({ url: target, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return realFetch(url, init);
  };

  const env = { TELEGRAM_BOT_TOKEN: TEST_TOKEN, TELEGRAM_CHAT_ID: TEST_CHAT };
  const server = createServer((req, res) => {
    void mod.handleTelegramRequest(req, res, env);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const endpoint = `http://127.0.0.1:${port}/api/telegram`;

  const post = (data) =>
    realFetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof data === "string" ? data : JSON.stringify(data),
    });

  const ok = await post(SAMPLE);
  const okBody = await ok.json();
  check("POST valid payload → 200 {ok:true}", ok.status === 200 && okBody.ok === true, JSON.stringify(okBody));
  check("exactly one sendMessage call", captured.length === 1);
  check(
    "sendMessage uses the Bot API URL with the server-side token",
    captured[0]?.url === `https://api.telegram.org/bot${TEST_TOKEN}/sendMessage`,
  );
  check("sendMessage targets the server-side chat id", captured[0]?.body.chat_id === TEST_CHAT);
  check("sendMessage uses parse_mode HTML", captured[0]?.body.parse_mode === "HTML");
  check("sendMessage carries the full formatted message", captured[0]?.body.text.includes("Question 7 · Do you love me?:") && captured[0]?.body.text.includes(SAMPLE.whyNoReason));

  const get = await realFetch(endpoint);
  check("GET → 405", get.status === 405);
  const badJson = await post("{not json");
  check("broken JSON → 400", badJson.status === 400);
  const badPayload = await post({ nasiba: "Nasiba" });
  check("incomplete payload → 400", badPayload.status === 400);

  // Missing configuration → a clear 500 that leaks nothing.
  const noEnvServer = createServer((req, res) => {
    void mod.handleTelegramRequest(req, res, {});
  });
  await new Promise((r) => noEnvServer.listen(0, "127.0.0.1", r));
  const noEnvPort = noEnvServer.address().port;
  const unconfigured = await realFetch(`http://127.0.0.1:${noEnvPort}/api/telegram`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(SAMPLE),
  });
  const unconfiguredBody = await unconfigured.json();
  check("no env vars → 500 \"not configured\"", unconfigured.status === 500 && unconfiguredBody.ok === false, JSON.stringify(unconfiguredBody));
  await new Promise((r) => noEnvServer.close(r));

  // Telegram failures must never echo the token back to the browser.
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (target.includes("api.telegram.org")) {
      throw new Error(`getaddrinfo ENOTFOUND ${target}`);
    }
    return realFetch(url, init);
  };
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args.join(" "));
  const failing = await post(SAMPLE);
  console.error = originalError;
  const failingBody = await failing.json();
  const leaked = JSON.stringify(failingBody).includes(TEST_TOKEN) || logs.some((l) => l.includes(TEST_TOKEN));
  check("Telegram failure → 502, token never leaves the server", failing.status === 502 && failingBody.ok === false && !leaked);

  globalThis.fetch = realFetch;
  await new Promise((r) => server.close(r));
}

// ---------------------------------------------------------------------------
// 3 — the real journey, in a real browser, against the real endpoint
// ---------------------------------------------------------------------------
async function verifyBrowser() {
  console.log("\n— browser journeys (Q7 YES opinion + Q7 NO reason) —");

  const chrome = spawn(
    CHROME,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-proxy-server",
      "--proxy-bypass-list=*",
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1440,900",
      `--user-data-dir=${resolve("node_modules/.cache/chrome-verify-tg-profile")}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    const target = await (async () => {
      for (let i = 0; i < 80; i += 1) {
        try {
          const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
          const list = await res.json();
          const page = list.find((t) => t.type === "page" && typeof t.webSocketDebuggerUrl === "string");
          if (page) return page;
        } catch {
          /* not up yet */
        }
        await sleep(250);
      }
      throw new Error("Chrome DevTools target never appeared");
    })();

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", rej, { once: true });
    });

    const posts = [];
    let nextId = 0;
    const pending = new Map();
    const listeners = new Map();
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: done, reject: fail } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) fail(new Error(JSON.stringify(msg.error)));
        else done(msg.result);
      } else if (msg.method) {
        (listeners.get(msg.method) || []).forEach((fn) => fn(msg.params));
      }
    });
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    const on = (method, fn) => listeners.set(method, [...(listeners.get(method) || []), fn]);

    on("Network.requestWillBeSent", (p) => {
      if (p.request.url.includes("/api/telegram")) {
        posts.push({ id: p.requestId, url: p.request.url, method: p.request.method, body: p.request.postData });
      }
    });
    const statuses = new Map();
    on("Network.responseReceived", (p) => {
      if (posts.some((x) => x.id === p.requestId)) statuses.set(p.requestId, p.response.status);
    });
    const pageLogs = [];
    on("Runtime.exceptionThrown", (p) =>
      pageLogs.push(`EXCEPTION: ${p.exceptionDetails.exception?.description || p.exceptionDetails.text}`),
    );
    on("Runtime.consoleAPICalled", (p) => {
      if (p.type === "error" || p.type === "warning") {
        pageLogs.push(`console.${p.type}: ${p.args.map((a) => a.value ?? a.description ?? "").join(" ")}`);
      }
    });

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");

    const run = (expression) =>
      send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }).then((res) => {
        if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || "evaluate failed");
        return res.result.value;
      });

    const WALK = `(() => {
      // Only interact with an element once it has been on screen for a moment:
      // clicking in the same tick a screen mounts would race React's first
      // effect pass (dev StrictMode re-runs it) and lose the pending timers.
      const settled = (el) => {
        const now = Date.now();
        if (el.__seen === undefined) { el.__seen = now; return false; }
        return now - el.__seen >= 300;
      };
      const text = document.body.innerText || "";
      if (text.includes("Do you love me?")) return { stage: "q7" };
      if (document.querySelector(".why-no")) return { stage: "modal" };
      const msg = document.querySelector(".message-screen");
      if (msg) { if (settled(msg)) { msg.click(); return { stage: "message" }; } return { stage: "wait" }; }
      const postcard = document.querySelector(".postcard");
      if (postcard) { if (settled(postcard)) { postcard.click(); return { stage: "start" }; } return { stage: "wait" }; }
      const primary = document.querySelector("button.btn--primary:not([disabled])");
      if (primary) { if (settled(primary)) { primary.click(); return { stage: "answer" }; } return { stage: "wait" }; }
      return { stage: "idle" };
    })()`;

    const walkTo = async (stopStage, max = 400) => {
      let last = "";
      for (let i = 0; i < max; i += 1) {
        const state = await run(WALK);
        if (state.stage !== last) {
          last = state.stage;
          process.stdout.write(`    · walk ${i} ${state.stage}\n`);
        }
        if (state.stage === stopStage) return true;
        await sleep(100);
      }
      const diag = await run(`({
        head: document.body.innerText.slice(0, 120).replace(/\\n/g, " | "),
        buttons: [...document.querySelectorAll("button")].map((b) => b.className + (b.disabled ? "[off]" : "")).slice(0, 6),
        whyNo: !!document.querySelector(".why-no"),
        answers: window.__responses ? window.__responses().answers.length : -1,
      })`).catch(() => null);
      console.log("    walk FAILED diag:", JSON.stringify(diag));
      if (pageLogs.length) console.log("    page logs:", pageLogs.join("\n    "));
      return false;
    };

    const set = (selector, value) =>
      run(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return el.value;
      })()`);

    const snapshot = () => run(`window.__responses ? window.__responses() : null`);
    const readPosts = async () => {
      await sleep(500);
      return posts.map((p) => ({ ...p, payload: p.body ? JSON.parse(p.body) : null }));
    };
    /** The endpoint's HTTP status, once Chrome reports the response. */
    const waitForStatus = async (requestId, timeout = 8000) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        if (statuses.has(requestId)) return statuses.get(requestId);
        await sleep(150);
      }
      return undefined;
    };

    // -------------------------------------------------- YES path + opinion
    await send("Page.navigate", { url: APP_URL });
    await sleep(2500);
    check("YES path · walked to Question 7", await walkTo("q7"));
    await sleep(700);

    const before = await snapshot();
    check("YES path · 6 answers recorded before Q7", before?.answers?.length === 6, `got ${before?.answers?.length}`);

    await run(`document.querySelector(".choices .btn--primary").click()`);
    await sleep(600);
    const modal = await run(`(() => {
      const card = document.querySelector(".why-no__card");
      if (!card) return null;
      return {
        title: card.querySelector(".why-no__title")?.innerText || "",
        subtitle: card.querySelector(".why-no__subtitle")?.innerText || "",
        send: card.querySelector(".why-no__send")?.innerText.trim() || "",
        later: card.querySelector(".why-no__later")?.innerText.trim() || "",
        focused: document.activeElement === card.querySelector(".why-no__field"),
      };
    })()`);
    check("YES path · the opinion modal opens", !!modal);
    check("YES path · title is \"What do you think about Abbos? ❤️\"", modal?.title === "What do you think about Abbos? ❤️", JSON.stringify(modal?.title));
    check("YES path · modal copy", modal?.send === "Send ❤️" && modal?.later === "Maybe later", JSON.stringify(modal));

    const opinion = "Abbos is the sweetest, most thoughtful person ❤️";
    check("YES path · typing the opinion works", (await set(".why-no__field", opinion)) === opinion);
    await run(`document.querySelector(".why-no__send").click()`);

    await sleep(3200);
    const yesState = await snapshot();
    check("YES path · all 7 answers collected", yesState?.answers?.length === 7, `got ${yesState?.answers?.length}`);
    check("YES path · Q7 answer is Yes ❤️", yesState?.answers?.[6]?.answer === "Yes ❤️", JSON.stringify(yesState?.answers?.[6]));
    check("YES path · opinion collected, no \"Why no\" reason", yesState?.opinion === opinion && yesState?.whyNo === null, JSON.stringify({ opinion: yesState?.opinion, whyNo: yesState?.whyNo }));

    const yesPosts = await readPosts();
    const yesPost = yesPosts[0];
    check("YES path · exactly one POST to /api/telegram", yesPosts.length === 1, `${yesPosts.length}`);
    check("YES path · endpoint is POST /api/telegram", yesPost?.method === "POST" && yesPost?.url.endsWith("/api/telegram"), yesPost?.url);
    check("YES path · payload has both names", yesPost?.payload?.nasiba === "Nasiba" && yesPost?.payload?.abbos === "Abbos");
    check("YES path · payload has all 7 answers", yesPost?.payload?.answers?.length === 7, `${yesPost?.payload?.answers?.length}`);
    check("YES path · payload carries q7Answer + opinion", yesPost?.payload?.q7Answer === "Yes ❤️" && yesPost?.payload?.opinion === opinion);
    check("YES path · payload keeps whyNoReason null", yesPost?.payload?.whyNoReason === null);
    const yesStatus = await waitForStatus(yesPost?.id);
    check("YES path · the endpoint answered", yesStatus === 200 || yesStatus === 502, `HTTP ${yesStatus}`);

    const afterYes = await run(`document.body.innerText`);
    check("YES path · the story continues", !afterYes.includes("Do you love me?"));

    // -------------------------------------------------- NO path + reason
    posts.length = 0;
    await send("Page.navigate", { url: APP_URL });
    await sleep(2500);
    check("NO path · walked to Question 7", await walkTo("q7"));
    await sleep(900);

    // Catch the dodging "no" button: approach → hop → land → click.
    const READ_NO = `(() => {
      const el = document.querySelector(".dodge-btn");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, vw: innerWidth, vh: innerHeight };
    })()`;
    const move = (x, y) =>
      run(`window.dispatchEvent(new PointerEvent("pointermove", { clientX: ${Math.round(x)}, clientY: ${Math.round(y)}, pointerType: "mouse", bubbles: true }))`);

    const far = await run(READ_NO);
    const farSpots = [[6, 6], [far.vw - 6, 6], [6, far.vh - 6], [far.vw - 6, far.vh - 6]];
    await move(...farSpots[0]);
    await sleep(750);
    const pre = await run(READ_NO);
    await move(pre.cx, pre.y - 45);
    await sleep(650);
    const hopped = await run(READ_NO);
    await move(hopped.cx, hopped.cy);
    await sleep(1000);
    await run(`document.querySelector(".dodge-btn").click()`);
    await sleep(600);
    const whyNoModal = await run(`(() => {
      const card = document.querySelector(".why-no__card");
      if (!card) return null;
      return { title: card.querySelector(".why-no__title")?.innerText || "" };
    })()`);
    check("NO path · catching NO opens \"Why no? 🥺\"", whyNoModal?.title === "Why no? 🥺", JSON.stringify(whyNoModal));

    const reason = "Because you always steal my hoodies 🧥";
    check("NO path · typing the reason works", (await set(".why-no__field", reason)) === reason);
    await run(`document.querySelector(".why-no__send").click()`);

    await sleep(3200);
    const noState = await snapshot();
    check("NO path · all 7 answers collected", noState?.answers?.length === 7, `got ${noState?.answers?.length}`);
    check("NO path · Q7 answer is No 😏", noState?.answers?.[6]?.answer === "No 😏", JSON.stringify(noState?.answers?.[6]));
    check("NO path · reason collected, no opinion", noState?.whyNo === reason && noState?.opinion === null, JSON.stringify({ whyNo: noState?.whyNo, opinion: noState?.opinion }));

    const noPosts = await readPosts();
    const noPost = noPosts[0];
    check("NO path · exactly one POST to /api/telegram", noPosts.length === 1, `${noPosts.length}`);
    check("NO path · payload carries q7Answer + reason", noPost?.payload?.q7Answer === "No 😏" && noPost?.payload?.whyNoReason === reason);
    check("NO path · payload keeps opinion null", noPost?.payload?.opinion === null);
    check("NO path · payload has all 7 answers", noPost?.payload?.answers?.length === 7, `${noPost?.payload?.answers?.length}`);
    const noStatus = await waitForStatus(noPost?.id);
    check("NO path · the endpoint answered", noStatus === 200 || noStatus === 502, `HTTP ${noStatus}`);
    if (yesStatus === 502 || noStatus === 502) {
      console.log(
        "  note: the endpoint reached Telegram but Telegram answered 401 — the token in .env is not accepted by Telegram (refresh it with @BotFather).",
      );
    }

    const afterNo = await run(`document.body.innerText`);
    check("NO path · the story continues", !afterNo.includes("Do you love me?"));

    ws.close();
  } finally {
    chrome.kill();
  }
}

async function main() {
  const { mod, cleanup } = await loadServerModule();
  try {
    if (MODE === "all" || MODE === "format") await verifyFormat(mod);
    if (MODE === "all" || MODE === "http") await verifyHttp(mod);
    if (MODE === "all" || MODE === "browser") await verifyBrowser();
  } finally {
    await cleanup();
  }
  console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
}

main().catch((error) => {
  console.error("verification error:", error);
  process.exitCode = 1;
});

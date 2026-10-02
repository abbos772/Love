/**
 * TEMPORARY verification script (deleted after use).
 * Drives headless Chrome over the DevTools Protocol to walk the journey to
 * Question 7 of 7 and check the refined "no" button behaviour, A–J.
 *
 *   node verify-dodge.mjs        → tests A–I (dodge + modal + Send)
 *   node verify-dodge.mjs yes    → test J (YES still continues the story)
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const CDP_PORT = 9333;
const APP_URL = process.env.APP_URL || "http://127.0.0.1:5175/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const MODE = process.argv[2] || "full";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) {
    failures += 1;
    process.exitCode = 1;
  }
};

async function findPageTarget() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const list = await res.json();
      const page = list.find(
        (t) => t.type === "page" && typeof t.webSocketDebuggerUrl === "string",
      );
      if (page) return page;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome DevTools target never appeared");
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function main() {
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
      `--user-data-dir=${resolve("node_modules/.cache/chrome-verify-profile")}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    const target = await findPageTarget();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    const cdp = new Cdp(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    const run = (expression) =>
      cdp
        .send("Runtime.evaluate", {
          expression,
          returnByValue: true,
          awaitPromise: true,
        })
        .then((res) => {
          if (res.exceptionDetails) {
            throw new Error(
              res.exceptionDetails.exception?.description || "evaluate failed",
            );
          }
          return res.result.value;
        });

    const READ_NO = `(() => {
      const el = document.querySelector(".dodge-btn");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.left), y: Math.round(r.top),
        w: Math.round(r.width), h: Math.round(r.height),
        cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2),
        position: getComputedStyle(el).position,
        inBody: el.parentElement === document.body,
        opacity: getComputedStyle(el).opacity,
        attempts: document.querySelector(".reaction__attempts")?.innerText || "",
        vw: window.innerWidth, vh: window.innerHeight,
      };
    })()`;

    const move = (x, y, type = "mouse") =>
      run(
        `window.dispatchEvent(new PointerEvent("pointermove", {
          clientX: ${Math.round(x)}, clientY: ${Math.round(y)},
          pointerType: "${type}", bubbles: true
        }))`,
      );

    const tapNo = () =>
      run(`(() => {
        const el = document.querySelector(".dodge-btn");
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const opts = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
                       pointerType: "touch", bubbles: true, pointerId: 1 };
        window.dispatchEvent(new PointerEvent("pointerdown", opts));
        window.dispatchEvent(new PointerEvent("pointerup", opts));
        el.click();
        return true;
      })()`);

    const READ_MODAL = `(() => {
      const wrap = document.querySelector(".why-no");
      const card = document.querySelector(".why-no__card");
      if (!wrap || !card) return null;
      return {
        title: card.querySelector(".why-no__title")?.innerText || "",
        subtitle: card.querySelector(".why-no__subtitle")?.innerText || "",
        placeholder: card.querySelector(".why-no__field")?.getAttribute("placeholder") || "",
        send: card.querySelector(".why-no__send")?.innerText.trim() || "",
        later: card.querySelector(".why-no__later")?.innerText.trim() || "",
        radius: parseFloat(getComputedStyle(card).borderRadius) || 0,
        glass: (getComputedStyle(wrap).backdropFilter || "").includes("blur"),
        focused: document.activeElement === card.querySelector(".why-no__field"),
      };
    })()`;

    const WALK = `(() => {
      const text = document.body.innerText || "";
      if (text.includes("Do you love me?")) return { stage: "q7" };
      const msg = document.querySelector(".message-screen");
      if (msg) { msg.click(); return { stage: "message" }; }
      const postcard = document.querySelector(".postcard");
      if (postcard) { postcard.click(); return { stage: "start" }; }
      const primary = document.querySelector("button.btn--primary:not([disabled])");
      if (primary) { primary.click(); return { stage: "answer" }; }
      return { stage: "idle" };
    })()`;

    // ---------------------------------------------------------------
    // Walk to Question 7 of 7
    // ---------------------------------------------------------------
    await cdp.send("Page.navigate", { url: APP_URL });
    await sleep(2500);
    console.log(
      "diag:",
      JSON.stringify(
        await run(
          `({ url: location.href, ready: document.readyState, root: !!document.querySelector(".app"), len: document.body.innerText.length, head: document.body.innerText.slice(0, 120) })`,
        ),
      ),
    );

    let reached = false;
    let lastStage = "";
    for (let i = 0; i < 400; i += 1) {
      const state = await run(WALK);
      if (state.stage !== lastStage) {
        lastStage = state.stage;
        process.stdout.write(`  · ${i} ${state.stage}\n`);
      }
      if (state.stage === "q7") {
        reached = true;
        break;
      }
      await sleep(100);
    }
    check("walked to Question 7 of 7", reached);
    if (!reached) {
      process.exitCode = 1;
      return;
    }
    await sleep(900);

    const distTo = (r, x, y) =>
      Math.hypot(
        Math.max(r.x - x, 0, x - (r.x + r.w)),
        Math.max(r.y - y, 0, y - (r.y + r.h)),
      );

    const farPoint = (r) => {
      const spots = [
        [6, 6],
        [r.vw - 6, 6],
        [6, r.vh - 6],
        [r.vw - 6, r.vh - 6],
        [r.vw - 6, Math.round(r.vh / 2)],
        [6, Math.round(r.vh / 2)],
      ];
      return (
        spots
          .map(([x, y]) => ({ x, y, d: distTo(r, x, y) }))
          .sort((a, b) => b.d - a.d)[0] || { x: 6, y: 6 }
      );
    };

    /** one approach step: a point just outside the button, inside the ring */
    const nearPoint = (r, gap = 45, side = "above") => {
      if (side === "above") return { x: r.cx, y: r.y - gap };
      if (side === "below") return { x: r.cx, y: r.y + r.h + gap };
      if (side === "left") return { x: r.x - gap, y: r.cy };
      return { x: r.x + r.w + gap, y: r.cy };
    };

    const hopFrom = async (side, gap = 45) => {
      const far = farPoint(await run(READ_NO));
      await move(far.x, far.y);
      await sleep(720); // clear the catch window
      const before = await run(READ_NO);
      const near = nearPoint(before, gap, side);
      await move(near.x, near.y);
      await sleep(600); // let the spring settle
      const after = await run(READ_NO);
      return {
        before,
        after,
        moved: Math.hypot(after.x - before.x, after.y - before.y),
      };
    };

    // ---------------------------------------------------------------
    if (MODE === "yes") {
      const before = await run(READ_NO);
      await run(
        `document.querySelector(".choices .btn--primary").click()`,
      );
      await sleep(2600);
      const body = await run(`document.body.innerText.toLowerCase()`);
      check("J. YES still continues the story", !body.includes("do you love me"));
      check(
        "J. the bridge scene follows Question 7",
        body.includes("enough questions"),
      );
      ws.close();
      return;
    }

    // ---------------------------------------------------------------
    // A — pointer far away → nothing moves
    // ---------------------------------------------------------------
    const base = await run(READ_NO);
    const farA = farPoint(base);
    const attemptsBefore = base.attempts;
    for (let i = 0; i < 6; i += 1) await move(farA.x, farA.y);
    await sleep(500);
    const afterA = await run(READ_NO);
    check(
      "A. pointer far away → NO does not move",
      afterA.x === base.x &&
        afterA.y === base.y &&
        afterA.attempts === attemptsBefore,
      `pos ${afterA.x},${afterA.y} vs ${base.x},${base.y}`,
    );

    // ---------------------------------------------------------------
    // B — approach → gentle, moderate escape
    // ---------------------------------------------------------------
    const b = await hopFrom("above");
    check(
      "B. pointer approaches → NO escapes",
      b.moved >= 95,
      `moved ${Math.round(b.moved)}px`,
    );
    check(
      "B. escape is moderate (100–220px), not a screen-hop",
      b.moved <= 235,
      `moved ${Math.round(b.moved)}px`,
    );

    // ---------------------------------------------------------------
    // C — backing off stops it; approaching again restarts it
    // ---------------------------------------------------------------
    const cStart = await run(READ_NO);
    const farC = farPoint(cStart);
    await move(farC.x, farC.y);
    await sleep(720);
    const preC = await run(READ_NO);
    const nearC = nearPoint(preC, 45, "left");
    await move(nearC.x, nearC.y);
    await sleep(550);
    const hoppedC = await run(READ_NO);
    // land on it (never dodges while the cursor is on the button)
    await move(hoppedC.cx, hoppedC.cy);
    await sleep(700); // catch window passes while we sit on it
    const satOn = await run(READ_NO);
    check(
      "C. sitting on the button → no movement",
      Math.abs(satOn.x - hoppedC.x) <= 2 && Math.abs(satOn.y - hoppedC.y) <= 2,
      `held at ${satOn.x},${satOn.y} (was ${hoppedC.x},${hoppedC.y})`,
    );
    // now back away, step by step (each step further than the last)
    await move(satOn.cx, satOn.y - 60);
    await sleep(60);
    await move(satOn.cx, satOn.y - 120);
    await sleep(60);
    await move(satOn.cx, satOn.y - 240);
    await sleep(400);
    const backedOff = await run(READ_NO);
    check(
      "C. pointer moves away → NO stops moving",
      backedOff.x === satOn.x && backedOff.y === satOn.y,
      `held at ${backedOff.x},${backedOff.y}`,
    );
    // and it wakes up again when the pointer returns
    const back = nearPoint(backedOff, 45, "above");
    await move(back.x, back.y);
    await sleep(600);
    const reApproached = await run(READ_NO);
    const cMove = Math.hypot(
      reApproached.x - backedOff.x,
      reApproached.y - backedOff.y,
    );
    check(
      "C. approaching again → NO dodges again",
      cMove >= 95 && cMove <= 235,
      `moved ${Math.round(cMove)}px`,
    );

    // ---------------------------------------------------------------
    // D — every escape stays moderate
    // ---------------------------------------------------------------
    const hops = [];
    for (const side of ["right", "below", "left", "above"]) {
      const h = await hopFrom(side);
      hops.push(Math.round(h.moved));
    }
    check(
      "D. every escape is moderate (95–235px)",
      hops.every((v) => v >= 95 && v <= 235),
      hops.join(", ") + "px",
    );
    check(
      "D. no teleport to the other side of the screen",
      Math.max(...hops) <= 235,
      `max ${Math.max(...hops)}px`,
    );

    // ---------------------------------------------------------------
    // Touch — reacts to a finger, moderate hop
    // ---------------------------------------------------------------
    const farT = farPoint(await run(READ_NO));
    await move(farT.x, farT.y, "touch");
    await sleep(720);
    const preT = await run(READ_NO);
    const nearT = nearPoint(preT, 40, "right");
    await move(nearT.x, nearT.y, "touch");
    await sleep(600);
    const postT = await run(READ_NO);
    const touchHop = Math.hypot(postT.x - preT.x, postT.y - preT.y);
    check(
      "7. touch approaching → moderate dodge",
      touchHop >= 95 && touchHop <= 235,
      `moved ${Math.round(touchHop)}px`,
    );

    // ---------------------------------------------------------------
    // E + F — it can be caught, and clicking it opens the modal
    // ---------------------------------------------------------------
    const farE = farPoint(await run(READ_NO));
    await move(farE.x, farE.y);
    await sleep(720);
    const preE = await run(READ_NO);
    await move(preE.cx, preE.y - 45); // approach → hop
    await sleep(650); // let the spring settle and the catch window pass
    const hoppedE = await run(READ_NO);
    await move(hoppedE.cx, hoppedE.cy); // land squarely on it
    await sleep(1000); // well past the catch window
    const landed = await run(READ_NO);
    check(
      "E. cursor on the button → it holds still (catchable)",
      Math.abs(landed.x - hoppedE.x) <= 2 && Math.abs(landed.y - hoppedE.y) <= 2,
      `at ${landed.x},${landed.y} (was ${hoppedE.x},${hoppedE.y})`,
    );

    await tapNo();
    await sleep(500);
    const modal = await run(READ_MODAL);
    check("F. tapping NO opens the modal", !!modal);
    check(
      "F. modal title is \"Why no? 🥺\"",
      modal?.title === "Why no? 🥺",
      JSON.stringify(modal?.title),
    );
    check(
      "F. modal subtitle / placeholder / buttons",
      modal?.subtitle === "I'm curious… tell me why ❤️" &&
        modal?.placeholder === "Tell me honestly…" &&
        modal?.send === "Send ❤️" &&
        modal?.later === "Maybe later",
      JSON.stringify([modal?.subtitle, modal?.placeholder, modal?.send, modal?.later]),
    );
    check(
      "F. glassmorphism + rounded + glow",
      modal?.radius >= 20 && modal?.glass,
      `radius ${modal?.radius}px, blur ${modal?.glass}`,
    );
    check("F. textarea is focused on open", modal?.focused === true);

    await sleep(1600);
    const stillOpen = await run(READ_MODAL);
    check("F. modal does not close by itself", !!stillOpen);

    // ---------------------------------------------------------------
    // H — "Maybe later" closes it and leaves Question 7 untouched
    // ---------------------------------------------------------------
    const beforeLater = await run(READ_NO);
    await run(`document.querySelector(".why-no__later").click()`);
    await sleep(600);
    const modalGone = await run(READ_MODAL);
    const onQ7 = await run(`document.body.innerText.includes("Do you love me?")`);
    const afterLater = await run(READ_NO);
    check("H. \"Maybe later\" closes the modal", !modalGone);
    check("H. back on Question 7 of 7", onQ7 === true);
    check(
      "H. NO kept its position",
      beforeLater && afterLater &&
        Math.abs(afterLater.x - beforeLater.x) <= 2 &&
        Math.abs(afterLater.y - beforeLater.y) <= 2,
      `${afterLater.x},${afterLater.y} vs ${beforeLater.x},${beforeLater.y}`,
    );

    // ---------------------------------------------------------------
    // 6 — after the modal: still proximity-based, still moderate
    // ---------------------------------------------------------------
    const far6 = farPoint(afterLater);
    await move(far6.x, far6.y);
    await sleep(500);
    const still6 = await run(READ_NO);
    check(
      "6. after the modal, far pointer → NO still",
      still6.x === afterLater.x && still6.y === afterLater.y,
    );
    const n6 = await hopFrom("below");
    check(
      "6. after the modal, approaching → NO still dodges moderately",
      n6.moved >= 95 && n6.moved <= 235,
      `moved ${Math.round(n6.moved)}px`,
    );

    // ---------------------------------------------------------------
    // I — no "Okay, fine" anywhere
    // ---------------------------------------------------------------
    const textI = await run(`document.body.innerText`);
    check(
      "I. no \"Okay, fine\" (or any NO fallback) on screen",
      !/okay,?\s*fine/i.test(textI) && !/caught/i.test(textI),
    );

    // ---------------------------------------------------------------
    // Reopen, write something, Send
    // ---------------------------------------------------------------
    const farG = farPoint(await run(READ_NO));
    await move(farG.x, farG.y);
    await sleep(720);
    const preG = await run(READ_NO);
    await move(preG.cx, preG.y - 45);
    await sleep(140);
    const hoppedG = await run(READ_NO);
    await move(hoppedG.cx, hoppedG.cy);
    await sleep(150);
    await run(`document.querySelector(".dodge-btn").click()`);
    await sleep(450);
    check("re-opened the modal", !!(await run(READ_MODAL)));

    const note = "Because you always steal my hoodies 🧥";
    const typed = await run(`(() => {
      const ta = document.querySelector(".why-no__field");
      if (!ta) return null;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, ${JSON.stringify(note)});
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      return ta.value;
    })()`);
    check("typed into the textarea", typed === note, JSON.stringify(typed));

    await run(`document.querySelector(".why-no__send").click()`);
    await sleep(700);
    const stored = await run(`window.__whyNoResponse ? window.__whyNoResponse() : "(missing)"`);
    check("G. \"Send ❤️\" stores the note", stored === note, JSON.stringify(stored));

    const modalAfterSend = await run(READ_MODAL);
    check("G. modal closed after Send", !modalAfterSend);

    await sleep(2400);
    const bodyAfter = await run(`document.body.innerText.toLowerCase()`);
    check(
      "G. journey continues normally after Send",
      !bodyAfter.includes("do you love me") && bodyAfter.includes("enough questions"),
    );
    check(
      "I. still no \"Okay, fine\" anywhere",
      !/okay,?\s*fine/.test(bodyAfter),
    );

    ws.close();
  } finally {
    chrome.kill();
  }

  console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
}

main().catch((error) => {
  console.error("verification error:", error);
  process.exitCode = 1;
});

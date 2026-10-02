/**
 * Server-side Telegram delivery for the answers Nasiba collects through the
 * story.
 *
 * Everything in this module runs only on a server: the Vercel function in
 * `api/telegram.ts`, or the local middleware the Vite dev/preview server
 * mounts from `vite.config.ts`. The bot token and the chat id are read from
 * the process environment and are never imported by anything under `src/`,
 * so they can never reach the browser bundle.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

/** One answered question, exactly as the browser recorded it. */
export interface AnswerEntry {
  id: string;
  prompt: string;
  answer: string;
}

/** The complete set of responses collected during one run of the story. */
export interface ResponsesPayload {
  /** her name */
  nasiba: string;
  /** the name of the person who made the surprise */
  abbos: string;
  /** every question, in order */
  answers: AnswerEntry[];
  /** the answer to "Do you love me?" */
  q7Answer: string;
  /** what she wrote in the "Why no? 🥺" modal, if she wrote anything */
  whyNoReason: string | null;
  /** what she wrote in the "What do you think about Abbos?" modal */
  opinion: string | null;
}

/** The subset of the environment this module is allowed to look at. */
export interface TelegramEnv {
  TELEGRAM_BOT_TOKEN?: string | undefined;
  TELEGRAM_CHAT_ID?: string | undefined;
}

const TELEGRAM_SEND_MESSAGE_URL = "https://api.telegram.org/bot{token}/sendMessage";

/** Refuse oversized request bodies early — the real payload is < 10 KB. */
const MAX_BODY_BYTES = 64 * 1024;

/** How long we are willing to wait for Telegram before failing the request. */
const TELEGRAM_TIMEOUT_MS = 15_000;

/** Reads a configured value defensively (Vercel env vars may carry stray spaces). */
function envValue(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Raised while reading the body, so the caller can answer with the right status. */
class BodyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Number badges for the first ten questions. */
const NUMBER_BADGES = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validates an untrusted request body and turns it into a payload.
 * Returns `null` for anything that is not a complete, well-formed payload.
 */
export function parsePayload(body: unknown): ResponsesPayload | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = body as Record<string, unknown>;

  const nasiba = asTrimmedString(raw.nasiba);
  const abbos = asTrimmedString(raw.abbos);
  const q7Answer = asTrimmedString(raw.q7Answer);
  if (!nasiba || !abbos || !q7Answer) return null;

  if (!Array.isArray(raw.answers) || raw.answers.length === 0) return null;
  const answers: AnswerEntry[] = [];
  for (const item of raw.answers) {
    if (typeof item !== "object" || item === null) return null;
    const entry = item as Record<string, unknown>;
    const prompt = asTrimmedString(entry.prompt);
    const answer = asTrimmedString(entry.answer);
    if (!prompt || !answer) return null;
    answers.push({ id: asTrimmedString(entry.id) ?? "", prompt, answer });
  }

  return {
    nasiba,
    abbos,
    answers,
    q7Answer,
    whyNoReason: asTrimmedString(raw.whyNoReason),
    opinion: asTrimmedString(raw.opinion),
  };
}

/** Escapes user text so it can safely travel inside Telegram HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** The one and only message: names, every answer, both modals, timestamp. */
export function formatTelegramMessage(
  payload: ResponsesPayload,
  sentAt: Date = new Date(),
): string {
  const { nasiba, abbos, answers, q7Answer, whyNoReason, opinion } = payload;
  const lines: string[] = [];

  lines.push(`💌 <b>Answers from ${escapeHtml(nasiba)}</b> ❤️`);
  lines.push("");
  lines.push(`👩 <b>${escapeHtml(nasiba)}</b> answered the questions`);
  lines.push(`💘 <b>${escapeHtml(abbos)}</b> asked them`);
  lines.push("");
  lines.push(`📊 <b>${answers.length} questions answered</b>`);
  lines.push("");

  answers.forEach((entry, index) => {
    const badge = NUMBER_BADGES[index] ?? `${index + 1}.`;
    lines.push(`${badge} <b>${escapeHtml(entry.prompt)}</b>`);
    lines.push(`   ✅ ${escapeHtml(entry.answer)}`);
    lines.push("");
  });

  lines.push(`💝 <b>Question 7 · Do you love me?:</b> ${escapeHtml(q7Answer)}`);
  lines.push(
    `🚫 <b>Reason for "No" (Why no? 🥺):</b> ${
      whyNoReason ? escapeHtml(whyNoReason) : "<i>not provided</i>"
    }`,
  );
  lines.push(
    `💭 <b>Opinion about ${escapeHtml(abbos)}:</b> ${
      opinion ? escapeHtml(opinion) : "<i>not provided</i>"
    }`,
  );
  lines.push("");
  lines.push(`🕒 <b>Sent:</b> ${sentAt.toISOString()}`);

  return lines.join("\n");
}

/** Removes the bot token from anything that could end up in a log or a reply. */
function sanitize(message: string, token: string | undefined): string {
  if (!token) return message;
  return message.split(token).join("[redacted]");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  // Vercel (and any other framework) usually parses JSON bodies for us.
  const preParsed = (req as IncomingMessage & { body?: unknown }).body;
  if (preParsed !== undefined && preParsed !== null) {
    if (typeof preParsed === "string") return JSON.parse(preParsed);
    if (Buffer.isBuffer(preParsed)) return JSON.parse(preParsed.toString("utf8"));
    return preParsed;
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buffer.length;
    if (total > MAX_BODY_BYTES) {
      throw new BodyError("request body too large", 413);
    }
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) throw new BodyError("empty request body", 400);
  return JSON.parse(text);
}

/** Calls Telegram's sendMessage with the formatted message. */
export async function sendToTelegram(
  payload: ResponsesPayload,
  env: TelegramEnv,
): Promise<void> {
  const token = envValue(env.TELEGRAM_BOT_TOKEN);
  const chatId = envValue(env.TELEGRAM_CHAT_ID);
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not configured");
  }

  const url = TELEGRAM_SEND_MESSAGE_URL.replace("{token}", token);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
      body: JSON.stringify({
        chat_id: chatId,
        text: formatTelegramMessage(payload),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`could not reach Telegram: ${sanitize(detail, token)}`);
  }

  const rawBody = await response.text();
  let data: { ok?: boolean; description?: string } = {};
  try {
    data = JSON.parse(rawBody) as { ok?: boolean; description?: string };
  } catch {
    /* handled below */
  }

  if (!response.ok || data.ok !== true) {
    const detail = sanitize(
      `${response.status} ${data.description ?? rawBody.slice(0, 200)}`,
      token,
    );
    throw new Error(`Telegram rejected the message: ${detail}`);
  }
}

/**
 * Shared HTTP handler. Used verbatim by the Vercel function and by the local
 * dev/preview middleware, so the endpoint behaves identically in both.
 */
export async function handleTelegramRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: TelegramEnv = process.env,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    const status = error instanceof BodyError ? error.status : 400;
    const message = status === 413 ? "Request body too large" : "Invalid JSON body";
    sendJson(res, status, { ok: false, error: message });
    return;
  }

  const payload = parsePayload(body);
  if (!payload) {
    sendJson(res, 400, { ok: false, error: "Invalid payload" });
    return;
  }

  if (!envValue(env.TELEGRAM_BOT_TOKEN) || !envValue(env.TELEGRAM_CHAT_ID)) {
    sendJson(res, 500, { ok: false, error: "Telegram is not configured on the server" });
    return;
  }

  try {
    await sendToTelegram(payload, env);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error("[telegram]", sanitize(detail, envValue(env.TELEGRAM_BOT_TOKEN) ?? undefined));
    sendJson(res, 502, { ok: false, error: "Could not deliver the message" });
  }
}

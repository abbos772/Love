import type { CollectedAnswer } from "./responses";

/**
 * The shape the server expects for POST /api/telegram.
 *
 * No token, no chat id, no server detail of any kind: the browser only ever
 * knows the endpoint path. Everything secret stays in the server environment.
 */
export interface ResponsesRequest {
  nasiba: string;
  abbos: string;
  answers: CollectedAnswer[];
  q7Answer: string;
  whyNoReason: string | null;
  opinion: string | null;
}

/**
 * Sends every collected response to the bot in one message.
 *
 * Failures are swallowed on purpose — the story must never break, stall or
 * show an error because Telegram was unreachable. Returns whether the server
 * accepted the message, for verification purposes.
 */
export async function sendResponsesToTelegram(
  payload: ResponsesRequest,
): Promise<boolean> {
  try {
    const response = await fetch("/api/telegram", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (import.meta.env.DEV) {
        console.warn(`[telegram] endpoint replied ${response.status}`);
      }
      return false;
    }

    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean }
      | null;
    return data?.ok === true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[telegram] could not reach the endpoint", error);
    }
    return false;
  }
}

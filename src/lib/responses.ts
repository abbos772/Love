/**
 * Where her honest answers collect while the story plays.
 *
 * Deliberately in-memory only: nothing is written to disk. The values are
 * kept module-level so the Telegram sender in `src/lib/telegram.ts` can read
 * the whole set at any time with `getResponsesSnapshot()` once every required
 * response has been collected.
 *
 * Sending happens elsewhere — this module never talks to the network, and no
 * secret ever lives in it.
 */
let whyNoResponse: string | null = null;

/** One answered question. */
export interface CollectedAnswer {
  id: string;
  prompt: string;
  answer: string;
}

let answers: CollectedAnswer[] = [];
let abbosOpinion: string | null = null;

/** Stores the note she writes in the "Why no? 🥺" modal. */
export function saveWhyNoResponse(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  whyNoResponse = trimmed;
}

/** The stored note, or `null` when she has not written one yet. */
export function getWhyNoResponse(): string | null {
  return whyNoResponse;
}

/** Forgets the stored note (used when the story is replayed). */
export function clearWhyNoResponse(): void {
  whyNoResponse = null;
}

/** Records one of the seven question answers. */
export function saveAnswer(entry: CollectedAnswer): void {
  const answer = entry.answer.trim();
  if (!answer) return;
  answers = [...answers.filter((item) => item.id !== entry.id), { ...entry, answer }];
}

/** Every answer so far, in the order they were given. */
export function getAnswers(): CollectedAnswer[] {
  return answers;
}

/** Stores what she writes in the "What do you think about Abbos? ❤️" modal. */
export function saveAbbosOpinion(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  abbosOpinion = trimmed;
}

/** The stored opinion, or `null` when she has not written one yet. */
export function getAbbosOpinion(): string | null {
  return abbosOpinion;
}

/** Everything collected during one run, ready to be sent. */
export function getResponsesSnapshot(): {
  answers: CollectedAnswer[];
  whyNo: string | null;
  opinion: string | null;
} {
  return { answers: [...answers], whyNo: whyNoResponse, opinion: abbosOpinion };
}

/** Forgets everything (used when the story is replayed). */
export function clearResponses(): void {
  answers = [];
  abbosOpinion = null;
  whyNoResponse = null;
}

// Dev-only peek: lets the store be verified while working on the app (and
// makes it trivial to check that the Telegram sender picked every response
// up). `import.meta.env.DEV` is false in a production build, so this whole
// branch is dropped when the site is bundled.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __whyNoResponse?: () => string | null }).__whyNoResponse =
    getWhyNoResponse;
  (window as unknown as { __responses?: () => ReturnType<typeof getResponsesSnapshot> })
    .__responses = getResponsesSnapshot;
}

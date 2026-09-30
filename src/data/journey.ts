import type { ParticleShape } from "../lib/particles";

/**
 * The two people this whole thing is about. The names are pulled from here so
 * every personalised line stays in one place and is trivial to update.
 */
export const COUPLE = {
  /** who wrote the surprise */
  from: "Abbos",
  /** who it is for */
  to: "Nasiba",
} as const;

export interface Choice {
  /** Button copy without the emoji. */
  label: string;
  emoji: string;
  variant: "primary" | "ghost";
  /** Warm one-liner shown right after she answers. */
  reaction: string;
  /** Confetti-style effect fired from the button that was tapped. */
  burst: ParticleShape;
  /** Emoji that pops in the middle of the card as a reaction. */
  popEmoji: string;
  /** Optional playful dodge behaviour for the "no" answer. */
  dodge?: {
    maxDodges: number;
    taunt: string;
    caughtLabel: string;
  };
}

export interface Question {
  id: string;
  /** Small line above the prompt, used for the dramatic final question. */
  eyebrow?: string;
  prompt: string;
  /** Quiet prompt in the space that later holds the reaction. */
  hint: string;
  choices: [Choice, Choice];
}

const YES: "primary" = "primary";
const NO: "ghost" = "ghost";

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    prompt: "Do you remember the moment when we first became special to each other?",
    hint: `${COUPLE.to}, take your time ❤️`,
    choices: [
      {
        label: "Yes",
        emoji: "🥰",
        variant: YES,
        reaction: `I knew it. That moment lives in me too, ${COUPLE.to} ❤️`,
        burst: "heart",
        popEmoji: "🥰",
      },
      {
        label: "Not really",
        emoji: "😅",
        variant: NO,
        reaction: "That's okay… I'll remind you of it every single day ❤️",
        burst: "spark",
        popEmoji: "😅",
      },
    ],
  },
  {
    id: "q2",
    prompt: "Do I make you smile sometimes?",
    hint: "Be honest now 🥺",
    choices: [
      {
        label: "Yes",
        emoji: "❤️",
        variant: YES,
        reaction: "Good. Because your smile is my favourite view 🥰",
        burst: "heart",
        popEmoji: "😊",
      },
      {
        label: "No",
        emoji: "😳",
        variant: NO,
        reaction: "Impossible 😳… but okay, challenge accepted. Watch me try 😌",
        burst: "spark",
        popEmoji: "😳",
      },
    ],
  },
  {
    id: "q3",
    prompt:
      "Do you love talking with me even when we have nothing interesting to talk about?",
    hint: "There's no wrong answer ❤️",
    choices: [
      {
        label: "Absolutely",
        emoji: "❤️",
        variant: YES,
        reaction: "Those are honestly my favourite conversations 🫶",
        burst: "heart",
        popEmoji: "🫶",
      },
      {
        label: "Maybe",
        emoji: "😅",
        variant: NO,
        reaction: "I'll take a maybe. I'm very patient 😌❤️",
        burst: "spark",
        popEmoji: "😅",
      },
    ],
  },
  {
    id: "q4",
    prompt: "Do you think we look cute together?",
    hint: "I think I already know 😌",
    choices: [
      {
        label: "Yes",
        emoji: "😍",
        variant: YES,
        reaction: "Cute? We're dangerously cute 😍",
        burst: "heart",
        popEmoji: "😍",
      },
      {
        label: "No",
        emoji: "🙈",
        variant: NO,
        reaction: "Liar 🙈 but you're a very cute liar",
        burst: "spark",
        popEmoji: "🙈",
      },
    ],
  },
  {
    id: "q5",
    eyebrow: "One honest question…",
    prompt: "Do you love me?",
    hint: "Go on… I'm ready 😌",
    choices: [
      {
        label: "Yes",
        emoji: "❤️",
        variant: YES,
        reaction: `That's all I ever needed to hear, ${COUPLE.to} ❤️`,
        burst: "heart",
        popEmoji: "❤️",
      },
      {
        label: "No",
        emoji: "💔",
        variant: NO,
        reaction: "",
        burst: "spark",
        popEmoji: "😂",
        dodge: {
          maxDodges: 3,
          taunt: "Nice try 😂❤️",
          caughtLabel: "Okay, fine",
        },
      },
    ],
  },
];

export const TOTAL_QUESTIONS = QUESTIONS.length;

/** Short notes shown between scenes — deliberately only a few per run. */
export const ROMANTIC_MESSAGES = [
  "You make ordinary moments feel special. ❤️",
  "My favorite notification is your name. 📱❤️",
  "I still choose you. Every single time.",
  "Somehow, you became my favorite person. 🫶",
  "My world is a little better with you in it. ❤️",
  `${COUPLE.to}, I loved the Mi Buds 6 Play you gave me for my birthday. 🎁❤️`,
  "But more than the gift, that it was YOU who gave it means everything.",
] as const;

/** Copy for the opening invitation screen. */
export const INTRO = {
  eyebrow: `Just for ${COUPLE.to} ❤️`,
  title: `${COUPLE.to}, ${COUPLE.from} made a little surprise for you ❤️`,
  subtitle: "Before you continue… promise me you'll answer honestly? 🥺",
  hint: `Made by ${COUPLE.from} — just for you ❤️`,
  buttons: [
    { label: "Yes", emoji: "❤️" },
    { label: "Of course", emoji: "😌" },
  ],
} as const;

export const BRIDGE = {
  eyebrow: "Deep breath…",
  lines: [
    "Okay… enough questions.",
    "Before my last question, there's one memory I want us to hold on to. ❤️",
  ],
  button: "Continue…",
} as const;

/**
 * The birthday memory: the Mi Buds 6 Play gift and the handwritten card.
 * The photo is the real one Abbos uploaded — never a placeholder.
 */
export const MEMORY = {
  title: "One memory I will always remember ❤️",
  lead: "On my birthday, you gave me Mi Buds 6 Play… 🎁❤️",
  image: "/images/gift-photo.jpg",
  imageAlt:
    "The Mi Buds 6 Play headphones and the handwritten card Nasiba gave Abbos",
  lines: [
    "I absolutely loved that gift.",
    "But more than the gift, that it was YOU who gave it is what I'll always treasure. ❤️",
  ],
  thanks: "I loved it so much, thank you. 🥹❤️",
  caption: "I'll remember this day forever.",
  zoomHint: "Tap the photo to zoom in",
  button: "Let's hold on to this memory too ❤️",
} as const;

export const PROPOSAL = {
  eyebrow: "One question, forever in the making",
  title: `${COUPLE.to}, will you spend your whole life with me?`,
  titleEmoji: "💍❤️",
  subtitle:
    "I don't promise a perfect life… but I promise to keep choosing you and cherishing you, every single day.",
  accept: { label: "Yes, I will", emoji: "❤️" },
  think: { label: "Let me think", emoji: "😳" },
  thinkResponse: "Take your time… but my heart already knows the answer 😌❤️",
  thinkRetry: "Okay, one more time 😏",
} as const;

export const FINALE = {
  title: `${COUPLE.to}, you just made me the happiest person alive. ❤️`,
  subtitle: "Forever starts here. 💍",
  replay: "Replay our story ❤️",
  note: `Made by ${COUPLE.from} — only for ${COUPLE.to} ❤️`,
} as const;

/** Picks a few messages at random so a replay is never identical. */
export function pickMessages(count: number): string[] {
  const pool = [...ROMANTIC_MESSAGES];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

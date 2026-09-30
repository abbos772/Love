import { useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Heart, Sparkles } from "lucide-react";
import { INTRO, type Choice } from "../data/journey";
import type { FxApi } from "../hooks/useFx";
import type { SoundApi } from "../hooks/useSound";
import { itemVariants, listVariants } from "../lib/motion";
import { ChoiceButton } from "./ChoiceButton";
import { SparkleRing } from "./SparkleRing";
import { WordReveal } from "./WordReveal";

interface IntroScreenProps {
  fx: FxApi;
  sound: SoundApi;
  onBegin: () => void;
}

const OPENERS: Choice[] = [
  {
    label: INTRO.buttons[0].label,
    emoji: INTRO.buttons[0].emoji,
    variant: "primary",
    reaction: "",
    burst: "heart",
    popEmoji: "❤️",
  },
  {
    label: INTRO.buttons[1].label,
    emoji: INTRO.buttons[1].emoji,
    variant: "ghost",
    reaction: "",
    burst: "spark",
    popEmoji: "😌",
  },
];

/** Screen 1 — the invitation. */
export function IntroScreen({ fx, sound, onBegin }: IntroScreenProps) {
  const started = useRef(false);
  const heartRef = useRef<HTMLSpanElement>(null);

  const begin = useCallback(
    (element: HTMLButtonElement | null, choice: Choice) => {
      if (started.current) return;
      started.current = true;
      sound.engine.pop();
      fx.burstFrom(element, choice.burst, 22);
      window.setTimeout(() => sound.engine.chime(), 150);
      window.setTimeout(onBegin, 900);
    },
    [fx, onBegin, sound],
  );

  return (
    <motion.div className="card" variants={listVariants}>
      <motion.span className="intro__badge" variants={itemVariants}>
        <motion.span
          ref={heartRef}
          className="intro__mini-heart"
          animate={{ scale: [1, 1.22, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Heart size={12} fill="currentColor" strokeWidth={0} />
        </motion.span>
        {INTRO.eyebrow}
      </motion.span>

      <motion.div className="card__head" variants={itemVariants}>
        <WordReveal
          as="h1"
          className="display display--xl"
          text={INTRO.title}
          stagger={0.085}
          delay={0.15}
        />

        <motion.span className="ornament" variants={itemVariants} aria-hidden="true">
          <Sparkles size={14} />
        </motion.span>

        <motion.p className="quote" variants={itemVariants}>
          {INTRO.subtitle}
        </motion.p>
      </motion.div>

      <div className="choices choices--row">
        {OPENERS.map((choice, index) => (
          <motion.div className="btn-wrap" key={choice.label} variants={itemVariants}>
            <ChoiceButton
              choice={choice}
              locked={false}
              chosen={false}
              dimmed={false}
              onSelect={begin}
              showSparkles={false}
            />
            {index === 0 && <SparkleRing />}
          </motion.div>
        ))}
      </div>

      <motion.p
        className="hint"
        variants={itemVariants}
        style={{ marginTop: "clamp(18px, 4vw, 24px)" }}
      >
        {INTRO.hint}
      </motion.p>
    </motion.div>
  );
}

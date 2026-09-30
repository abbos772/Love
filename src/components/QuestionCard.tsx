import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import type { Choice, Question } from "../data/journey";
import type { FxApi } from "../hooks/useFx";
import type { SoundApi } from "../hooks/useSound";
import { itemVariants, listVariants, popVariants } from "../lib/motion";
import { ChoiceButton } from "./ChoiceButton";
import { DodgingButton } from "./DodgingButton";
import { ProgressBar } from "./ProgressBar";

interface QuestionCardProps {
  question: Question;
  /** 0-based index of this question */
  index: number;
  total: number;
  sound: SoundApi;
  fx: FxApi;
  onAnswer: (choice: Choice) => void;
}

/** How long the reaction lingers before the story moves on. */
const REACTION_HOLD = 1500;
const DODGE_HOLD = 1900;

export function QuestionCard({
  question,
  index,
  total,
  sound,
  fx,
  onAnswer,
}: QuestionCardProps) {
  const [picked, setPicked] = useState<Choice | null>(null);
  const [reaction, setReaction] = useState<string | null>(null);
  const [pop, setPop] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const later = useCallback((fn: () => void, delay: number) => {
    timers.current.push(window.setTimeout(fn, delay));
  }, []);

  /** Locks the card, plays the reaction and then hands control back up. */
  const celebrate = useCallback(
    (choice: Choice, element: Element | null, delay: number) => {
      setPicked(choice);
      setPop(choice.popEmoji);
      fx.burstFrom(element, choice.burst, choice.variant === "primary" ? 24 : 16);
      sound.engine.pop();
      later(() => sound.engine.chime(), 160);
      later(() => onAnswer(choice), delay);
    },
    [fx, later, onAnswer, sound],
  );

  const handleSelect = useCallback(
    (element: HTMLButtonElement | null, choice: Choice) => {
      if (picked) return;
      if (choice.dodge) return; // handled by DodgingButton
      setReaction(choice.reaction);
      celebrate(choice, element, REACTION_HOLD);
    },
    [celebrate, picked],
  );

  const handleDodgeCaught = useCallback(() => {
    const choice = question.choices[1];
    setReaction(choice.dodge?.taunt ?? "Nice try 😂❤️");
    setPop("😂");
    fx.burstFrom(cardRef.current, "spark", 12);
    later(() => fx.burstFrom(cardRef.current, "spark", 18), 260);
  }, [fx, later, question.choices]);

  const handleDodgeContinue = useCallback(
    (element: HTMLButtonElement | null) => {
      const choice = question.choices[1];
      celebrate(choice, element, DODGE_HOLD);
    },
    [celebrate, question.choices],
  );

  const locked = picked !== null;
  const dodgeChoice = question.choices.find((choice) => choice.dodge);
  const normalChoices = question.choices.filter((choice) => !choice.dodge);

  return (
    <motion.div ref={cardRef} className="card" variants={listVariants}>
      <ProgressBar current={index + 1} total={total} />

      <motion.div className="card__head" variants={itemVariants}>
        {question.eyebrow && (
          <motion.span className="eyebrow" variants={itemVariants}>
            {question.eyebrow}
          </motion.span>
        )}
        <motion.h2 className="display display--lg" variants={itemVariants}>
          {question.prompt}
        </motion.h2>
      </motion.div>

      <motion.div className="card__reaction-slot" variants={itemVariants}>
        <AnimatePresence mode="wait">
          {reaction ? (
            <motion.p
              key="reaction"
              className="reaction"
              variants={popVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              aria-live="polite"
            >
              <Heart
                size={14}
                fill="currentColor"
                strokeWidth={0}
                style={{ color: "var(--rose-500)", flex: "none" }}
              />
              {reaction}
            </motion.p>
          ) : (
            <motion.span
              key="hint"
              className="hint"
              variants={itemVariants}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
            >
              {question.hint}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="choices">
        {normalChoices.map((choice, choiceIndex) => (
          <ChoiceButton
            key={choice.label}
            choice={choice}
            locked={locked}
            chosen={picked === choice}
            dimmed={picked !== null && picked !== choice}
            showSparkles={choiceIndex === 0 && choice.variant === "primary"}
            onSelect={handleSelect}
          />
        ))}

        {dodgeChoice && (
          <motion.div variants={itemVariants}>
            <DodgingButton
              label={dodgeChoice.label}
              emoji={dodgeChoice.emoji}
              caughtLabel={dodgeChoice.dodge?.caughtLabel ?? "Okay, fine"}
              maxDodges={dodgeChoice.dodge?.maxDodges ?? 3}
              sound={sound}
              onCaught={handleDodgeCaught}
              onContinue={handleDodgeContinue}
            />
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {pop && (
          <motion.span
            key={`${pop}-${index}`}
            className="pop-emoji"
            initial={{ opacity: 0, scale: 0.4, y: 10 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.4, 1.25, 1.1, 0.95],
              y: [10, -10, -34, -58],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], times: [0, 0.25, 0.65, 1] }}
            aria-hidden="true"
          >
            {pop}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

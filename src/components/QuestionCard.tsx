import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import type { Choice, Question } from "../data/journey";
import type { FxApi } from "../hooks/useFx";
import type { SoundApi } from "../hooks/useSound";
import { itemVariants, listVariants, popVariants } from "../lib/motion";
import { saveAbbosOpinion, saveWhyNoResponse } from "../lib/responses";
import { ChoiceButton } from "./ChoiceButton";
import { DodgingButton } from "./DodgingButton";
import { ProgressBar } from "./ProgressBar";
import { QuestionMoodLayer } from "./QuestionMood";
import { WhyNoModal, type WhyNoModalCopy } from "./WhyNoModal";

interface QuestionCardProps {
  question: Question;
  /** 0-based index of this question */
  index: number;
  total: number;
  sound: SoundApi;
  fx: FxApi;
  onAnswer: (choice: Choice) => void;
  /**
   * When present, the "yes" answer to this question first opens a little
   * dialog asking what she thinks about Abbos. Only ever passed for the last
   * question — everything else keeps its original, immediate reaction.
   */
  opinionCopy?: WhyNoModalCopy;
}

/** How long the reaction lingers before the story moves on. */
const REACTION_HOLD = 1500;

export function QuestionCard({
  question,
  index,
  total,
  sound,
  fx,
  onAnswer,
  opinionCopy,
}: QuestionCardProps) {
  const [picked, setPicked] = useState<Choice | null>(null);
  const [reaction, setReaction] = useState<string | null>(null);
  const [pop, setPop] = useState<string | null>(null);
  /** how many times the "no" button has slipped away so far */
  const [attempts, setAttempts] = useState(0);
  /** true while the "Why no? 🥺" dialog is open */
  const [whyNoOpen, setWhyNoOpen] = useState(false);
  /** true while the "What do you think about Abbos? ❤️" dialog is open */
  const [opinionOpen, setOpinionOpen] = useState(false);
  /** the "yes" choice held back until she has written her opinion */
  const pendingOpinion = useRef<Choice | null>(null);
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
      // On the last question the "yes" answer pauses for her opinion about
      // Abbos; the reaction (and the rest of the story) waits right here.
      if (opinionCopy && choice.variant === "primary") {
        pendingOpinion.current = choice;
        setOpinionOpen(true);
        return;
      }
      setReaction(choice.reaction);
      celebrate(choice, element, REACTION_HOLD);
    },
    [celebrate, opinionCopy, picked],
  );

  /**
   * Every escape: counts the attempt, shows its taunt and sprinkles a few
   * sparks. There is no "caught" state any more — the button never gives up.
   */
  const handleDodge = useCallback(
    (attempt: number, taunt: string) => {
      setAttempts(attempt);
      setReaction(taunt);
      fx.burstFrom(cardRef.current, "spark", 7);
    },
    [fx],
  );

  const locked = picked !== null || opinionOpen;
  const dodgeChoice = question.choices.find((choice) => choice.dodge);
  const normalChoices = question.choices.filter((choice) => !choice.dodge);

  /** She caught it — the button never says "no", it just opens the dialog. */
  const handleCatch = useCallback(() => {
    if (picked) return;
    sound.engine.pop();
    setWhyNoOpen(true);
  }, [picked, sound]);

  /** "Send ❤️": keep her words, then let the story continue normally. */
  const handleWhyNoSend = useCallback(
    (text: string) => {
      saveWhyNoResponse(text);
      setWhyNoOpen(false);
      sound.engine.chime();
      if (!dodgeChoice) return;
      setReaction(dodgeChoice.reaction);
      celebrate(dodgeChoice, cardRef.current, REACTION_HOLD);
    },
    [celebrate, dodgeChoice, sound],
  );

  /** "Maybe later": just close it — still question 7, NO stays put. */
  const handleWhyNoLater = useCallback(() => {
    sound.engine.pop();
    setWhyNoOpen(false);
  }, [sound]);

  /** Releases the held-back "yes" choice and plays its usual reaction. */
  const proceedWithOpinion = useCallback(() => {
    const choice = pendingOpinion.current;
    pendingOpinion.current = null;
    if (!choice) return;
    setReaction(choice.reaction);
    celebrate(choice, cardRef.current, REACTION_HOLD);
  }, [celebrate]);

  /** "Send ❤️": keep what she thinks about Abbos, then continue as usual. */
  const handleOpinionSend = useCallback(
    (text: string) => {
      saveAbbosOpinion(text);
      setOpinionOpen(false);
      sound.engine.chime();
      proceedWithOpinion();
    },
    [proceedWithOpinion, sound],
  );

  /** "Maybe later": no opinion, but her "yes" still stands. */
  const handleOpinionLater = useCallback(() => {
    setOpinionOpen(false);
    sound.engine.pop();
    proceedWithOpinion();
  }, [proceedWithOpinion, sound]);

  return (
    <motion.div ref={cardRef} className="card" variants={listVariants}>
      {question.mood && <QuestionMoodLayer mood={question.mood} />}

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
              key={`reaction-${attempts}-${reaction}`}
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
              <span className="reaction__body">
                {attempts > 0 && (
                  <span className="reaction__attempts" aria-label={`Attempts ${attempts}`}>
                    Attempts {attempts}
                  </span>
                )}
                {reaction}
              </span>
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
              taunts={dodgeChoice.dodge?.taunts ?? ["Nice try 😏"]}
              sound={sound}
              disabled={locked || whyNoOpen}
              onDodge={handleDodge}
              onCatch={handleCatch}
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

      <WhyNoModal
        open={whyNoOpen}
        onSend={handleWhyNoSend}
        onLater={handleWhyNoLater}
      />

      <WhyNoModal
        open={opinionOpen && Boolean(opinionCopy)}
        copy={opinionCopy}
        onSend={handleOpinionSend}
        onLater={handleOpinionLater}
      />
    </motion.div>
  );
}

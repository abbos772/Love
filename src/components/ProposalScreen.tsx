import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { PROPOSAL } from "../data/journey";
import type { FxApi } from "../hooks/useFx";
import type { SoundApi } from "../hooks/useSound";
import { EASE_OUT, springSoft } from "../lib/motion";
import { GlowingHeart } from "./GlowingHeart";
import { SparkleRing } from "./SparkleRing";
import { WordReveal } from "./WordReveal";

interface ProposalScreenProps {
  fx: FxApi;
  sound: SoundApi;
  /** she said yes */
  onAccept: () => void;
}

const cardEnter = {
  initial: { opacity: 0, y: 22, scale: 0.975 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -16, scale: 0.98 },
};

/** Staggered firework salvo — the sky goes off the instant she says yes. */
const SALVO_DELAYS = [0, 130, 270, 420, 570, 720, 900, 1080, 1260, 1460];

/**
 * The climax. A single question, a much slower reveal than anything before it,
 * and a gentle detour if she needs a moment.
 */
export function ProposalScreen({ fx, sound, onAccept }: ProposalScreenProps) {
  const [thinking, setThinking] = useState(false);
  const accepted = useRef(false);
  const yesRef = useRef<HTMLDivElement>(null);

  const handleAccept = useCallback(() => {
    if (accepted.current) return;
    accepted.current = true;
    sound.engine.celebrate();
    fx.burstFrom(yesRef.current, "heart", 30);
    window.setTimeout(() => fx.burstFrom(yesRef.current, "spark", 26), 220);

    // Firework salvo, spread across the sky so it reads as a proper celebration.
    SALVO_DELAYS.forEach((delay) => {
      window.setTimeout(() => {
        const point = fx.randomPoint();
        fx.firework(point.x, point.y);
        if (Math.random() > 0.5) {
          const second = fx.randomPoint();
          fx.firework(second.x, second.y);
        }
      }, delay);
    });

    // let the first burst land before the celebration takes over
    window.setTimeout(onAccept, 780);
  }, [fx, onAccept, sound]);

  const handleThink = useCallback(() => {
    sound.engine.whoosh();
    setThinking(true);
  }, [sound]);

  const handleRetry = useCallback(() => {
    sound.engine.pop();
    setThinking(false);
  }, [sound]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {thinking ? (
        <motion.div
          key="think"
          className="card"
          {...cardEnter}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        >
          <div className="think-screen">
            <motion.span
              className="message-screen__mark"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={springSoft}
            >
              <motion.span
                animate={{ scale: [1, 1.16, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                style={{ display: "inline-flex" }}
              >
                <Heart size={20} fill="currentColor" strokeWidth={0} />
              </motion.span>
            </motion.span>

            <motion.p
              className="quote"
              style={{ fontSize: "clamp(1.15rem, 4vw, 1.5rem)" }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.7, ease: EASE_OUT }}
            >
              {PROPOSAL.thinkResponse}
            </motion.p>

            <motion.div
              className="btn-wrap"
              style={{ maxWidth: 340 }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.7, ease: EASE_OUT }}
            >
              <motion.button
                type="button"
                className="btn btn--primary"
                onClick={handleRetry}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={springSoft}
              >
                <span className="btn__shine" />
                <span className="btn__label">
                  {PROPOSAL.thinkRetry}
                </span>
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="ask"
          className="card card--celebrate"
          {...cardEnter}
          transition={{ duration: 0.9, ease: EASE_OUT }}
        >
          <motion.div
            className="stack stack--roomy"
            initial="hidden"
            animate="visible"
          >
            <motion.span
              className="eyebrow"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE_OUT }}
            >
              {PROPOSAL.eyebrow}
            </motion.span>

            <motion.div
              className="proposal__heart-wrap"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, type: "spring", stiffness: 120, damping: 15 }}
            >
              <GlowingHeart />
            </motion.div>

            <WordReveal
              as="h1"
              className="display display--xl"
              text={PROPOSAL.title}
              stagger={0.16}
              delay={0.6}
              trailing={PROPOSAL.titleEmoji}
            />

            <motion.p
              className="quote quote--gold proposal__subtitle"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 1.1, ease: EASE_OUT }}
            >
              {PROPOSAL.subtitle}
            </motion.p>

            <motion.div
              className="choices choices--row"
              style={{ width: "100%", marginTop: "clamp(18px, 4vw, 26px)" }}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.95, duration: 0.9, ease: EASE_OUT }}
            >
              <div className="btn-wrap" ref={yesRef}>
                <motion.button
                  type="button"
                  className="btn btn--gold"
                  onClick={handleAccept}
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  transition={springSoft}
                >
                  <span className="btn__shine" />
                  <span className="btn__label">
                    {PROPOSAL.accept.label}
                    <span className="btn__emoji" aria-hidden="true">
                      {PROPOSAL.accept.emoji}
                    </span>
                  </span>
                </motion.button>
                <SparkleRing />
              </div>

              <div className="btn-wrap">
                <motion.button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleThink}
                  whileHover={{ scale: 1.028, y: -2 }}
                  whileTap={{ scale: 0.972 }}
                  transition={springSoft}
                >
                  <span className="btn__shine" />
                  <span className="btn__label">
                    {PROPOSAL.think.label}
                    <span className="btn__emoji" aria-hidden="true">
                      {PROPOSAL.think.emoji}
                    </span>
                  </span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { MEMORIES } from "../data/journey";
import type { SoundApi } from "../hooks/useSound";
import { EASE_OUT, springSoft } from "../lib/motion";
import { SparkleRing } from "./SparkleRing";

interface MemoryCollageScreenProps {
  sound: SoundApi;
  /** she kept the memories and wants the story to go on */
  onContinue: () => void;
}

interface Drifter {
  top: string;
  left: string;
  size: number;
  delay: number;
  duration: number;
}

/** Slow hearts drifting around the collage. */
const HEARTS: Drifter[] = [
  { top: "-5%", left: "3%", size: 15, delay: 0, duration: 4.4 },
  { top: "58%", left: "-4%", size: 12, delay: 1.4, duration: 5.1 },
  { top: "103%", left: "12%", size: 11, delay: 2.4, duration: 4.7 },
  { top: "-6%", left: "93%", size: 13, delay: 0.8, duration: 5.4 },
  { top: "74%", left: "97%", size: 14, delay: 1.9, duration: 4.9 },
  { top: "30%", left: "50%", size: 10, delay: 3, duration: 5.6 },
];

const HEART_COLORS = ["#ff5d8f", "#ffb3c9", "#f4cf95", "#ff8fab", "#e8436f", "#e8436f"];

/** Delicate sparkles twinkling between the two cards. */
const SPARKLES: Drifter[] = [
  { top: "6%", left: "50%", size: 11, delay: 0.5, duration: 3.4 },
  { top: "90%", left: "47%", size: 9, delay: 1.8, duration: 3.8 },
  { top: "46%", left: "-2%", size: 8, delay: 2.6, duration: 3.2 },
  { top: "40%", left: "101%", size: 9, delay: 1.1, duration: 3.6 },
];

/**
 * One screen, two memories: the holding-hands photograph on the left and the
 * birthday gift photograph on the right, side by side on desktop and stacked
 * on small screens.
 *
 * Both cards rise and rotate into place with a spring, the copy fades in
 * around them, and a single guarded button carries the story forward — so the
 * two memories are never split across separate pages again.
 */
export function MemoryCollageScreen({ sound, onContinue }: MemoryCollageScreenProps) {
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const handleKeep = useCallback(() => {
    // one transition only, no matter how fast she taps
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    sound.engine.swell();
    timer.current = window.setTimeout(onContinue, 560);
  }, [onContinue, sound]);

  return (
    <motion.div className="memories">
      <motion.span
        className="memories__label"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.35 }}
      >
        {MEMORIES.label}
      </motion.span>

      <motion.h2
        className="display display--md memories__title"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: EASE_OUT, delay: 0.6 }}
      >
        {MEMORIES.title}
      </motion.h2>

      <div className="memories__collage">
        <span className="memories__floaters" aria-hidden="true">
          {HEARTS.map((heart, index) => (
            <motion.span
              key={`h${index}`}
              className="memories__floater"
              style={{
                top: heart.top,
                left: heart.left,
                color: HEART_COLORS[index % HEART_COLORS.length],
              }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{
                opacity: [0, 0.85, 0.25, 0.85, 0],
                scale: [0.4, 1, 1.14, 1, 0.45],
                y: [10, -6, -16, -26, -38],
              }}
              transition={{
                duration: heart.duration,
                delay: heart.delay + 1.1,
                repeat: Infinity,
                repeatDelay: 0.6,
                ease: "easeInOut",
              }}
            >
              <Heart size={heart.size} fill="currentColor" strokeWidth={0} />
            </motion.span>
          ))}
          {SPARKLES.map((spark, index) => (
            <motion.span
              key={`s${index}`}
              className="memories__sparkle"
              style={{ top: spark.top, left: spark.left, fontSize: spark.size }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: [0, 1, 0.15, 1, 0], scale: [0.3, 1, 0.9, 1, 0.4] }}
              transition={{
                duration: spark.duration,
                delay: spark.delay + 1.3,
                repeat: Infinity,
                repeatDelay: 0.9,
                ease: "easeInOut",
              }}
            >
              ✦
            </motion.span>
          ))}
        </span>

        <div className="memories__pair" style={{ color: "black" }}>
          {/* left: holding hands */}
          <motion.figure 
            style={{ color: "black" }}
            className="memories__paper memories__paper--left"
            initial={{ opacity: 0, y: 70, rotate: -10, scale: 0.93 }}
            animate={
              leaving
                ? { opacity: 0.25, y: -14, rotate: -6, scale: 0.9 }
                : { opacity: 1, y: 0, rotate: -2.8, scale: 1 }
            }
            transition={
              leaving
                ? { duration: 0.5, ease: EASE_OUT }
                : { ...springSoft, delay: 0.25 }
            }
          >
            <span className="memories__frame">
              <img
                className="memories__photo"
                src={MEMORIES.hands.image}
                alt={MEMORIES.hands.imageAlt}
                draggable={false}
              />
              <span className="memories__sheen" aria-hidden="true" />
            </span>
            <figcaption className="memories__cap">
              <p className="memories__cap-title">{MEMORIES.hands.title}</p>
              <p className="memories__cap-line">{MEMORIES.hands.line}</p>
            </figcaption>
          </motion.figure>

          {/* right: the birthday gift */}
          <motion.figure
            className="memories__paper memories__paper--right"
            initial={{ opacity: 0, y: 70, rotate: 11, scale: 0.93 }}
            animate={
              leaving
                ? { opacity: 0.25, y: -14, rotate: 7, scale: 0.9 }
                : { opacity: 1, y: 0, rotate: 3.2, scale: 1 }
            }
            transition={
              leaving
                ? { duration: 0.5, ease: EASE_OUT }
                : { ...springSoft, delay: 0.5 }
            }
          >
            <span className="memories__frame">
              <img
                className="memories__photo"
                src={MEMORIES.gift.image}
                alt={MEMORIES.gift.imageAlt}
                draggable={false}
              />
              <span className="memories__sheen" aria-hidden="true" />
            </span>
            <figcaption className="memories__cap">
              <p className="memories__cap-title">{MEMORIES.gift.title}</p>
              <p className="memories__cap-line">{MEMORIES.gift.line}</p>
            </figcaption>
          </motion.figure>
        </div>
      </div>

      <motion.p
        className="memories__shared"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: EASE_OUT, delay: 1.35 }}
      >
        {MEMORIES.shared}
      </motion.p>

      <motion.div
        className="btn-wrap"
        style={{ maxWidth: 360 }}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE_OUT, delay: 1.65 }}
      >
        <motion.button
          type="button"
          className="btn btn--primary"
          onClick={handleKeep}
          disabled={leaving}
          whileHover={leaving ? undefined : { scale: 1.03, y: -2 }}
          whileTap={leaving ? undefined : { scale: 0.97 }}
          transition={springSoft}
        >
          <span className="btn__shine" />
          <span className="btn__label">{MEMORIES.button}</span>
        </motion.button>
        <SparkleRing />
      </motion.div>
    </motion.div>
  );
}

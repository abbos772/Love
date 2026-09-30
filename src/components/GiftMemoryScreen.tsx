import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { MEMORY } from "../data/journey";
import type { SoundApi } from "../hooks/useSound";
import { EASE_OUT, itemVariantsSlow, listVariantsSlow, springSoft } from "../lib/motion";
import { SparkleRing } from "./SparkleRing";
import { WordReveal } from "./WordReveal";

interface GiftMemoryScreenProps {
  sound: SoundApi;
  /** she finished remembering */
  onContinue: () => void;
}

interface HeartSpec {
  top: string;
  left: string;
  size: number;
  delay: number;
  duration: number;
}

/** Small hearts drifting around the photo card. */
const HEARTS: HeartSpec[] = [
  { top: "-5%", left: "4%", size: 16, delay: 0, duration: 3.4 },
  { top: "18%", left: "-6%", size: 12, delay: 0.9, duration: 4.1 },
  { top: "62%", left: "-5%", size: 15, delay: 1.7, duration: 3.7 },
  { top: "104%", left: "16%", size: 11, delay: 0.4, duration: 4.4 },
  { top: "-7%", left: "72%", size: 13, delay: 1.3, duration: 3.9 },
  { top: "30%", left: "103%", size: 17, delay: 0.6, duration: 4.2 },
  { top: "82%", left: "102%", size: 12, delay: 2, duration: 3.6 },
  { top: "99%", left: "80%", size: 10, delay: 1.1, duration: 4.6 },
];

const HEART_COLORS = ["#ff5d8f", "#ff8fab", "#ffb3c9", "#f4cf95", "#e8436f"];

/**
 * The birthday memory: the Mi Buds 6 Play gift and the handwritten card.
 *
 * It is deliberately the most tactile screen in the story — a real photo card
 * that slides in with a slight tilt, breathes with floating hearts, and can be
 * tapped to zoom in for a closer look.
 */
export function GiftMemoryScreen({ sound, onContinue }: GiftMemoryScreenProps) {
  const [zoomed, setZoomed] = useState(false);

  const openZoom = useCallback(() => {
    setZoomed(true);
    sound.engine.pop();
  }, [sound]);

  const closeZoom = useCallback(() => {
    setZoomed(false);
    sound.engine.pop();
  }, [sound]);

  const handleContinue = useCallback(() => {
    sound.engine.swell();
    onContinue();
  }, [onContinue, sound]);

  return (
    <motion.div className="memory" variants={listVariantsSlow}>
      <WordReveal
        as="h2"
        className="display display--md memory__title"
        text={MEMORY.title}
        stagger={0.085}
        delay={0.15}
      />

      <motion.p className="memory__lead" variants={itemVariantsSlow}>
        {MEMORY.lead}
      </motion.p>

      <motion.div className="memory__frame-wrap" variants={itemVariantsSlow}>
        <span className="memory__hearts" aria-hidden="true">
          {HEARTS.map((heart, index) => (
            <motion.span
              key={index}
              className="memory__heart"
              style={{
                top: heart.top,
                left: heart.left,
                color: HEART_COLORS[index % HEART_COLORS.length],
              }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{
                opacity: [0, 0.9, 0.2, 0.9, 0],
                scale: [0.4, 1, 1.12, 1, 0.45],
                y: [8, -10, -20, -30, -42],
              }}
              transition={{
                duration: heart.duration,
                delay: heart.delay,
                repeat: Infinity,
                repeatDelay: 0.3,
                ease: "easeInOut",
              }}
            >
              <Heart size={heart.size} fill="currentColor" strokeWidth={0} />
            </motion.span>
          ))}
        </span>

        <motion.button
          type="button"
          className="memory__card"
          onClick={openZoom}
          initial={{ opacity: 0, y: 46, rotate: -7, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, rotate: -2.2, scale: 1 }}
          transition={{ duration: 1.15, ease: EASE_OUT, delay: 0.3 }}
          whileHover={{ rotate: 0, scale: 1.018, y: -4 }}
          whileTap={{ scale: 0.985, rotate: -1 }}
          aria-label={`${MEMORY.imageAlt}. ${MEMORY.zoomHint}`}
        >
          <span className="memory__photo-frame">
            <img
              className="memory__photo"
              src={MEMORY.image}
              alt={MEMORY.imageAlt}
              draggable={false}
            />
            <span className="memory__photo-sheen" aria-hidden="true" />
          </span>
          <motion.span
            className="memory__caption"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.8, ease: EASE_OUT }}
          >
            {MEMORY.caption}
          </motion.span>
          <span className="memory__zoom-hint">{MEMORY.zoomHint}</span>
        </motion.button>
      </motion.div>

      <motion.div className="memory__lines" variants={itemVariantsSlow}>
        <p className="memory__line">{MEMORY.lines[0]}</p>
        <p className="memory__line memory__line--strong">{MEMORY.lines[1]}</p>
        <p className="memory__thanks">{MEMORY.thanks}</p>
      </motion.div>

      <motion.div className="btn-wrap" variants={itemVariantsSlow} style={{ maxWidth: 380 }}>
        <motion.button
          type="button"
          className="btn btn--primary"
          onClick={handleContinue}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          transition={springSoft}
        >
          <span className="btn__shine" />
          <span className="btn__label">{MEMORY.button}</span>
        </motion.button>
        <SparkleRing />
      </motion.div>

      <AnimatePresence>
        {zoomed && (
          <motion.div
            className="memory-zoom"
            onClick={closeZoom}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            role="button"
            tabIndex={0}
            aria-label="Close photo"
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " " || event.key === "Escape") {
                event.preventDefault();
                closeZoom();
              }
            }}
          >
            <motion.img
              className="memory-zoom__photo"
              src={MEMORY.image}
              alt={MEMORY.imageAlt}
              initial={{ scale: 0.88, opacity: 0, rotate: -2 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={springSoft}
              draggable={false}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

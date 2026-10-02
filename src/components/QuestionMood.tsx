import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, Sparkles, Star } from "lucide-react";

export type QuestionMood = "cozy" | "evening";

interface QuestionMoodProps {
  mood: QuestionMood;
}

interface Mote {
  id: number;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
}

function buildMotes(count: number, minSize: number, maxSize: number): Mote[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: 4 + Math.random() * 92,
    top: 8 + Math.random() * 78,
    size: minSize + Math.random() * (maxSize - minSize),
    delay: Math.random() * 6,
    duration: 7 + Math.random() * 7,
    drift: 24 + Math.random() * 44,
  }));
}

/**
 * A soft atmosphere layered behind a single question's card.
 *
 * "cozy" is the bench moment — warm glow, drifting hearts and gentle sparkles.
 * "evening" is the walk home — cooler dusk light, stars and glowing dust.
 * It is purely decorative and clipped to the card, so it can never cause
 * scrolling or push the layout around.
 */
export function QuestionMoodLayer({ mood }: QuestionMoodProps) {
  const reduceMotion = useReducedMotion();

  const hearts = useMemo(
    () => buildMotes(mood === "cozy" ? 9 : 6, 9, 20),
    [mood],
  );
  const motes = useMemo(
    () => buildMotes(mood === "cozy" ? 14 : 18, 3, 8),
    [mood],
  );
  const stars = useMemo(() => (mood === "evening" ? buildMotes(7, 7, 13) : []), [mood]);

  if (reduceMotion) {
    return (
      <div className={`mood mood--${mood}`} aria-hidden="true">
        <span className="mood__glow" />
      </div>
    );
  }

  return (
    <div className={`mood mood--${mood}`} aria-hidden="true">
      <span className="mood__glow" />

      {hearts.map((mote) => (
        <motion.span
          key={`heart-${mote.id}`}
          className="mood__heart"
          style={{ left: `${mote.left}%`, top: `${mote.top}%` }}
          initial={{ opacity: 0, y: 16, scale: 0.4 }}
          animate={{
            opacity: [0, 0.9, 0],
            y: [0, -(50 + mote.drift), -(96 + mote.drift)],
            scale: [0.4, 1, 0.78],
          }}
          transition={{
            duration: mote.duration,
            delay: mote.delay,
            repeat: Infinity,
            ease: "easeInOut",
            times: [0, 0.35, 1],
          }}
        >
          <Heart size={mote.size} fill="currentColor" strokeWidth={0} />
        </motion.span>
      ))}

      {motes.map((mote) => (
        <motion.span
          key={`mote-${mote.id}`}
          className="mood__mote"
          style={{
            left: `${mote.left}%`,
            top: `${mote.top}%`,
            width: mote.size,
            height: mote.size,
          }}
          animate={{ opacity: [0, 0.75, 0], scale: [0.6, 1.2, 0.7] }}
          transition={{
            duration: mote.duration * 0.7,
            delay: mote.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {stars.map((mote) => (
        <motion.span
          key={`star-${mote.id}`}
          className="mood__star"
          style={{ left: `${mote.left}%`, top: `${mote.top}%` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.85, 0.2, 0.7, 0] }}
          transition={{
            duration: mote.duration,
            delay: mote.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Star size={mote.size} fill="currentColor" strokeWidth={0} />
        </motion.span>
      ))}

      {mood === "cozy" && (
        <motion.span
          className="mood__sparkle"
          animate={{ opacity: [0, 0.9, 0], rotate: [0, 24, -18, 0], scale: [0.7, 1.1, 0.8] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles size={26} fill="none" strokeWidth={1.4} />
        </motion.span>
      )}
    </div>
  );
}

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { EASE_OUT } from "../lib/motion";
import type { FxApi } from "../hooks/useFx";
import { GlowingHeart } from "./GlowingHeart";

interface CelebrationProps {
  fx: FxApi;
  onFinished: () => void;
}

const HEART_FINISH = 4400;
const RING_DELAYS = [0, 0.7, 1.4];
/**
 * When the fireworks fire. The very first salvo already went off the moment she
 * said yes, so this picks it straight back up and keeps the sky alive until the
 * finale takes over.
 */
const FIREWORK_DELAYS = [
  160, 320, 500, 660, 840, 1020, 1220, 1440, 1680, 1940, 2220, 2520, 2840, 3180,
];

/**
 * The payoff: confetti, hearts and fireworks around an oversized glowing heart.
 * It runs on its own timeline and hands control to the finale when it's done.
 */
export function Celebration({ fx, onFinished }: CelebrationProps) {
  const heartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers: number[] = [];

    // NOTE: the particles are deliberately left alone here so the fireworks
    // fired the moment she said yes keep playing through the hand-off.
    fx.confetti(150);

    timers.push(
      window.setTimeout(() => fx.burstFrom(heartRef.current, "heart", 34), 420),
    );
    timers.push(
      window.setTimeout(() => fx.burstFrom(heartRef.current, "spark", 28), 900),
    );

    FIREWORK_DELAYS.forEach((delay) => {
      timers.push(
        window.setTimeout(() => {
          const point = fx.randomPoint();
          fx.firework(point.x, point.y);
          // a second shell now and then so it reads as a volley
          if (Math.random() > 0.55) {
            const second = fx.randomPoint();
            fx.firework(second.x, second.y);
          }
        }, delay),
      );
    });

    timers.push(window.setTimeout(() => fx.confetti(90), 1700));
    timers.push(window.setTimeout(() => fx.burstFrom(heartRef.current, "heart", 30), 2400));
    timers.push(window.setTimeout(onFinished, HEART_FINISH));

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      fx.clearBursts();
    };
  }, [fx, onFinished]);

  return (
    <motion.div
      className="celebration"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: EASE_OUT }}
      role="status"
      aria-live="polite"
    >
      <div className="celebration__inner">
        <div className="celebration__stage">
          <div className="celebration__heart-wrap" ref={heartRef}>
            {RING_DELAYS.map((delay) => (
              <motion.span
                key={delay}
                className="ring"
                initial={{ opacity: 0.65, scale: 0.7 }}
                animate={{ opacity: 0, scale: 2.1 }}
                transition={{
                  duration: 2.6,
                  delay,
                  repeat: Infinity,
                  repeatDelay: 0.4,
                  ease: "easeOut",
                }}
              />
            ))}
            <motion.div
              initial={{ scale: 0.15, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.12, type: "spring", stiffness: 110, damping: 13 }}
            >
              <GlowingHeart mega />
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

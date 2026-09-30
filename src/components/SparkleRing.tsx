import { motion } from "framer-motion";
import { Sparkle } from "lucide-react";

interface SparkleSpec {
  top: string;
  left: string;
  size: number;
  delay: number;
  duration: number;
}

const SPARKLES: SparkleSpec[] = [
  { top: "-9px", left: "6%", size: 14, delay: 0, duration: 2.4 },
  { top: "60%", left: "-8px", size: 11, delay: 0.7, duration: 2.1 },
  { top: "104%", left: "22%", size: 9, delay: 1.5, duration: 2.7 },
  { top: "-12px", left: "78%", size: 12, delay: 0.35, duration: 2.3 },
  { top: "34%", left: "103%", size: 15, delay: 1.1, duration: 2.6 },
  { top: "98%", left: "88%", size: 10, delay: 1.9, duration: 2.2 },
];

/** Tiny sparkles that twinkle around the most important button on screen. */
export function SparkleRing() {
  return (
    <span aria-hidden="true">
      {SPARKLES.map((sparkle, index) => (
        <motion.span
          key={index}
          className="spark"
          style={{ top: sparkle.top, left: sparkle.left }}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{
            opacity: [0, 0.95, 0],
            scale: [0.35, 1, 0.35],
            rotate: [0, 90, 180],
          }}
          transition={{
            duration: sparkle.duration,
            delay: sparkle.delay,
            repeat: Infinity,
            repeatDelay: 0.6,
            ease: "easeInOut",
          }}
        >
          <Sparkle size={sparkle.size} fill="currentColor" />
        </motion.span>
      ))}
    </span>
  );
}

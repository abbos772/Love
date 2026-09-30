import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { EASE_OUT, itemVariants } from "../lib/motion";

interface ProgressBarProps {
  /** 1-based position of the current question */
  current: number;
  total: number;
}

/** "Question 3 of 5 ❤️" with a glowing, smoothly animated fill. */
export function ProgressBar({ current, total }: ProgressBarProps) {
  const percent = Math.round((current / total) * 100);

  return (
    <motion.div
      className="progress"
      variants={itemVariants}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={`Question ${current} of ${total}`}
    >
      <div className="progress__meta">
        <span className="progress__label">
          Question {current} of {total}{" "}
          <Heart
            size={11}
            fill="currentColor"
            strokeWidth={0}
            style={{ color: "var(--rose-500)", verticalAlign: "-1px" }}
          />
        </span>
        <div className="progress__dots" aria-hidden="true">
          {Array.from({ length: total }, (_, index) => (
            <motion.span
              key={index}
              className={
                index < current ? "progress__dot progress__dot--on" : "progress__dot"
              }
              animate={{ scale: index < current ? 1.15 : 1 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
            />
          ))}
        </div>
      </div>

      <div className="progress__track">
        <motion.span
          className="progress__fill"
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
        />
      </div>
    </motion.div>
  );
}

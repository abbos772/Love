import { useRef } from "react";
import { motion } from "framer-motion";
import { itemVariants, springSnappy } from "../lib/motion";
import type { Choice } from "../data/journey";
import { SparkleRing } from "./SparkleRing";

interface ChoiceButtonProps {
  choice: Choice;
  /** true while the reaction is playing */
  locked: boolean;
  /** true once this choice has been picked */
  chosen: boolean;
  /** true when another choice was picked */
  dimmed: boolean;
  showSparkles?: boolean;
  onSelect: (element: HTMLButtonElement | null, choice: Choice) => void;
}

/**
 * A single answer button: hover lift, tap press, shine sweep and sparkles.
 *
 * The sparkles live in the wrapper rather than the button itself — `.btn` clips
 * its contents for the shine sweep, which would swallow them.
 */
export function ChoiceButton({
  choice,
  locked,
  chosen,
  dimmed,
  showSparkles = false,
  onSelect,
}: ChoiceButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  const classes = [
    "btn",
    `btn--${choice.variant}`,
    dimmed ? "btn--dim" : "",
    chosen ? "btn--chosen" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <motion.div className="btn-wrap" variants={itemVariants}>
      <motion.button
        ref={ref}
        type="button"
        className={classes}
        disabled={locked}
        onClick={() => onSelect(ref.current, choice)}
        whileHover={locked ? undefined : { scale: 1.028, y: -2 }}
        whileTap={locked ? undefined : { scale: 0.972 }}
        transition={springSnappy}
        aria-label={`${choice.label} ${choice.emoji}`}
      >
        <span className="btn__shine" />
        <span className="btn__label">
          {choice.label}
          <span className="btn__emoji" aria-hidden="true">
            {choice.emoji}
          </span>
        </span>
      </motion.button>
      {showSparkles && <SparkleRing />}
    </motion.div>
  );
}

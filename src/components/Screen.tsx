import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cinematicVariants, screenVariants } from "../lib/motion";

interface ScreenProps {
  children: ReactNode;
  /** Use the slower, heavier transition for the emotional beats. */
  cinematic?: boolean;
  className?: string;
}

/** Wraps every scene so enter/exit choreography lives in exactly one place. */
export function Screen({ children, cinematic = false, className }: ScreenProps) {
  return (
    <motion.div
      className={className ? `screen ${className}` : "screen"}
      variants={cinematic ? cinematicVariants : screenVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

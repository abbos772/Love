import { useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import type { SoundApi } from "../hooks/useSound";
import { itemVariantsSlow, listVariantsSlow } from "../lib/motion";

interface RomanticMessageScreenProps {
  text: string;
  sound: SoundApi;
  onDone: () => void;
}

/** How long the note lingers before the story continues on its own. */
const HOLD = 3800;

/**
 * A quiet moment between scenes. It advances by itself so it never feels like a
 * chore, but a tap skips it for anyone who is ready to move on.
 */
export function RomanticMessageScreen({
  text,
  sound,
  onDone,
}: RomanticMessageScreenProps) {
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    sound.engine.whoosh();
    onDone();
  }, [onDone, sound]);

  useEffect(() => {
    const id = window.setTimeout(finish, HOLD);
    return () => window.clearTimeout(id);
  }, [finish]);

  return (
    <motion.div
      className="message-screen"
      onClick={finish}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          finish();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Continue"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div className="message-screen__inner" variants={listVariantsSlow}>
        <motion.span className="message-screen__mark" variants={itemVariantsSlow}>
          <motion.span
            animate={{ scale: [1, 1.18, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ display: "inline-flex" }}
          >
            <Heart size={20} fill="currentColor" strokeWidth={0} />
          </motion.span>
        </motion.span>

        <motion.div variants={itemVariantsSlow}>
          <p className="message-screen__line">{text}</p>
        </motion.div>

        <motion.span className="hint message-screen__skip" variants={itemVariantsSlow}>
          tap to continue
        </motion.span>
      </motion.div>
    </motion.div>
  );
}

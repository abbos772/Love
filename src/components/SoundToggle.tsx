import { motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { springSnappy } from "../lib/motion";

interface SoundToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

/** Sound is opt-in, so the toggle is always visible and never noisy. */
export function SoundToggle({ enabled, onToggle }: SoundToggleProps) {
  return (
    <motion.button
      type="button"
      className={enabled ? "sound-toggle sound-toggle--on" : "sound-toggle"}
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={enabled ? "Turn sound off" : "Turn sound on"}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.span
        key={enabled ? "on" : "off"}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={springSnappy}
        style={{ display: "inline-flex" }}
      >
        {enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
      </motion.span>
      <span className="sound-toggle__label">
        {enabled ? "Sound on" : "Sound off"}
      </span>
    </motion.button>
  );
}

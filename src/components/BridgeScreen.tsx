import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { BRIDGE } from "../data/journey";
import type { SoundApi } from "../hooks/useSound";
import { EASE_OUT, itemVariantsSlow, listVariantsSlow } from "../lib/motion";
import { SparkleRing } from "./SparkleRing";
import { WordReveal } from "./WordReveal";

interface BridgeScreenProps {
  sound: SoundApi;
  onContinue: () => void;
}

/**
 * Screen 7 — the slowdown.
 *
 * Everything here is deliberately slower: a longer stagger, a softer reveal and
 * a single, unhurried button.
 */
export function BridgeScreen({ sound, onContinue }: BridgeScreenProps) {
  const handleContinue = (): void => {
    sound.engine.swell();
    onContinue();
  };

  return (
    <motion.div className="bridge" variants={listVariantsSlow}>
      <motion.span className="eyebrow" variants={itemVariantsSlow}>
        {BRIDGE.eyebrow}
      </motion.span>

      <motion.span className="ornament" variants={itemVariantsSlow} aria-hidden="true">
        <Heart size={14} fill="currentColor" strokeWidth={0} />
      </motion.span>

      <motion.p className="bridge__line" variants={itemVariantsSlow}>
        {BRIDGE.lines[0]}
      </motion.p>

      <WordReveal
        as="h2"
        className="display display--lg"
        text={BRIDGE.lines[1]}
        stagger={0.12}
        delay={0.5}
      />

      <motion.div className="btn-wrap" variants={itemVariantsSlow} style={{ maxWidth: 340 }}>
        <motion.button
          type="button"
          className="btn btn--primary"
          onClick={handleContinue}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
        >
          <span className="btn__shine" />
          <span className="btn__label">{BRIDGE.button}</span>
        </motion.button>
        <SparkleRing />
      </motion.div>
    </motion.div>
  );
}

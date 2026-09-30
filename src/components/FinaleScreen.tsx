import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { FINALE } from "../data/journey";
import type { FxApi } from "../hooks/useFx";
import type { SoundApi } from "../hooks/useSound";
import { itemVariantsSlow, listVariantsSlow, springSoft } from "../lib/motion";
import { GlowingHeart } from "./GlowingHeart";
import { SparkleRing } from "./SparkleRing";
import { WordReveal } from "./WordReveal";

interface FinaleScreenProps {
  sound: SoundApi;
  fx: FxApi;
  onReplay: () => void;
}

/** The closing screen: a soft echo of the celebration and an easy way back. */
export function FinaleScreen({ sound, fx, onReplay }: FinaleScreenProps) {
  const heartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers: number[] = [
      window.setTimeout(() => fx.burstFrom(heartRef.current, "heart", 20), 260),
      window.setTimeout(() => fx.confetti(50), 500),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [fx]);

  const handleReplay = (): void => {
    sound.engine.whoosh();
    fx.clearBursts();
    onReplay();
  };

  return (
    <motion.div className="card card--celebrate" variants={listVariantsSlow}>
      <motion.div className="finale" variants={itemVariantsSlow}>
        <motion.div ref={heartRef} variants={itemVariantsSlow}>
          <GlowingHeart pulse />
        </motion.div>

        <WordReveal
          as="h1"
          className="display display--lg"
          text={FINALE.title}
          stagger={0.1}
          delay={0.2}
        />

        <motion.span className="ornament" variants={itemVariantsSlow} aria-hidden="true">
          <Heart size={14} fill="currentColor" strokeWidth={0} />
        </motion.span>

        <motion.p className="quote quote--gold" variants={itemVariantsSlow}>
          {FINALE.subtitle}
        </motion.p>

        <motion.div className="btn-wrap" style={{ maxWidth: 360 }} variants={itemVariantsSlow}>
          <motion.button
            type="button"
            className="btn btn--primary"
            onClick={handleReplay}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={springSoft}
          >
            <span className="btn__shine" />
            <span className="btn__label">{FINALE.replay}</span>
          </motion.button>
          <SparkleRing />
        </motion.div>

        <motion.p className="hint" variants={itemVariantsSlow}>
          {FINALE.note}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

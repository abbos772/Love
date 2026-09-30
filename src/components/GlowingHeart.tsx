import { useId } from "react";
import { motion } from "framer-motion";

interface GlowingHeartProps {
  /** the biggest version, used for the celebration */
  mega?: boolean;
  pulse?: boolean;
}

const HEART_PATH =
  "M23.6 0C19.6 0 16.7 2.1 16 5.1 15.3 2.1 12.4 0 8.4 0 3.8 0 0 3.8 0 8.5c0 9.4 16 21.1 16 21.1s16-11.7 16-21.1C32 3.8 28.2 0 23.6 0z";

/** The centrepiece heart: gradient fill, sheen, pulsing halo and light rays. */
export function GlowingHeart({ mega = false, pulse = true }: GlowingHeartProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const gradientId = `heart-gradient-${id}`;
  const sheenId = `heart-sheen-${id}`;

  return (
    <div
      className={mega ? "heart-stage heart-stage--mega" : "heart-stage"}
      aria-hidden="true"
    >
      <div className="heart-stage__rays" />
      <div className="heart-stage__halo" />
      <motion.svg
        className="heart-stage__svg"
        viewBox="0 0 32 29.6"
        initial={false}
        animate={pulse ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={
          pulse
            ? { duration: 2.9, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.3 }
        }
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="#ffa8c2" />
            <stop offset="42%" stopColor="#ff2d6a" />
            <stop offset="100%" stopColor="#96062f" />
          </linearGradient>
          <radialGradient id={sheenId} cx="0.3" cy="0.24" r="0.6">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="52%" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={HEART_PATH} fill={`url(#${gradientId})`} />
        <path d={HEART_PATH} fill={`url(#${sheenId})`} />
      </motion.svg>
    </div>
  );
}

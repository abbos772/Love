import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { Heart } from "lucide-react";

interface HeartSpec {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  sway: number;
  opacity: number;
  color: string;
}

const COLORS = ["#ff5d8f", "#ff8fab", "#ffb3c9", "#e8436f", "#ffd6e2"];
const COUNT = 16;

function buildHearts(): HeartSpec[] {
  return Array.from({ length: COUNT }, (_, index) => {
    const size = 10 + Math.random() * 26;
    return {
      id: index,
      left: Math.random() * 96,
      size,
      duration: 17 + Math.random() * 16,
      delay: -Math.random() * 26,
      sway: 20 + Math.random() * 60,
      opacity: 0.14 + Math.random() * 0.36,
      color: COLORS[index % COLORS.length],
    };
  });
}

/** Gentle hearts drifting up behind the card, adding depth to the scene. */
export function FloatingHearts() {
  const reduceMotion = useReducedMotion();
  const hearts = useMemo(buildHearts, []);

  if (reduceMotion) return null;

  return (
    <div className="hearts" aria-hidden="true">
      {hearts.map((heart) => (
        <span
          key={heart.id}
          className="hearts__item"
          style={{
            left: `${heart.left}%`,
            width: `${heart.size}px`,
            height: `${heart.size}px`,
            color: heart.color,
            animationDuration: `${heart.duration}s`,
            animationDelay: `${heart.delay}s`,
            ["--sway" as string]: `${heart.sway}px`,
            ["--peak-opacity" as string]: heart.opacity,
          }}
        >
          <Heart size={heart.size} fill="currentColor" strokeWidth={0} />
        </span>
      ))}
    </div>
  );
}

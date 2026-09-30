import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SoundApi } from "../hooks/useSound";

interface Point {
  x: number;
  y: number;
}

interface DodgingButtonProps {
  label: string;
  emoji: string;
  caughtLabel: string;
  /** how many times it slips away before giving up */
  maxDodges: number;
  sound: SoundApi;
  /** fired the moment the button stops running */
  onCaught: () => void;
  /** fired when she taps the (now honest) button after it gave up */
  onContinue: (element: HTMLButtonElement | null) => void;
}

const PAD = 6;
const FALLBACK_HEIGHT = 58;
/** fraction of the arena the button shrinks to so it has room to run */
const RUN_WIDTH_RATIO = 0.7;
const MIN_THROTTLE = 300;
/** keep the taunt on screen for a beat before it can be tapped */
const REVEAL_HOLD = 650;

const dodgeSpring = { type: "spring" as const, stiffness: 420, damping: 24, mass: 0.6 };

/**
 * The "no" button that playfully slips away.
 *
 * It measures its own arena and only ever jumps to positions fully inside it, so
 * it never escapes the card. After `maxDodges` escapes it gives up, the taunt is
 * shown and it returns to a calm, tappable state.
 */
export function DodgingButton({
  label,
  emoji,
  caughtLabel,
  maxDodges,
  sound,
  onCaught,
  onContinue,
}: DodgingButtonProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const lastAttempt = useRef(0);
  const caughtAt = useRef(0);
  const posRef = useRef<Point>({ x: 0, y: 0 });

  const [arena, setArena] = useState({ w: 0, h: 0 });
  const [buttonHeight, setButtonHeight] = useState(FALLBACK_HEIGHT);
  const [pos, setPos] = useState<Point | null>(null);
  const [running, setRunning] = useState(false);
  const [dodges, setDodges] = useState(0);
  const [caught, setCaught] = useState(false);

  const measure = useCallback(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const width = slot.clientWidth;
    const height = slot.clientHeight;
    const btn = buttonRef.current;
    setArena((prev) =>
      prev.w === width && prev.h === height ? prev : { w: width, h: height },
    );
    if (btn) {
      const h = btn.offsetHeight || FALLBACK_HEIGHT;
      setButtonHeight((prev) => (prev === h ? prev : h));
    }
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const slot = slotRef.current;
    if (!slot) return;
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    return () => observer.disconnect();
  }, [measure]);

  const restY = Math.max(PAD, arena.h - buttonHeight - PAD);
  const runWidth = Math.max(120, arena.w * RUN_WIDTH_RATIO);
  const maxX = Math.max(PAD, arena.w - runWidth - PAD);
  const maxY = restY;

  const target = caught || !pos ? { x: 0, y: restY } : pos;

  const pickSpot = useCallback((): Point => {
    const spanX = Math.max(0, maxX - PAD);
    const spanY = Math.max(0, maxY - PAD);
    let best: Point = { x: PAD, y: PAD };
    let bestDistance = -1;

    for (let i = 0; i < 10; i += 1) {
      const candidate = {
        x: PAD + Math.random() * spanX,
        y: PAD + Math.random() * spanY,
      };
      const distance = Math.hypot(
        candidate.x - posRef.current.x,
        candidate.y - posRef.current.y,
      );
      if (distance > bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }

    // Always move a meaningful distance so the dodge reads as a dodge.
    const minimum = Math.min(90, Math.max(maxX, maxY) * 0.55);
    if (bestDistance < minimum) {
      best = {
        x: posRef.current.x > (PAD + maxX) / 2 ? PAD : maxX,
        y: posRef.current.y > (PAD + maxY) / 2 ? PAD : maxY,
      };
    }
    return best;
  }, [maxX, maxY]);

  const attempt = useCallback((): void => {
    if (caught) return;

    const now = performance.now();
    if (now - lastAttempt.current < MIN_THROTTLE) return;
    lastAttempt.current = now;

    if (dodges < maxDodges) {
      const next = pickSpot();
      posRef.current = next;
      setPos(next);
      setRunning(true);
      setDodges((count) => count + 1);
      sound.engine.pop();
      return;
    }

    // Out of escapes: stop moving and come clean.
    setCaught(true);
    setRunning(false);
    caughtAt.current = now;
    posRef.current = { x: 0, y: restY };
    setPos(null);
    sound.engine.chime();
    onCaught();
  }, [caught, dodges, maxDodges, onCaught, pickSpot, restY, sound]);

  const handlePointerDown = useCallback(() => {
    if (caught) return;
    attempt();
  }, [attempt, caught]);

  const handleClick = useCallback(() => {
    if (!caught) {
      attempt();
      return;
    }
    if (performance.now() - caughtAt.current < REVEAL_HOLD) return;
    onContinue(buttonRef.current);
  }, [attempt, caught, onContinue]);

  return (
    <div className="dodge-slot" ref={slotRef}>
      {arena.w > 0 && (
        <motion.button
          ref={buttonRef}
          type="button"
          className={caught ? "btn btn--ghost dodge-btn dodge-btn--caught" : "btn btn--ghost dodge-btn"}
          initial={false}
          animate={{
            x: target.x,
            y: target.y,
            width: caught || !running ? arena.w : runWidth,
          }}
          transition={dodgeSpring}
          onPointerEnter={attempt}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
          whileTap={caught ? { scale: 0.96 } : undefined}
          onAnimationComplete={measure}
          aria-label={`${caught ? caughtLabel : label} ${caught ? "😌" : emoji}`}
        >
          <span className="btn__shine" />
          <span className="btn__label">
            {caught ? caughtLabel : label}
            <span className="btn__emoji" aria-hidden="true">
              {caught ? "😌" : emoji}
            </span>
          </span>
        </motion.button>
      )}
    </div>
  );
}

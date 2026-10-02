import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { motion } from "framer-motion";
import { START } from "../data/journey";
import type { FxApi } from "../hooks/useFx";
import type { SoundApi } from "../hooks/useSound";
import { EASE_IN, EASE_OUT, springSoft } from "../lib/motion";
import { SparkleRing } from "./SparkleRing";

interface StartScreenProps {
  fx: FxApi;
  sound: SoundApi;
  /** called once the postcard has finished opening, to hand over to the story */
  onOpen: () => void;
}

interface Flight {
  x: number;
  y: number;
  size: number;
  delay: number;
  rotate: number;
}

/** Hearts that burst out of the postcard while it opens. */
const FLIGHTS: Flight[] = [
  { x: -148, y: -166, size: 30, delay: 0.34, rotate: -34 },
  { x: 138, y: -150, size: 24, delay: 0.42, rotate: 28 },
  { x: -96, y: -232, size: 20, delay: 0.5, rotate: -16 },
  { x: 104, y: -238, size: 27, delay: 0.56, rotate: 20 },
  { x: -176, y: -74, size: 18, delay: 0.62, rotate: -46 },
  { x: 172, y: -66, size: 22, delay: 0.68, rotate: 42 },
  { x: -42, y: -286, size: 16, delay: 0.74, rotate: -8 },
  { x: 52, y: -276, size: 19, delay: 0.8, rotate: 12 },
];

/** When the particle bursts fire relative to the click. */
const HEART_BURST = 430;
const SPARK_BURST = 1050;
/** How long the whole cinematic opening lasts before the story takes over. */
const LEAVE_AT = 2300;
/** An impatient second tap skips ahead — but only once it is mostly open. */
const SKIP_AFTER = 800;

/**
 * Screen 0 — the sealed postcard.
 *
 * Nothing changes scene until the postcard has finished opening: the flap swings
 * back in 3D, a bloom of light washes over the paper and hearts fly out, so the
 * hand-off into the story feels like opening a real letter.
 */
export function StartScreen({ fx, sound, onOpen }: StartScreenProps) {
  const [opening, setOpening] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const teddyRef = useRef<HTMLButtonElement>(null);
  const startedAt = useRef(0);
  const left = useRef(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const later = useCallback((fn: () => void, delay: number) => {
    timers.current.push(window.setTimeout(fn, delay));
  }, []);

  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    clearTimers();
    sound.engine.whoosh();
    onOpen();
  }, [clearTimers, onOpen, sound]);

  /** Opens the postcard — or jumps ahead if she taps it a second time. */
  const open = useCallback(() => {
    if (startedAt.current === 0) {
      startedAt.current = performance.now();
      setOpening(true);
      sound.engine.pop();
      sound.engine.whoosh();

      later(() => {
        fx.burstFrom(cardRef.current, "heart", 14);
        fx.burstFrom(teddyRef.current, "spark", 8);
        sound.engine.chime();
      }, HEART_BURST);
      later(() => fx.burstFrom(cardRef.current, "spark", 12), SPARK_BURST);
      later(leave, LEAVE_AT);
      return;
    }

    if (performance.now() - startedAt.current > SKIP_AFTER) leave();
  }, [fx, later, leave, sound]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    },
    [open],
  );

  return (
    <motion.div
      className="start"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.7, ease: EASE_OUT } }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.55, ease: EASE_IN } }}
    >
      <span className="start__halo" aria-hidden="true" />

      <div className="start__holder">
        <span className="start__sparkles" aria-hidden="true">
          <SparkleRing />
        </span>

        <motion.div
          ref={cardRef}
          className={opening ? "postcard postcard--opening" : "postcard"}
          role="button"
          tabIndex={0}
          aria-label={`${START.title} ${START.subtitle} ${START.open}`}
          onClick={open}
          onKeyDown={handleKeyDown}
          style={{ transformStyle: "preserve-3d" }}
          initial={{ opacity: 0, y: 44, rotateX: 18, rotateY: -26, scale: 0.88 }}
          animate={
            opening
              ? {
                  opacity: 1,
                  y: 30,
                  rotateX: 2,
                  rotateY: -3,
                  scale: 0.9,
                  transition: { duration: 1.2, ease: EASE_OUT },
                }
              : {
                  opacity: 1,
                  y: 0,
                  rotateX: 6,
                  rotateY: -10,
                  scale: 1,
                  transition: { duration: 1.15, ease: EASE_OUT },
                }
          }
          whileHover={
            opening
              ? undefined
              : { scale: 1.035, rotateY: -5, rotateX: 3, transition: springSoft }
          }
          whileTap={opening ? undefined : { scale: 0.985 }}
        >
          {/* what is hidden inside the envelope */}
          <div className="postcard__paper">
            <div className="postcard__inside">
              <motion.span
                className="postcard__seal"
                aria-hidden="true"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={
                  opening
                    ? { scale: 1, opacity: 1, transition: { delay: 0.75, ...springSoft } }
                    : { scale: 1, opacity: 1, transition: { delay: 0.9, duration: 0.8 } }
                }
              >
                {START.seal}
              </motion.span>

              <motion.p
                className="postcard__inside-title"
                initial={{ opacity: 0, y: 12 }}
                animate={
                  opening
                    ? { opacity: 1, y: 0, transition: { delay: 0.9, duration: 0.7, ease: EASE_OUT } }
                    : { opacity: 1, y: 0, transition: { delay: 1.05, duration: 0.7, ease: EASE_OUT } }
                }
              >
                {START.insideTitle}
              </motion.p>

              <motion.p
                className="postcard__inside-line"
                initial={{ opacity: 0, y: 12 }}
                animate={
                  opening
                    ? { opacity: 1, y: 0, transition: { delay: 1.05, duration: 0.7, ease: EASE_OUT } }
                    : { opacity: 1, y: 0, transition: { delay: 1.2, duration: 0.7, ease: EASE_OUT } }
                }
              >
                {START.insideLine}
              </motion.p>
            </div>
          </div>

          {/* the front of the postcard — swings open from its top edge */}
          <motion.div
            className="postcard__flap"
            initial={false}
            animate={{ rotateX: opening ? -144 : 0 }}
            transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className={
                opening ? "postcard__face postcard__face--front is-open" : "postcard__face postcard__face--front"
              }
            >
              <span className="postcard__stamp" aria-hidden="true">
                💌
              </span>
              <span className="postcard__postmark" aria-hidden="true">
                with
                <br />
                love
              </span>

              <div className="postcard__front">
                <span className="postcard__eyebrow">a little something for you</span>
                <h1 className="postcard__title">{START.title}</h1>
                <p className="postcard__subtitle">{START.subtitle}</p>
                <span className="postcard__cta" aria-hidden="true">
                  {START.open}
                </span>
              </div>

              <span className="postcard__sheen" aria-hidden="true" />
            </div>

            {/* underside of the flap */}
            <div className="postcard__face postcard__face--back" aria-hidden="true">
              <span className="postcard__back-mark">❤️</span>
            </div>
          </motion.div>

          {/* the light that blooms out of the letter */}
          <span className="postcard__bloom" aria-hidden="true" />
        </motion.div>

        <motion.button
          ref={teddyRef}
          type="button"
          className="start__teddy"
          onClick={open}
          aria-label="Open the postcard"
          initial={{ opacity: 0, y: 30, scale: 0.5, rotate: -22 }}
          animate={
            opening
              ? { opacity: 1, y: -14, scale: 1.06, rotate: 0, transition: { delay: 0.3, ...springSoft } }
              : {
                  opacity: 1,
                  y: [0, -9, 0],
                  scale: 1,
                  rotate: [-7, 7, -7],
                  transition: {
                    opacity: { duration: 0.7, delay: 0.55 },
                    y: { duration: 3.1, delay: 0.6, repeat: Infinity, ease: "easeInOut" },
                    rotate: { duration: 3.1, delay: 0.6, repeat: Infinity, ease: "easeInOut" },
                    scale: { duration: 0.7, delay: 0.55 },
                  },
                }
          }
          whileHover={{ scale: 1.14, rotate: -8, transition: springSoft }}
          whileTap={{ scale: 0.92 }}
        >
          <span className="start__teddy-face" aria-hidden="true">
            🧸
          </span>
        </motion.button>

        {/* hearts flying out of the opened letter */}
        {opening &&
          FLIGHTS.map((flight, index) => (
            <motion.span
              key={index}
              className="start__flight"
              aria-hidden="true"
              style={{ fontSize: flight.size }}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.3, rotate: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.3, 1.15, 1, 0.75],
                x: flight.x,
                y: flight.y,
                rotate: flight.rotate,
              }}
              transition={{
                duration: 1.7,
                delay: flight.delay,
                ease: EASE_OUT,
                opacity: {
                  duration: 1.7,
                  delay: flight.delay,
                  ease: EASE_OUT,
                  times: [0, 0.18, 0.66, 1],
                },
                scale: {
                  duration: 1.7,
                  delay: flight.delay,
                  ease: EASE_OUT,
                  times: [0, 0.18, 0.66, 1],
                },
              }}
            >
              ❤️
            </motion.span>
          ))}
      </div>

      <motion.p
        className="start__hint"
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: opening ? 0 : 1,
          y: opening ? 8 : 0,
          transition: { duration: 0.6, delay: opening ? 0 : 1.1, ease: EASE_OUT },
        }}
      >
        {START.hint}
      </motion.p>
    </motion.div>
  );
}

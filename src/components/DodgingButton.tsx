import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { motion } from "framer-motion";
import type { Transition } from "framer-motion";
import type { SoundApi } from "../hooks/useSound";
import { EASE_OUT } from "../lib/motion";

interface Point {
  x: number;
  y: number;
}

interface DodgingButtonProps {
  label: string;
  emoji: string;
  /** funny line shown after every escape, in order */
  taunts: string[];
  sound: SoundApi;
  /** set while the card is locked or the modal is open, to stop it running */
  disabled?: boolean;
  /** fired on every escape with the attempt number (1-based) and its line */
  onDodge: (attempt: number, taunt: string) => void;
  /**
   * fired when she actually manages to click NO. There is still no "no"
   * answer here — the click just opens the "Why no? 🥺" modal.
   */
  onCatch?: () => void;
}

const FALLBACK_HEIGHT = 58;
const MIN_BUTTON_WIDTH = 150;
const MAX_BUTTON_WIDTH = 250;
/** the button always keeps this much room from every edge of the screen */
const EDGE = 16;

/**
 * How close the pointer has to get before it bothers to move at all. Inside
 * this ring it dodges; outside it is completely still — a mouse parked across
 * the screen does nothing, and neither does unrelated movement.
 */
const PROXIMITY_MOUSE = 92;
const PROXIMITY_TOUCH = 100;

/** A moderate hop: a nudge away, never a trip across the whole screen. */
const MIN_HOP = 100;
const MAX_HOP = 220;

/**
 * After a hop it holds still for a moment, so a quick hand can follow up and
 * actually catch it. This is what keeps NO a real, clickable possibility.
 */
const CATCH_WINDOW = 520;

/** Deliberately subtle — no exaggerated movement. */
const MAX_TILT = 7;
const SMALL_SCALE = 1.035;

/** quick, springy, with just enough overshoot to feel playful */
const SPRING_HOP: Transition = {
  type: "spring",
  stiffness: 780,
  damping: 30,
  mass: 0.6,
};
const SPRING_PLAYFUL: Transition = {
  type: "spring",
  stiffness: 620,
  damping: 21,
  mass: 0.72,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** distance from a point to a rectangle (0 when the point is inside it) */
const distanceToRect = (x: number, y: number, rect: DOMRect): number => {
  const dx = Math.max(rect.left - x, 0, x - rect.right);
  const dy = Math.max(rect.top - y, 0, y - rect.bottom);
  return Math.hypot(dx, dy);
};

/** distance from a point to a rectangle described by numbers */
const distanceToBox = (
  x: number,
  y: number,
  left: number,
  top: number,
  width: number,
  height: number,
): number => {
  const dx = Math.max(left - x, 0, x - (left + width));
  const dy = Math.max(top - y, 0, y - (top + height));
  return Math.hypot(dx, dy);
};

/**
 * The safe box it may land in: the visible viewport, minus an edge margin big
 * enough to keep the entire button on screen (so it can never end up half
 * off-screen and unreachable).
 */
const getBounds = (width: number, height: number) => {
  const vw = window.innerWidth || 360;
  const vh = window.innerHeight || 640;
  const minX = EDGE;
  const maxX = Math.max(minX, vw - width - EDGE);
  const minY = EDGE;
  const maxY = Math.max(minY, vh - height - EDGE);
  return { minX, maxX, minY, maxY };
};

/**
 * The "no" button that dodges — but only when you are actually close.
 *
 * It sits perfectly still until the pointer comes within ~70–100px. Then it
 * hops a short, moderate distance in a new direction and settles again, with a
 * small tilt and squash so it feels playful rather than frantic. As soon as the
 * pointer backs off it stops moving, and while it is close enough to touch it
 * never runs — so catching it and clicking it is always a real possibility.
 *
 * Once it has moved it renders `position: fixed` in a portal on `document.body`,
 * so the card's `overflow: hidden` cannot clip a hop that reaches past it.
 *
 * A successful click is not a "no" answer: it just calls `onCatch`, which opens
 * the "Why no? 🥺" modal.
 */
export function DodgingButton({
  label,
  emoji,
  taunts,
  sound,
  disabled = false,
  onDodge,
  onCatch,
}: DodgingButtonProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const posRef = useRef<Point | null>(null);
  const fixedRef = useRef(false);
  const lastHop = useRef(0);
  const lastPointerDistance = useRef(Infinity);
  const lastDirection = useRef<number | null>(null);

  const [slotSize, setSlotSize] = useState({ w: 0, h: 0 });
  const [viewport, setViewport] = useState({
    w: typeof window === "undefined" ? 360 : window.innerWidth,
    h: typeof window === "undefined" ? 640 : window.innerHeight,
  });
  const [buttonHeight, setButtonHeight] = useState(FALLBACK_HEIGHT);
  /** viewport coordinates of the button's top-left corner, once it is loose */
  const [pos, setPos] = useState<Point | null>(null);
  /** where the button stood when it first broke out of the card */
  const [origin, setOrigin] = useState<Point | null>(null);
  const [fixed, setFixed] = useState(false);
  const [tilt, setTilt] = useState(0);
  const [impulse, setImpulse] = useState(0);
  const [spring, setSpring] = useState<Transition>(SPRING_HOP);
  const [dodges, setDodges] = useState(0);

  const measure = useCallback(() => {
    const slot = slotRef.current;
    if (slot) {
      const w = slot.clientWidth;
      const h = slot.clientHeight;
      setSlotSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    }
    const btn = buttonRef.current;
    if (btn) {
      const h = btn.offsetHeight || FALLBACK_HEIGHT;
      setButtonHeight((prev) => (prev === h ? prev : h));
    }
  }, []);

  // Measure on every commit: the slot only exists after the first paint, and
  // the button's height is only known once it has rendered. State only changes
  // when a number actually changes, so this cannot loop.
  useLayoutEffect(() => {
    measure();
  });

  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  /** Width matches the in-card button, so the break-out is seamless. */
  const slotWidth = slotSize.w || Math.min(viewport.w - 56, 620);
  const buttonWidth = Math.round(
    clamp(slotWidth * 0.62, MIN_BUTTON_WIDTH, MAX_BUTTON_WIDTH),
  );
  const restX = Math.max(0, Math.round((slotSize.w - buttonWidth) / 2));

  // A resize must never leave the escaped button poking off-screen.
  useEffect(() => {
    const base = posRef.current;
    if (!base || !fixed) return;
    const { minX, maxX, minY, maxY } = getBounds(buttonWidth, buttonHeight);
    const next = {
      x: clamp(base.x, minX, maxX),
      y: clamp(base.y, minY, maxY),
    };
    if (next.x === base.x && next.y === base.y) return;
    posRef.current = next;
    setPos(next);
  }, [buttonHeight, buttonWidth, fixed, viewport.h, viewport.w]);

  // While it is paused (modal open, question answered) it must not react to a
  // stale "distance" once it wakes up again.
  useEffect(() => {
    if (disabled) lastPointerDistance.current = Infinity;
  }, [disabled]);

  /** The normal answer buttons — landing on top of one of them would be rude. */
  const collectForbidden = useCallback((): DOMRect[] => {
    const host = slotRef.current?.parentElement;
    if (!host) return [];
    const rects: DOMRect[] = [];
    host.querySelectorAll<HTMLElement>(".btn").forEach((element) => {
      if (element.classList.contains("dodge-btn")) return;
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) rects.push(rect);
    });
    return rects;
  }, []);

  /**
   * Picks the landing spot for one hop: a moderate step in a fresh direction,
   * away from the pointer, never on top of the YES button, always fully
   * inside the viewport.
   */
  const pickSpot = useCallback(
    (
      pointer: Point | null,
      base: Point,
      width: number,
      height: number,
      reach: number,
    ): Point => {
      const { minX, maxX, minY, maxY } = getBounds(width, height);
      const centerX = base.x + width / 2;
      const centerY = base.y + height / 2;
      // bearing straight away from the pointer, so the hop always gains room
      const awayAngle = pointer
        ? Math.atan2(centerY - pointer.y, centerX - pointer.x)
        : Math.random() * Math.PI * 2;

      const candidates: Point[] = [];
      const add = (angle: number, distance: number) => {
        candidates.push({
          x: clamp(base.x + Math.cos(angle) * distance, minX, maxX),
          y: clamp(base.y + Math.sin(angle) * distance, minY, maxY),
        });
      };

      // twelve steps around the compass, rotated by a random offset each time
      // so left / right / up / down / diagonal all get their turn
      const offset = Math.random() * Math.PI * 2;
      for (let i = 0; i < 12; i += 1) {
        add(
          offset + (Math.PI * 2 * i) / 12,
          reach * (0.85 + Math.random() * 0.32),
        );
      }
      // …plus a few scatter hops, all still inside the moderate range
      for (let i = 0; i < 5; i += 1) {
        add(
          awayAngle + (Math.random() - 0.5) * Math.PI * 1.25,
          MIN_HOP + Math.random() * (MAX_HOP - MIN_HOP),
        );
      }

      const forbidden = collectForbidden();
      const hitsForbidden = (spot: Point): boolean =>
        forbidden.some(
          (rect) =>
            spot.x < rect.right + 6 &&
            spot.x + width > rect.left - 6 &&
            spot.y < rect.bottom + 6 &&
            spot.y + height > rect.top - 6,
        );

      const away = (spot: Point): number =>
        pointer
          ? distanceToBox(pointer.x, pointer.y, spot.x, spot.y, width, height)
          : Infinity;

      // Try the ideal landing first (a real hop, comfortably outside the
      // pointer's ring) and relax only if the space simply is not there —
      // small phones still get a move every time.
      const passes = [
        { minHop: 64, minAway: PROXIMITY_TOUCH + 16, avoid: true },
        { minHop: 48, minAway: PROXIMITY_MOUSE, avoid: true },
        { minHop: 40, minAway: 0, avoid: true },
        { minHop: 0, minAway: 0, avoid: false },
      ];

      let best: Point | null = null;
      let bestAngle = lastDirection.current ?? 0;

      for (const pass of passes) {
        let passBest: Point | null = null;
        let passScore = -Infinity;
        let passAngle = bestAngle;

        candidates.forEach((spot) => {
          const moveX = spot.x - base.x;
          const moveY = spot.y - base.y;
          const move = Math.hypot(moveX, moveY);
          if (move < pass.minHop) return;
          if (pass.avoid && hitsForbidden(spot)) return;

          const gap = away(spot);
          if (pointer && gap < pass.minAway) return;

          const angle = Math.atan2(moveY, moveX);
          const previous = lastDirection.current;
          const fresh =
            previous === null ? 1 : 1 - Math.abs(Math.cos(angle - previous));
          // A little further and a little bigger is nicer, but the pull is
          // capped so it never races off to the far corner of the screen.
          const score =
            Math.min(gap, 400) * 1.05 +
            Math.min(move, MAX_HOP) * 0.4 +
            fresh * 60 +
            Math.random() * 70;

          if (score > passScore) {
            passScore = score;
            passBest = spot;
            passAngle = angle;
          }
        });

        if (passBest) {
          best = passBest;
          bestAngle = passAngle;
          break;
        }
      }

      lastDirection.current = bestAngle;
      return best ?? { x: clamp(base.x, minX, maxX), y: clamp(base.y, minY, maxY) };
    },
    [collectForbidden],
  );

  /** Short hops feel springier; long ones get a touch more speed. */
  const pickSpring = useCallback((reach: number): Transition => {
    if (reach >= 190 && Math.random() < 0.6) return SPRING_HOP;
    return Math.random() < 0.5 ? SPRING_PLAYFUL : SPRING_HOP;
  }, []);

  /**
   * One hop. Never answers "no", never jumps far, and only ever runs when the
   * pointer is genuinely close.
   */
  const hop = useCallback(
    (pointer: Point, strength: number): void => {
      const button = buttonRef.current;
      const current =
        fixedRef.current && posRef.current
          ? posRef.current
          : button
            ? (() => {
                const rect = button.getBoundingClientRect();
                return { x: rect.left, y: rect.top };
              })()
            : {
                x: (window.innerWidth - buttonWidth) / 2,
                y: window.innerHeight / 2,
              };

      // the closer the pointer, the stronger the dodge — but never past 220px
      const reach = Math.round(
        MIN_HOP + (MAX_HOP - MIN_HOP) * clamp(strength, 0, 1),
      );
      const target = pickSpot(pointer, current, buttonWidth, buttonHeight, reach);

      // First hop: hand it over to its fixed, viewport-relative life, starting
      // from exactly where it stands so nothing jumps visually.
      if (!fixedRef.current) {
        fixedRef.current = true;
        setOrigin(current);
        setFixed(true);
      }

      posRef.current = target;
      setPos(target);
      setSpring(pickSpring(reach));
      setTilt(Math.random() < 0.7 ? Math.round((Math.random() * 2 - 1) * MAX_TILT) : 0);
      setImpulse((value) => value + 1);
      setDodges((count) => count + 1);
      sound.engine.pop();

      const index = dodges % Math.max(1, taunts.length);
      const taunt = taunts[index];
      if (taunt) onDodge(dodges + 1, taunt);

      lastHop.current = performance.now();
      lastPointerDistance.current = Infinity;
    },
    [buttonHeight, buttonWidth, onDodge, pickSpring, pickSpot, sound, taunts],
  );

  /**
   * Proximity detection. Far away: nothing happens at all. Inside the ring and
   * still closing in: it hops. Backing off, or sitting on top of it: no movement.
   */
  useEffect(() => {
    if (disabled) return;

    const coarse =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(pointer: coarse)").matches
        : false;

    const handlePointerMove = (event: PointerEvent): void => {
      const button = buttonRef.current;
      if (!button) return;

      // A finger needs a touch wider than a mouse does.
      const radius = event.pointerType
        ? event.pointerType === "mouse"
          ? PROXIMITY_MOUSE
          : PROXIMITY_TOUCH
        : coarse
          ? PROXIMITY_TOUCH
          : PROXIMITY_MOUSE;

      const { clientX: x, clientY: y } = event;
      const rect = button.getBoundingClientRect();

      // Cursor already on the button: never dodge, so it stays clickable.
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        lastPointerDistance.current = 0;
        return;
      }

      const distance = distanceToRect(x, y, rect);
      const previous = lastPointerDistance.current;
      lastPointerDistance.current = distance;

      // Too far to care — this is the "mouse far away, do nothing" case.
      if (distance > radius) return;
      // The pointer is backing off: let it be.
      if (distance > previous) return;
      // Just hopped: give her a moment to actually catch it.
      if (performance.now() - lastHop.current < CATCH_WINDOW) return;

      hop({ x, y }, 1 - distance / radius);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [disabled, hop]);

  /**
   * A pointer that reaches the button still only opens the modal — there is
   * deliberately no "no" action attached to the click.
   */
  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onCatch?.();
    },
    [onCatch],
  );

  /** Enter and Space open the same modal — never a silent "no". */
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        event.stopPropagation();
        onCatch?.();
      }
    },
    [onCatch],
  );

  /** a soft squash-and-stretch on every hop — small, never exaggerated */
  const scaleValue = fixed
    ? impulse % 4 === 0 && impulse > 0
      ? [1, 0.96, SMALL_SCALE + 0.015, 1]
      : [1, 0.97, SMALL_SCALE, 1]
    : 1;

  const transition: Transition = {
    x: spring,
    y: spring,
    width: spring,
    rotate: { duration: 0.42, ease: EASE_OUT },
    scale: { duration: 0.38, ease: "easeOut" },
    opacity: { duration: 0.3, ease: "easeOut" },
  };

  return (
    <div className="dodge-slot" ref={slotRef}>
      {!fixed && slotSize.w > 0 && (
        <motion.button
          ref={buttonRef}
          type="button"
          className="btn btn--ghost dodge-btn"
          tabIndex={-1}
          initial={false}
          animate={{ x: restX, y: 0, width: buttonWidth }}
          transition={transition}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onAnimationComplete={measure}
          aria-label={`${label} ${emoji} (this button is shy)`}
        >
          <span className="btn__shine" />
          <span className="btn__label">
            {label}
            <span className="btn__emoji" aria-hidden="true">
              {emoji}
            </span>
          </span>
        </motion.button>
      )}

      {fixed &&
        origin &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <motion.button
            ref={buttonRef}
            type="button"
            className="btn btn--ghost dodge-btn dodge-btn--fixed"
            tabIndex={-1}
            initial={{
              x: origin.x,
              y: origin.y,
              width: buttonWidth,
              rotate: 0,
              scale: 1,
              opacity: 1,
            }}
            animate={{
              x: pos.x,
              y: pos.y,
              width: buttonWidth,
              rotate: tilt === 0 ? 0 : [0, tilt, 0],
              scale: scaleValue,
              opacity: disabled ? 0 : 1,
            }}
            style={{ pointerEvents: disabled ? "none" : "auto" }}
            transition={transition}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onAnimationComplete={measure}
            aria-label={`${label} ${emoji} (this button is shy)`}
          >
            <span className="btn__shine" />
            <span className="btn__label">
              {label}
              <span className="btn__emoji" aria-hidden="true">
                {emoji}
              </span>
            </span>
          </motion.button>,
          document.body,
        )}
    </div>
  );
}

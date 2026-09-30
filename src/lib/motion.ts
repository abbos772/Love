import type { Transition, Variants } from "framer-motion";

/** Shared easing curves so every transition in the app feels like one piece. */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_IN: [number, number, number, number] = [0.55, 0, 1, 0.45];

export const springSoft: Transition = {
  type: "spring",
  stiffness: 210,
  damping: 26,
  mass: 0.9,
};

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 430,
  damping: 28,
  mass: 0.7,
};

/** Standard scene change. */
export const screenVariants: Variants = {
  hidden: { opacity: 0, y: 26, scale: 0.975 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.78, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.985,
    transition: { duration: 0.48, ease: EASE_IN },
  },
};

/** Slower, heavier change used for the emotional build-up. */
export const cinematicVariants: Variants = {
  hidden: { opacity: 0, y: 34, scale: 0.965 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 1.5, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: -26,
    scale: 0.98,
    transition: { duration: 1.1, ease: EASE_IN },
  },
};

/** Stagger container for card contents. */
export const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.085, delayChildren: 0.06 } },
  exit: {},
};

export const listVariantsSlow: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.22, delayChildren: 0.2 } },
  exit: { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
};

/** Item inside a staggered list. */
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.66, ease: EASE_OUT },
  },
  exit: { opacity: 0, y: -10, transition: { duration: 0.3 } },
};

export const itemVariantsSlow: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.05, ease: EASE_OUT },
  },
  exit: { opacity: 0, y: -14, transition: { duration: 0.6 } },
};

/** Independent staggered words for the headline reveals. */
export const wordContainerVariants = (stagger: number, delay: number): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const wordVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: EASE_OUT },
  },
};

/** Pop-in used for reactions and badges. */
export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.7, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { ...springSoft, delay: 0.05 },
  },
  exit: { opacity: 0, scale: 0.92, y: -6, transition: { duration: 0.25 } },
};

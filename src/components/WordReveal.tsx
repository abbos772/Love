import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { wordContainerVariants, wordVariants } from "../lib/motion";

interface WordRevealProps {
  text: string;
  className?: string;
  /** seconds between each word */
  stagger?: number;
  delay?: number;
  as?: "h1" | "h2" | "p";
  /** rendered after the words with the plain heading colour (emojis, accents) */
  trailing?: ReactNode;
}

/**
 * Reveals a headline word by word.
 *
 * Each word gets an animated wrapper and a static inner span that carries the
 * gradient. Keeping the clipped background off the element that transforms is
 * what keeps gradient text visible on every browser.
 */
export function WordReveal({
  text,
  className,
  stagger = 0.075,
  delay = 0,
  as = "h2",
  trailing,
}: WordRevealProps) {
  const words = text.split(" ");
  const Tag = as;

  return (
    <Tag className={className}>
      <motion.span
        style={{ display: "inline" }}
        variants={wordContainerVariants(stagger, delay)}
        initial="hidden"
        animate="visible"
      >
        {words.map((word, index) => (
          <motion.span
            key={`${word}-${index}`}
            className="word-wrap"
            variants={wordVariants}
          >
            <span className="word">
              {index < words.length - 1 ? `${word} ` : word}
            </span>
          </motion.span>
        ))}
      </motion.span>
      {trailing ? <span className="display__trailing"> {trailing}</span> : null}
    </Tag>
  );
}

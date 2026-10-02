import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { WHY_NO } from "../data/journey";

/** Everything the dialog says — every field defaults to the "Why no?" copy. */
export interface WhyNoModalCopy {
  title: string;
  subtitle: string;
  placeholder: string;
  send: string;
  later: string;
}

interface WhyNoModalProps {
  /** true while the little "Why no? 🥺" dialog should be on screen */
  open: boolean;
  /** called with what she wrote when she presses "Send ❤️" */
  onSend: (text: string) => void;
  /** called when she dismisses it — nothing is saved, nothing advances */
  onLater: () => void;
  /** optional copy — used for the "What do you think about Abbos?" variant */
  copy?: WhyNoModalCopy;
}

/**
 * The small romantic dialog that opens once she actually catches the "no"
 * button on the last question. It never answers "no" for her and never closes
 * on its own: it just gives her a quiet, glassy place to explain herself.
 *
 * The very same design is reused for the "yes" path (her opinion about
 * Abbos), which only swaps the copy through the `copy` prop.
 *
 * It is portalled to `document.body`, so the question card's `overflow: hidden`
 * and its entrance transform can never clip or shift it.
 */
export function WhyNoModal({ open, onSend, onLater, copy }: WhyNoModalProps) {
  const title = copy?.title ?? WHY_NO.title;
  const subtitle = copy?.subtitle ?? WHY_NO.subtitle;
  const placeholder = copy?.placeholder ?? WHY_NO.placeholder;
  const send = copy?.send ?? WHY_NO.send;
  const later = copy?.later ?? WHY_NO.later;
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fresh focus every time it opens; the draft itself survives a "Maybe later".
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => textareaRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [open]);

  const handleSend = useCallback(() => {
    onSend(text);
    setText("");
  }, [onSend, text]);

  const handleLater = useCallback(() => {
    onLater();
  }, [onLater]);

  // Escape is a deliberate, user-initiated dismissal — never an automatic one.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onLater();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onLater]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="why-no"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
        >
          <motion.div
            className="why-no__card"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
          >
            <span className="why-no__halo" aria-hidden="true" />

            <h3 className="why-no__title">{title}</h3>
            <p className="why-no__subtitle">{subtitle}</p>

            <textarea
              ref={textareaRef}
              className="why-no__field"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={placeholder}
              maxLength={500}
              rows={4}
              aria-label={placeholder}
            />

            <div className="why-no__actions">
              <button
                type="button"
                className="btn btn--primary why-no__send"
                onClick={handleSend}
              >
                <span className="btn__shine" />
                <span className="btn__label">{send}</span>
              </button>
              <button
                type="button"
                className="btn btn--ghost why-no__later"
                onClick={handleLater}
              >
                <span className="btn__label">{later}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

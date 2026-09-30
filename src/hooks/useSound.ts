import { useCallback, useMemo, useRef, useState } from "react";
import { SoundEngine } from "../lib/audio";

export interface SoundApi {
  enabled: boolean;
  toggle: () => void;
  engine: SoundEngine;
}

/**
 * Owns the single SoundEngine instance for the app.
 *
 * Sound starts disabled: browsers block audio until the listener interacts, and
 * a surprise page should never blast noise at someone. Enabling happens on an
 * explicit tap of the sound toggle.
 */
export function useSound(): SoundApi {
  const engineRef = useRef<SoundEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new SoundEngine();
  }
  const engine = engineRef.current;

  const [enabled, setEnabled] = useState(false);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      void engine.setEnabled(next);
      return next;
    });
  }, [engine]);

  return useMemo(() => ({ enabled, toggle, engine }), [enabled, toggle, engine]);
}

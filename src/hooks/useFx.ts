import { useCallback, useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { ParticleSystem, type ParticleShape } from "../lib/particles";

export interface FxApi {
  /** heart / sparkle burst centred on an element or a point */
  burstAt: (shape: ParticleShape, x: number, y: number, count?: number) => void;
  burstFrom: (target: Element | null, shape: ParticleShape, count?: number) => void;
  firework: (x: number, y: number) => void;
  confetti: (count?: number) => void;
  /** random point inside the viewport */
  randomPoint: () => { x: number; y: number };
  /** removes every one-off particle, e.g. when the scene changes */
  clearBursts: () => void;
}

export interface Fx {
  canvasRef: (node: HTMLCanvasElement | null) => void;
  api: FxApi;
}

/**
 * Mounts the full-screen "effects" canvas used for reaction bursts, fireworks
 * and confetti. Kept separate from the ambient background layer so bursts always
 * render above the card.
 */
export function useFx(): Fx {
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const system = useRef<ParticleSystem | null>(null);
  const reduceMotion = useReducedMotion();

  const canvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasEl.current = node;
  }, []);

  useEffect(() => {
    const canvas = canvasEl.current;
    if (!canvas) return;

    const instance = new ParticleSystem(canvas, {
      density: reduceMotion ? 0.45 : 1,
    });
    system.current = instance;
    instance.start();

    return () => {
      instance.destroy();
      if (system.current === instance) system.current = null;
    };
  }, [reduceMotion]);

  const api = useMemo<FxApi>(() => {
    const size = () => system.current?.size ?? { width: 0, height: 0 };

    const burstAt = (
      shape: ParticleShape,
      x: number,
      y: number,
      count?: number,
    ): void => {
      const sys = system.current;
      if (!sys) return;
      if (shape === "heart") sys.burstHearts(x, y, count ?? 16);
      else if (shape === "spark") sys.sparkleBurst(x, y, count ?? 18);
      else if (shape === "confetti") sys.confettiRain(count ?? 80, false);
      else {
        sys.emit({
          count: count ?? 14,
          shape: "dot",
          x,
          y,
          speed: { min: 40, max: 180 },
          size: { min: 4, max: 10 },
          life: { min: 0.5, max: 1.1 },
          colors: ["#ffffff", "#ffd6e2", "#f4cf95"],
          drag: 1.6,
        });
      }
    };

    return {
      burstAt,
      burstFrom(target, shape, count) {
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const { width, height } = size();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        // keep the burst inside the canvas space
        burstAt(
          shape,
          Math.max(0, Math.min(width, x)),
          Math.max(0, Math.min(height, y)),
          count,
        );
      },
      firework(x, y) {
        system.current?.firework(x, y);
      },
      confetti(count) {
        system.current?.confettiRain(count ?? 110);
      },
      randomPoint() {
        const { width, height } = size();
        return {
          x: width * (0.15 + Math.random() * 0.7),
          y: height * (0.12 + Math.random() * 0.4),
        };
      },
      clearBursts() {
        system.current?.clear();
      },
    };
  }, []);

  return { canvasRef, api };
}

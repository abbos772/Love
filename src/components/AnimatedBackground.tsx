import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { ParticleSystem } from "../lib/particles";

/**
 * The romantic backdrop: slow moving colour aurora, drifting glowing dust,
 * rising hearts, occasional sparkles, film grain and a soft vignette.
 */
export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const system = new ParticleSystem(canvas, {
      ambient: { dots: 48, hearts: 10, sparkleChance: 0.6 },
      density: reduceMotion ? 0.4 : 1,
    });
    system.start();

    return () => system.destroy();
  }, [reduceMotion]);

  return (
    <div className="bg" aria-hidden="true">
      <div className="bg__aurora">
        <div className="bg__blob bg__blob--a" />
        <div className="bg__blob bg__blob--b" />
        <div className="bg__blob bg__blob--c" />
      </div>
      <canvas ref={canvasRef} className="bg__canvas" />
      <div className="bg__grain" />
      <div className="bg__vignette" />
    </div>
  );
}

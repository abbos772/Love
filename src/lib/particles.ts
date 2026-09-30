/**
 * A single lightweight canvas particle engine.
 *
 * It powers both the ambient background (drifting dust, rising hearts,
 * occasional sparkles) and the celebration (confetti, heart bursts, fireworks).
 * Everything is drawn by hand so there are no runtime dependencies and the whole
 * thing runs on one animation frame loop.
 */

export type ParticleShape = "dot" | "heart" | "confetti" | "spark";

export interface Range {
  min: number;
  max: number;
}

export interface SpawnOptions {
  count: number;
  shape: ParticleShape;
  x: number;
  y: number;
  /** direction range in radians; defaults to a full circle */
  angle?: Range;
  /** initial speed in px/s */
  speed?: Range;
  size?: Range;
  life?: Range;
  colors?: string[];
  gravity?: number;
  drag?: number;
  /** horizontal sinusoidal drift amplitude in px */
  sway?: Range;
  swayFreq?: Range;
  spin?: Range;
  alpha?: Range;
  /** spawn scattered inside this radius instead of a single point */
  radius?: number;
  twinkle?: boolean;
}

export interface AmbientConfig {
  dots: number;
  hearts: number;
  /** 0–1 chance per second of spawning a background sparkle */
  sparkleChance: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  age: number;
  life: number;
  color: string;
  shape: ParticleShape;
  gravity: number;
  drag: number;
  sway: number;
  swayFreq: number;
  swayPhase: number;
  rot: number;
  spin: number;
  alpha: number;
  twinkle: boolean;
  /** ambient particles recycle instead of dying */
  ambient: boolean;
}

const HEART_Y_OFFSET = 0.375; // optical centring for the parametric heart
const TAU = Math.PI * 2;
const MAX_DPR = 2;

const HEART_COLORS = [
  "#ff5d8f",
  "#ff8fab",
  "#ffb3c9",
  "#e8436f",
  "#ffd6e2",
];

const CONFETTI_COLORS = [
  "#ff5d8f",
  "#ff8fab",
  "#ffd6e2",
  "#f4cf95",
  "#ffffff",
  "#e8436f",
  "#c9184a",
  "#ffb3c9",
];

function rand(range: Range): number {
  return range.min + Math.random() * (range.max - range.min);
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/* ------------------------------------------------------------------ paths */

function buildHeartPath(): Path2D {
  const path = new Path2D();
  const steps = 44;
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * TAU;
    const x = Math.sin(t) ** 3;
    const y =
      -(13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)) /
      16;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  return path;
}

function buildSparkPath(): Path2D {
  const path = new Path2D();
  const spikes = 4;
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? 1 : 0.15;
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  return path;
}

/* ----------------------------------------------------------------- engine */

export class ParticleSystem {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly ambientConfig: AmbientConfig | null;
  private readonly density: number;

  private width = 0;
  private height = 0;

  private particles: Particle[] = [];
  private ambientParticles: Particle[] = [];
  private sparkleTimer = 0;

  private raf = 0;
  private lastTime = 0;
  private running = false;

  private readonly heartPath = buildHeartPath();
  private readonly sparkPath = buildSparkPath();
  private readonly glowCache = new Map<string, HTMLCanvasElement>();
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, options?: { ambient?: AmbientConfig; density?: number }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ambientConfig = options?.ambient ?? null;
    this.density = options?.density ?? 1;

    this.resize();
    this.seedAmbient();

    window.addEventListener("resize", this.resize);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.resize);
      this.resizeObserver.observe(canvas);
    }
  }

  /* ------------------------------------------------------------ lifecycle */

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy(): void {
    this.stop();
    window.removeEventListener("resize", this.resize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.particles = [];
    this.ambientParticles = [];
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /** Wipes one-off particles (bursts, confetti) but keeps the ambient layer. */
  clear(): void {
    this.particles = [];
  }

  /* --------------------------------------------------------------- sizing */

  private resize = (): void => {
    const parent = this.canvas.parentElement;
    const rect = parent?.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect?.width ?? window.innerWidth));
    const cssHeight = Math.max(1, Math.round(rect?.height ?? window.innerHeight));
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);

    this.width = cssWidth;
    this.height = cssHeight;
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;

    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  };

  /* -------------------------------------------------------------- ambient */

  private makeAmbientDot(): Particle {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: 0,
      vy: -(6 + Math.random() * 16),
      size: 1 + Math.random() * 2.1,
      age: 0,
      life: Infinity,
      color: Math.random() > 0.65 ? "#f4cf95" : "#ffd6e2",
      shape: "dot",
      gravity: 0,
      drag: 0,
      sway: 12 + Math.random() * 34,
      swayFreq: 0.12 + Math.random() * 0.28,
      swayPhase: Math.random() * TAU,
      rot: 0,
      spin: 0,
      alpha: 0.22 + Math.random() * 0.45,
      twinkle: Math.random() > 0.5,
      ambient: true,
    };
  }

  private makeAmbientHeart(): Particle {
    const size = 5 + Math.random() * 8;
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: 0,
      vy: -(10 + Math.random() * 20),
      size,
      age: 0,
      life: Infinity,
      color: pick(HEART_COLORS),
      shape: "heart",
      gravity: 0,
      drag: 0,
      sway: 18 + Math.random() * 40,
      swayFreq: 0.1 + Math.random() * 0.24,
      swayPhase: Math.random() * TAU,
      rot: (Math.random() - 0.5) * 0.5,
      spin: (Math.random() - 0.5) * 0.35,
      alpha: 0.16 + Math.random() * 0.3,
      twinkle: false,
      ambient: true,
    };
  }

  private seedAmbient(): void {
    if (!this.ambientConfig) return;
    this.ambientParticles = [];
    const dots = Math.round(this.ambientConfig.dots * this.density);
    const hearts = Math.round(this.ambientConfig.hearts * this.density);
    for (let i = 0; i < dots; i += 1) this.ambientParticles.push(this.makeAmbientDot());
    for (let i = 0; i < hearts; i += 1) this.ambientParticles.push(this.makeAmbientHeart());
  }

  /* ------------------------------------------------------------- emitting */

  emit(options: SpawnOptions): void {
    const angle = options.angle ?? { min: 0, max: TAU };
    const speed = options.speed ?? { min: 40, max: 160 };
    const size = options.size ?? { min: 2, max: 5 };
    const life = options.life ?? { min: 0.7, max: 1.6 };
    const colors = options.colors ?? HEART_COLORS;
    const alpha = options.alpha ?? { min: 0.65, max: 1 };
    const spin = options.spin ?? { min: -3, max: 3 };
    const sway = options.sway ?? { min: 0, max: 0 };
    const swayFreq = options.swayFreq ?? { min: 1, max: 3 };
    const radius = options.radius ?? 0;

    const count = Math.max(1, Math.round(options.count * this.density));

    for (let i = 0; i < count; i += 1) {
      const a = rand(angle);
      const s = rand(speed);
      const spawnRadius = radius > 0 ? Math.random() * radius : 0;
      const spawnAngle = Math.random() * TAU;

      this.particles.push({
        x: options.x + Math.cos(spawnAngle) * spawnRadius,
        y: options.y + Math.sin(spawnAngle) * spawnRadius,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: rand(size),
        age: 0,
        life: rand(life),
        color: pick(colors),
        shape: options.shape,
        gravity: options.gravity ?? 0,
        drag: options.drag ?? 0.6,
        sway: rand(sway),
        swayFreq: rand(swayFreq),
        swayPhase: Math.random() * TAU,
        rot: Math.random() * TAU,
        spin: rand(spin),
        alpha: rand(alpha),
        twinkle: options.twinkle ?? false,
        ambient: false,
      });
    }

    // Guard against runaway particle counts on low-end devices.
    const max = 900;
    if (this.particles.length > max) {
      this.particles.splice(0, this.particles.length - max);
    }
  }

  /** A burst of hearts rising from a point (button celebrations). */
  burstHearts(x: number, y: number, count = 16): void {
    this.emit({
      count,
      shape: "heart",
      x,
      y,
      radius: 14,
      angle: { min: -Math.PI * 0.92, max: -Math.PI * 0.08 },
      speed: { min: 70, max: 250 },
      size: { min: 5, max: 13 },
      life: { min: 0.9, max: 1.9 },
      colors: HEART_COLORS,
      gravity: 40,
      drag: 0.9,
      sway: { min: 14, max: 46 },
      swayFreq: { min: 1.2, max: 2.6 },
      spin: { min: -1.6, max: 1.6 },
    });
  }

  /** A soft shower of glowing sparks. */
  sparkleBurst(x: number, y: number, count = 18): void {
    this.emit({
      count,
      shape: "spark",
      x,
      y,
      radius: 6,
      speed: { min: 30, max: 190 },
      size: { min: 3, max: 9 },
      life: { min: 0.5, max: 1.2 },
      colors: ["#ffffff", "#f4cf95", "#ffd6e2", "#ffb3c9"],
      gravity: 12,
      drag: 1.5,
      spin: { min: -2, max: 2 },
      twinkle: true,
    });
  }

  /** A firework shell: bright core plus a spread of coloured sparks. */
  firework(x: number, y: number): void {
    const color = pick(CONFETTI_COLORS);
    this.emit({
      count: 44,
      shape: "spark",
      x,
      y,
      speed: { min: 90, max: 340 },
      size: { min: 2.5, max: 6.5 },
      life: { min: 0.6, max: 1.5 },
      colors: [color, "#ffffff", "#f4cf95"],
      gravity: 90,
      drag: 1.15,
      twinkle: true,
    });
    this.emit({
      count: 10,
      shape: "dot",
      x,
      y,
      speed: { min: 20, max: 90 },
      size: { min: 6, max: 14 },
      life: { min: 0.35, max: 0.7 },
      colors: ["#ffffff", color],
      gravity: 20,
      drag: 2.2,
      alpha: { min: 0.4, max: 0.8 },
    });
  }

  /** Confetti raining down from above the viewport. */
  confettiRain(count = 90, fromTop = true): void {
    this.emit({
      count,
      shape: "confetti",
      x: this.width / 2,
      y: fromTop ? -30 : this.height * 0.2,
      radius: Math.max(this.width, 300) * 0.6,
      angle: { min: Math.PI * 0.35, max: Math.PI * 0.65 },
      speed: { min: 110, max: 300 },
      size: { min: 5, max: 11 },
      life: { min: 2.6, max: 4.6 },
      colors: CONFETTI_COLORS,
      gravity: 150,
      drag: 0.7,
      sway: { min: 20, max: 70 },
      swayFreq: { min: 1, max: 2.8 },
      spin: { min: -8, max: 8 },
      alpha: { min: 0.85, max: 1 },
    });
  }

  /* ---------------------------------------------------------------- loop */

  private tick = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.045, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    this.update(dt);
    this.render();

    this.raf = requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    const config = this.ambientConfig;

    // Ambient sparkles keep the background alive without being noisy.
    if (config && this.width > 0) {
      this.sparkleTimer += dt;
      const interval = 1 / Math.max(0.0001, config.sparkleChance);
      if (this.sparkleTimer >= interval) {
        this.sparkleTimer = 0;
        this.emit({
          count: 1,
          shape: "spark",
          x: Math.random() * this.width,
          y: this.height * (0.15 + Math.random() * 0.7),
          speed: { min: 4, max: 22 },
          size: { min: 3, max: 7 },
          life: { min: 1.4, max: 2.6 },
          colors: ["#ffffff", "#f4cf95", "#ffd6e2"],
          gravity: 0,
          drag: 0.4,
          twinkle: true,
          alpha: { min: 0.35, max: 0.75 },
        });
      }
    }

    for (let i = 0; i < this.ambientParticles.length; i += 1) {
      const p = this.ambientParticles[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;

      if (p.y < -60) {
        const fresh = p.shape === "heart" ? this.makeAmbientHeart() : this.makeAmbientDot();
        fresh.y = this.height + 40;
        this.ambientParticles[i] = fresh;
      } else if (p.y > this.height + 80) {
        p.y = -40;
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }

      p.vy += p.gravity * dt;
      const damping = Math.exp(-p.drag * dt);
      p.vx *= damping;
      p.vy *= damping;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }

  /* -------------------------------------------------------------- drawing */

  private glow(color: string): HTMLCanvasElement {
    const cached = this.glowCache.get(color);
    if (cached) return cached;

    const size = 64;
    const sprite = document.createElement("canvas");
    sprite.width = size;
    sprite.height = size;
    const sctx = sprite.getContext("2d");
    if (sctx) {
      const gradient = sctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.28, `${color}b3`);
      gradient.addColorStop(1, "transparent");
      sctx.fillStyle = gradient;
      sctx.fillRect(0, 0, size, size);
    }
    this.glowCache.set(color, sprite);
    return sprite;
  }

  private drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
    const progress = p.life === Infinity ? 0 : p.age / p.life;
    let alpha = p.alpha;

    if (p.life !== Infinity) {
      // quick fade-in, long fade-out
      const fadeIn = Math.min(1, progress / 0.12);
      const fadeOut = 1 - Math.max(0, (progress - 0.45) / 0.55) ** 1.6;
      alpha *= fadeIn * fadeOut;
    }

    if (p.twinkle) {
      alpha *= 0.55 + 0.45 * Math.sin(p.age * 9 + p.swayPhase);
    }
    if (alpha <= 0.004) return;

    const swayX = Math.sin(p.age * p.swayFreq * 2 + p.swayPhase) * p.sway;

    ctx.globalAlpha = alpha;

    switch (p.shape) {
      case "dot": {
        const sprite = this.glow(p.color);
        const s = p.size * 7;
        ctx.drawImage(sprite, p.x + swayX - s / 2, p.y - s / 2, s, s);
        break;
      }
      case "spark": {
        const sprite = this.glow(p.color);
        const g = p.size * 6;
        ctx.drawImage(sprite, p.x + swayX - g / 2, p.y - g / 2, g, g);
        ctx.save();
        ctx.translate(p.x + swayX, p.y);
        ctx.rotate(p.rot);
        ctx.scale(p.size, p.size);
        ctx.fillStyle = "#fff";
        ctx.fill(this.sparkPath);
        ctx.restore();
        break;
      }
      case "heart": {
        const sprite = this.glow(p.color);
        const g = p.size * 5;
        ctx.drawImage(sprite, p.x + swayX - g / 2, p.y - g / 2, g, g);
        ctx.save();
        // the parametric heart sits low in its own box, so nudge it back up
        ctx.translate(p.x + swayX, p.y - HEART_Y_OFFSET * p.size);
        ctx.rotate(p.rot);
        ctx.scale(p.size, p.size);
        ctx.fillStyle = p.color;
        ctx.fill(this.heartPath);
        ctx.restore();
        break;
      }
      case "confetti": {
        ctx.save();
        ctx.translate(p.x + swayX, p.y);
        ctx.rotate(p.rot);
        // fake 3D flip
        ctx.scale(Math.cos(p.age * 6 + p.swayPhase) * 0.55 + 0.45, 1);
        ctx.fillStyle = p.color;
        const h = p.size * 0.62;
        ctx.beginPath();
        const r = Math.min(2, p.size / 2);
        const w = p.size;
        // rounded rectangle
        ctx.moveTo(-w / 2 + r, -h / 2);
        ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
        ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
        ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
        ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
    }

    ctx.globalAlpha = 1;
  }

  private render(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < this.ambientParticles.length; i += 1) {
      this.drawParticle(ctx, this.ambientParticles[i]);
    }
    for (let i = 0; i < this.particles.length; i += 1) {
      this.drawParticle(ctx, this.particles[i]);
    }

    ctx.globalCompositeOperation = "source-over";
  }
}

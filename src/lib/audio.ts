/**
 * A tiny Web Audio synthesiser.
 *
 * Rather than shipping audio files, every sound is generated on the fly, so the
 * experience stays dependency-free and instant to load. Nothing is played until
 * the listener explicitly opts in with the sound toggle, which also satisfies
 * browser autoplay policies (the toggle click is a user gesture).
 */

type AudioContextCtor = typeof AudioContext;

interface ToneOptions {
  freq: number;
  at: number;
  dur: number;
  type?: OscillatorType;
  peak?: number;
  /** glide target frequency */
  to?: number;
  /** detune a second voice slightly for warmth */
  width?: number;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  enabled = false;

  /** Lazily create the context so we never open one without a user gesture. */
  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;

    const w = window as Window & { webkitAudioContext?: AudioContextCtor };
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;

    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = 0.42;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      return ctx;
    } catch {
      return null;
    }
  }

  /** Must be called from a user gesture before the first sound. */
  async resume(): Promise<void> {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* ignore — nothing we can do, and it is not fatal */
      }
    }
  }

  async setEnabled(on: boolean): Promise<void> {
    this.enabled = on;
    if (on) {
      await this.resume();
      this.chime();
    } else if (this.master && this.ctx) {
      // gentle fade-out so the toggle never clicks
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0.0001, now + 0.12);
      window.setTimeout(() => {
        if (!this.enabled && this.master && this.ctx) {
          this.master.gain.setValueAtTime(0.42, this.ctx.currentTime);
        }
      }, 160);
    }
  }

  private tone({
    freq,
    at,
    dur,
    type = "sine",
    peak = 0.16,
    to,
    width = 0,
  }: ToneOptions): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const voices = width > 0 ? [freq, freq * (1 + width)] : [freq];
    for (const f of voices) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(f, at);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);

      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.014, dur * 0.3));
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

      osc.connect(gain).connect(master);
      osc.start(at);
      osc.stop(at + dur + 0.04);
    }
  }

  private get noiseBuffer(): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    if (this.noise) return this.noise;

    const length = Math.floor(ctx.sampleRate * 1.1);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      // slightly softened white noise
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 1.4;
    }
    this.noise = buffer;
    return buffer;
  }

  /** Soft click for choice buttons. */
  pop(): void {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone({ freq: 720, to: 1180, at: t, dur: 0.16, type: "sine", peak: 0.12 });
    this.tone({ freq: 1440, at: t + 0.03, dur: 0.12, type: "triangle", peak: 0.05 });
  }

  /** Warm two-note chime for sweet reactions. */
  chime(): void {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone({ freq: 587.33, at: t, dur: 0.42, type: "sine", peak: 0.1, width: 0.003 });
    this.tone({ freq: 880, at: t + 0.11, dur: 0.55, type: "sine", peak: 0.09, width: 0.003 });
    this.tone({ freq: 1174.66, at: t + 0.2, dur: 0.5, type: "triangle", peak: 0.04 });
  }

  /** Airy sweep used on big scene changes. */
  whoosh(): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const buffer = this.noiseBuffer;
    if (!buffer) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(280, t);
    filter.frequency.exponentialRampToValueAtTime(1800, t + 0.5);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.055, t + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);

    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + 0.8);
  }

  /** A rising, hopeful swell for the proposal build-up. */
  swell(): void {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [293.66, 369.99, 440, 587.33];
    notes.forEach((freq, i) => {
      this.tone({
        freq,
        at: t + i * 0.22,
        dur: 1.5,
        type: "sine",
        peak: 0.075,
        width: 0.004,
      });
    });
  }

  /** The celebration fanfare. */
  celebrate(): void {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const melody: Array<[number, number]> = [
      [587.33, 0],
      [739.99, 0.14],
      [880, 0.28],
      [1174.66, 0.42],
      [987.77, 0.6],
      [1174.66, 0.74],
      [1468.66, 0.9],
    ];
    melody.forEach(([freq, offset]) => {
      this.tone({ freq, at: t + offset, dur: 0.9, type: "sine", peak: 0.11, width: 0.004 });
      this.tone({ freq: freq * 2, at: t + offset, dur: 0.55, type: "triangle", peak: 0.03 });
    });
    // shimmer tail
    [1760, 2349.32, 2637.02].forEach((freq, i) => {
      this.tone({ freq, at: t + 1.05 + i * 0.1, dur: 1.6, type: "sine", peak: 0.035 });
    });
  }
}

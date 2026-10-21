/** Lightweight procedural dice sounds (Web Audio). */
export class DiceAudio {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    this.lastImpactAt = 0;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      return this.ctx.resume();
    }
    return Promise.resolve();
  }

  playRollStart() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /**
   * @param {number} strength 0..1 impact intensity
   */
  playImpact(strength) {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastImpactAt < 45) return;
    this.lastImpactAt = now;

    const amp = Math.min(1, Math.max(0.08, strength));
    const t = this.ctx.currentTime;

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.06);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 320 + amp * 900;
    filter.Q.value = 0.7;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12 + amp * 0.35, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + amp * 0.04);

    noise.connect(filter).connect(gain).connect(this.ctx.destination);
    noise.start(t);
    noise.stop(t + 0.12);
  }
}

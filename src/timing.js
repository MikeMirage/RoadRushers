export const FIXED_STEP = 1 / 120;

/** Keep normal simulation speed through slow frames; interpolate between ticks. */
export class FixedStepClock {
  constructor() { this.reset(); }
  reset() { this.accumulator = 0; this.alpha = 0; }
  advance(dt) {
    this.accumulator += Math.max(0, Math.min(dt, 0.25));
    const steps = Math.floor((this.accumulator + 1e-10) / FIXED_STEP);
    this.accumulator = Math.max(0, this.accumulator - steps * FIXED_STEP);
    this.alpha = this.accumulator / FIXED_STEP;
    return steps;
  }
}

import { validTime } from './results.js';

export const GHOST_KEY = 'roadrushers.ghost.v1.';
const INTERVAL = 1 / 20;
const MAX_FRAMES = 6000;
const FIELDS = ['x', 'y', 'z', 'heading', 'pitch', 'roll', 'steer', 'speed', 'distance'];
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const capture = pose => FIELDS.map(key => pose[key] || 0);
const mix = (a, b, t) => a.map((value, i) => value + (i === 3 ? wrap(b[i] - value) : b[i] - value) * t);
const frame = (time, pose) => [time, ...pose.map(value => Math.round(value * 10000) / 10000)];

export function validGhost(record) {
  if (record?.version !== 1 || !validTime(record.duration) || !Array.isArray(record.frames) || record.frames.length < 2 || record.frames.length > MAX_FRAMES + 1) return false;
  let previous = -1;
  for (const sample of record.frames) {
    if (!Array.isArray(sample) || sample.length !== FIELDS.length + 1 || !sample.every(Number.isFinite) || sample[0] <= previous || sample[0] > record.duration) return false;
    previous = sample[0];
  }
  return record.frames[0][0] === 0 && previous === record.duration;
}

/** Separate keys keep saving one lap independent of the size of the other replays. */
export class GhostRecords {
  constructor(storage) { this.storage = storage; this.entries = new Map(); this.saveAvailable = Boolean(storage); }
  get(context) {
    if (!this.entries.has(context.key)) {
      let record = null;
      try { const saved = JSON.parse(this.storage?.getItem(GHOST_KEY + context.key) || 'null'); if (validGhost(saved)) record = saved; } catch { /* A damaged replay never prevents driving. */ }
      this.entries.set(context.key, record);
    }
    return this.entries.get(context.key);
  }
  recordLap(context, record) {
    if (!validGhost(record)) return false;
    const previous = this.get(context);
    if (previous && previous.duration <= record.duration) return false;
    this.entries.set(context.key, record);
    try { this.storage?.setItem(GHOST_KEY + context.key, JSON.stringify(record)); this.saveAvailable = Boolean(this.storage); }
    catch { this.saveAvailable = false; }
    return true;
  }
}

/** Sample simulation poses; split both laps at the timer's exact sub-tick crossing. */
export class GhostRecorder {
  constructor(pose) {
    this.previous = capture(pose); this.previousTime = 0; this.startTime = 0;
    this.frames = [frame(0, this.previous)]; this.interval = INTERVAL; this.nextTime = INTERVAL;
  }
  step(elapsed, pose, crossing = null) {
    const current = capture(pose), span = elapsed - this.previousTime;
    if (span <= 0) return null;
    const at = time => mix(this.previous, current, Math.max(0, Math.min(1, (time - this.previousTime) / span)));
    const collect = until => {
      while (this.nextTime < until - 1e-9) {
        this.frames.push(frame(this.nextTime - this.startTime, at(this.nextTime)));
        if (this.frames.length >= MAX_FRAMES) {
          this.frames = this.frames.filter((_, i) => i % 2 === 0);
          this.interval *= 2;
        }
        this.nextTime += this.interval;
      }
    };
    let completed = null;
    if (crossing != null && crossing > this.startTime && crossing >= this.previousTime - 1e-9 && crossing <= elapsed + 1e-9) {
      collect(crossing);
      const boundary = at(crossing), duration = crossing - this.startTime;
      this.frames.push(frame(duration, boundary));
      completed = { version: 1, duration, frames: this.frames };
      this.startTime = crossing; this.frames = [frame(0, boundary)]; this.interval = INTERVAL; this.nextTime = crossing + INTERVAL;
    }
    collect(elapsed);
    this.previous = current; this.previousTime = elapsed;
    return completed;
  }
}

/** Shortest-angle interpolation keeps playback smooth across the heading seam. */
export function sampleGhost(record, time, target = {}) {
  if (!record || time < 0 || time > record.duration) return null;
  const frames = record.frames;
  let low = 0, high = frames.length - 1;
  while (high - low > 1) { const middle = (low + high) >> 1; if (frames[middle][0] <= time) low = middle; else high = middle; }
  const a = frames[low], b = frames[high], t = Math.max(0, Math.min(1, (time - a[0]) / (b[0] - a[0])));
  for (let i = 0; i < FIELDS.length; i++) target[FIELDS[i]] = a[i + 1] + (i === 3 ? wrap(b[i + 1] - a[i + 1]) : b[i + 1] - a[i + 1]) * t;
  return target;
}

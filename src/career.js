import { TRACKS, VEHICLES, CHAMPIONSHIP, SURFACES } from './config.js';

import { Circuit } from './circuit.js';

// Conservative geometric lower bound, independent of medal targets and tuning.
// Allow the shorter inside line, but reject times impossible at the official pace.
const minimumOfficialLap=(track,vehicle)=>new Circuit(track).length*.7 / (Math.max(...Object.values(SURFACES).map(s=>s.speed))*vehicle.speed*1.08);

export const CAREER_KEY = 'roadrushers.career.v1';
export const MEDALS = ['Sin medalla', 'Bronce', 'Plata', 'Oro'];

export function medalFor(time, track) {
  if (!Number.isFinite(time) || time <= 0) return 0;
  const displayedTime = Math.floor(time * 100 + 1e-7) / 100;
  if (displayedTime <= track.medals.gold) return 3;
  if (displayedTime <= track.medals.silver) return 2;
  return displayedTime <= track.medals.bronze ? 1 : 0;
}

/** Permanent best results; car unlocks are derived rather than trusted from a save. */
export class Career {
  constructor(storage) {
    this.storage = storage; this.results = {}; this.saveAvailable = Boolean(storage);
    try {
      const data = JSON.parse(storage?.getItem(CAREER_KEY) || 'null');
      if (data?.version === 1) {
        for (const event of CHAMPIONSHIP.events) {
          const time = data.results?.[event.id];
          const track = TRACKS.find(t => t.id === event.track);
          if (typeof time === 'number' && Number.isFinite(time) && time <= 3600 && time >= minimumOfficialLap(track,VEHICLES.find(v=>v.id===event.vehicle)) && this.eventAvailable(event.id)) this.results[event.id] = time;
        }
      }
    } catch { this.saveAvailable = false; }
  }
  best(eventId) { return this.results[eventId] ?? null; }
  medal(eventId) {
    const event = CHAMPIONSHIP.events.find(e => e.id === eventId);
    return event ? medalFor(this.best(eventId), TRACKS.find(t => t.id === event.track)) : 0;
  }
  eventAvailable(eventId) {
    const index = CHAMPIONSHIP.events.findIndex(e => e.id === eventId);
    return index === 0 || index > 0 && CHAMPIONSHIP.events.slice(0, index).every(e => this.medal(e.id) > 0);
  }
  get completed() { return CHAMPIONSHIP.events.filter(e => this.medal(e.id) > 0).length; }
  get points() { return CHAMPIONSHIP.events.reduce((sum, e) => sum + this.medal(e.id), 0); }
  get cupMedal() { return this.completed < 3 ? 0 : this.points >= 8 ? 3 : this.points >= 6 ? 2 : 1; }
  get unlocked() { return ['coda', ...(this.medal(CHAMPIONSHIP.events[0].id) ? ['apex'] : []), ...(this.completed === 3 ? ['velo'] : [])]; }
  nextEvent() { return CHAMPIONSHIP.events.find(e => !this.medal(e.id)) || CHAMPIONSHIP.events[0]; }
  record(eventId, time, settings) {
    const event = CHAMPIONSHIP.events.find(e => e.id === eventId);
    if (!event || !this.eventAvailable(eventId)) throw new Error('Prueba no disponible');
    const track = TRACKS.find(t => t.id === event.track);
    if (settings.mode !== 'career' || settings.track.id !== event.track || settings.vehicle.id !== event.vehicle || settings.surface !== 'track' || settings.weather !== event.weather || settings.pace !== 'normal') throw new Error('La prueba requiere su configuración oficial');
    if (!Number.isFinite(time) || time > 3600 || time < minimumOfficialLap(track,settings.vehicle)) throw new Error('Tiempo no válido');
    const before = this.unlocked;
    this.results[eventId] = Math.min(this.best(eventId) ?? Infinity, time);
    try { this.storage?.setItem(CAREER_KEY, JSON.stringify({ version: 1, results: this.results })); this.saveAvailable = Boolean(this.storage); } catch { this.saveAvailable = false; }
    return { medal: medalFor(time, track), newVehicles: VEHICLES.filter(v => this.unlocked.includes(v.id) && !before.includes(v.id)), cupMedal: this.cupMedal };
  }
}

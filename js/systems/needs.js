// Human-condition model (respectful, non-arcade). Values 0..100.
// Rates are per GAME minute. Focus and work quality are derived from the needs.
import { settings } from '../core/settings.js';
export class Needs {
  constructor() { Object.assign(this, { energy: 92, hydration: 85, nutrition: 80, stress: 18, strain: 5, sleepQuality: 80, health: 100, illness: null, injury: null, dose: 0 }); }
  update(mins, act) {
    const f = settings.reducedFatigue ? 0.5 : 1, simp = settings.simplifiedHealth;
    this.energy -= mins * (1 / 7) * f * (act.sprinting ? 2.2 : 1) * (1.15 - this.sleepQuality / 400);
    this.hydration -= mins * (1 / 6) * (act.sprinting ? 1.8 : 1) * (act.warm ? 1.3 : 1);
    if (!simp) this.nutrition -= mins / 9;
    this.strain += act.sprinting ? mins * 0.4 : -mins * 0.25;
    // stress drifts toward a baseline driven by unmet needs
    const base = 15 + (this.hydration < 30 ? 10 : 0) + (this.energy < 30 ? 12 : 0) + (!simp && this.nutrition < 25 ? 8 : 0);
    this.stress += (base - this.stress) * Math.min(1, mins * 0.01);
    for (const k of ['energy', 'hydration', 'nutrition', 'stress', 'strain']) this[k] = Math.max(0, Math.min(100, this[k]));
    this.health = Math.round(100 - (this.injury ? 15 : 0) - (this.illness ? 10 : 0) - Math.max(0, 25 - this.hydration) * 0.4);
  }
  get focus() {
    const e = Math.min(1, this.energy / 60), h = Math.min(1, this.hydration / 45), s = 1 - Math.max(0, this.stress - 40) / 90;
    return Math.round(100 * Math.max(0.15, e * 0.45 + h * 0.3 + s * 0.25));
  }
  get speedMul() { return 0.75 + 0.25 * Math.min(1, this.hydration / 30) * Math.min(1, (this.energy + 20) / 50); }
  get quality() { return this.focus / 100; }
  addStress(v) { if (!settings.disableStressEvents || v < 0) this.stress = Math.max(0, Math.min(100, this.stress + v)); }
  toJSON() { const o = {}; for (const k of Object.keys(this)) o[k] = this[k]; return o; }
  load(d) { Object.assign(this, d); }
}

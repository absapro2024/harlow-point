// Episodic memory + opinion model.
// Each memory has a type, subject, place, time, salience and SOURCE. The source matters:
// NPCs only know what they saw, heard, read in a log, or were told by someone else.
export const EVENT_WEIGHTS = {
  first_meet:        { sal: 0.4 },
  polite:            { aff: 0.04, sal: 0.25 },
  rude:              { aff: -0.12, res: -0.05, sal: 0.6 },
  impatient:         { aff: -0.03, res: -0.03, sal: 0.4 },
  helped:            { tru: 0.08, res: 0.05, aff: 0.12, sal: 0.7 },
  returned_item:     { tru: 0.12, res: 0.05, aff: 0.18, sal: 0.85 },
  turned_in_item:    { tru: 0.1, res: 0.06, aff: 0.06, sal: 0.6 },
  lied:              { tru: -0.3, res: -0.1, aff: -0.08, sal: 0.95 },
  honest:            { tru: 0.08, res: 0.08, sal: 0.55 },
  apologized:        { tru: 0.04, aff: 0.06, sal: 0.5 },
  tailgate:          { tru: -0.15, res: -0.08, sal: 0.85, safety: true },
  no_ppe:            { tru: -0.08, res: -0.08, sal: 0.7, safety: true },
  ran_indoors:       { tru: -0.02, res: -0.03, sal: 0.35, safety: true },
  denied_restricted: { tru: -0.03, sal: 0.4, safety: true },
  tried_panel:       { tru: -0.05, res: -0.02, sal: 0.55, safety: true },
  passed_training:   { tru: 0.04, res: 0.08, sal: 0.5 },
  failed_training:   { sal: 0.3 },
  completed_wo:      { tru: 0.07, res: 0.07, sal: 0.55 },
  quality_work:      { tru: 0.05, res: 0.08, sal: 0.55 },
  attended_drill:    { tru: 0.06, res: 0.05, sal: 0.5 },
  missed_drill:      { tru: -0.15, res: -0.1, sal: 0.85, safety: true },
  ran_in_drill:      { res: -0.03, sal: 0.4, safety: true },
  safe_choice:       { tru: 0.05, res: 0.06, sal: 0.5 },
  asked_help:        { aff: 0.03, sal: 0.2 },
  saw_item:          { sal: 0.6 },          // non-social: NPC noticed an object
  reported_fatigue:  { tru: 0.05, res: 0.04, sal: 0.5 },
};
const SOURCE_W = { saw: 1, heard: 0.7, log: 0.85, told: 0.5, self: 1 };

export class Memory {
  constructor(owner) { this.owner = owner; this.entries = []; this.op = { tru: 0.5, res: 0.5, aff: 0.5 }; this.nid = 1; }
  /** Record an event. Returns the entry, or null if it was merged with a recent duplicate. */
  add(type, { subject = 'player', place = '', t = 0, source = 'saw', from = null, data = null, credibility = 1 } = {}) {
    const w = EVENT_WEIGHTS[type] || { sal: 0.3 };
    const dup = this.entries.find(e => e.type === type && e.subject === subject && Math.abs(e.t - t) < 15);
    if (dup) { dup.count = (dup.count || 1) + 1; dup.salience = Math.min(1, dup.salience + 0.1); if (SOURCE_W[source] > SOURCE_W[dup.source]) dup.source = source; return null; }
    const e = { id: this.nid++, type, subject, place, t, salience: w.sal * (source === 'told' ? 0.75 : 1), source, from, data, count: 1, shared: [] };
    this.entries.push(e);
    if (subject === 'player') this.applyOpinion(type, SOURCE_W[source] * credibility);
    if (this.entries.length > 80) { this.entries.sort((a, b) => b.salience - a.salience); this.entries.length = 60; }
    return e;
  }
  applyOpinion(type, k) {
    const w = EVENT_WEIGHTS[type]; if (!w) return;
    const tr = this.owner.traits;
    const safetyMul = w.safety ? 0.5 + tr.strictness : 1;
    const affMul = 0.6 + tr.warmth * 0.8;
    const c = v => Math.max(0, Math.min(1, v));
    this.op.tru = c(this.op.tru + (w.tru || 0) * k * safetyMul);
    this.op.res = c(this.op.res + (w.res || 0) * k * safetyMul);
    this.op.aff = c(this.op.aff + (w.aff || 0) * k * affMul);
  }
  has(type, subject = 'player') { return this.entries.some(e => e.type === type && e.subject === subject); }
  count(type, subject = 'player') { return this.entries.filter(e => e.type === type && e.subject === subject).reduce((a, e) => a + e.count, 0); }
  latest(type, subject = 'player') { return this.entries.filter(e => e.type === type && e.subject === subject).sort((a, b) => b.t - a.t)[0]; }
  /** Most noteworthy player-related memory this NPC hasn't shared with `listener` yet. */
  gossipFor(listener) {
    return this.entries.filter(e => e.subject === 'player' && e.salience > 0.45 && !e.shared.includes(listener) && e.type !== 'first_meet' && e.source !== 'told')
      .sort((a, b) => b.salience - a.salience)[0] || this.entries.filter(e => e.type === 'saw_item' && !e.shared.includes(listener))[0];
  }
  /** Salience decays over time, but safety- and trust-critical memories fade slowly. */
  decay(mins) {
    for (const e of this.entries) { const w = EVENT_WEIGHTS[e.type] || {}; const rate = w.safety || e.type === 'lied' ? 0.0004 : 0.0015; e.salience = Math.max(0.05, e.salience - rate * mins); }
  }
  get disposition() { const o = this.op; return (o.tru * 0.4 + o.res * 0.25 + o.aff * 0.35); }
  toJSON() { return { entries: this.entries, op: this.op, nid: this.nid }; }
  load(d) { Object.assign(this, d); }
}

// ABSTRACT plant-state model (fictional). It uses game variables only; there are no real reactor equations.
// It drives announcements, NPC talk, and work urgency.
export class PlantState {
  constructor() {
    Object.assign(this, { unit1: 'Online', unit2: 'Planned outage prep', outputBand: 'High', maintenance: 0.82, reliability: 0.9, staffing: 0.93,
      backlog: 34, safetyCulture: 0.78, radControl: 'Normal', environment: 'Normal', budget: 0.7, outageDaysAway: 21, regulatoryAttention: 0.2, publicConfidence: 0.74 });
  }
  dailyTick() {
    this.backlog = Math.max(10, this.backlog + Math.round((1 - this.staffing) * 20 - 3 + Math.random() * 6));
    this.reliability = Math.min(0.98, Math.max(0.6, this.reliability + (this.maintenance - 0.8) * 0.05));
    this.outageDaysAway = Math.max(0, this.outageDaysAway - 1);
  }
  onPlayerSafety(delta) { this.safetyCulture = Math.max(0, Math.min(1, this.safetyCulture + delta * 0.02)); }
  get urgency() { return this.backlog > 45 ? 'elevated' : 'normal'; }
  summary() { return `Unit 1: ${this.unit1} (${this.outputBand} band) • Unit 2: ${this.unit2} • Work backlog: ${this.backlog} • Safety culture index: ${Math.round(this.safetyCulture * 100)} (all fictional)`; }
  toJSON() { return { ...this }; }
  load(d) { Object.assign(this, d); }
}

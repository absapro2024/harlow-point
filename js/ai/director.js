// Adaptive Director: builds a picture of the player's general playstyle and adjusts help,
// pacing, and NPC behavior. It stays FAIR: it never adds hidden penalties, it caps interventions,
// and it only changes what NPCs could plausibly notice or decide.
import { settings } from '../core/settings.js';
import { roomAt } from '../world/facility.js';

export class Director {
  constructor(G) {
    this.G = G; this.cells = new Set(); this.sprintTime = 0; this.walkTime = 0; this.talks = 0; this.helpAsked = 0; this.quizFails = 0;
    this.rush = 0; this.violations = 0; this.deniedCount = {}; this.hotspots = []; this.lastHelpAt = -999; this.stepStart = 0; this.stepId = null;
    this.docsRead = 0; this.lastProgressPos = null; this.idleMins = 0;
  }
  note(kind, n = 1) { if (kind === 'rush') this.rush += n; if (kind === 'ask_help') this.helpAsked += n; if (kind === 'quiz_fail') this.quizFails += n; if (kind === 'read') this.docsRead += n; if (kind === 'talk') this.talks += n; }
  denied(door) {
    this.deniedCount[door] = (this.deniedCount[door] || 0) + 1;
    // Counter-strategy: security adds a repeatedly probed door to its patrol route for a while.
    if (this.deniedCount[door] >= 3 && !this.hotspots.find(h => h.door === door)) {
      const d = this.G.world.doorById[door];
      this.hotspots.push({ door, name: door === 'pa_door' ? 'Protected Area door' : d.name, pos: [d.x, d.z + 1.6], until: this.G.now + 120 });
    }
  }
  update(gameDt, dt) {
    const p = this.G.player;
    this.cells.add(`${Math.round(p.x / 3)},${Math.round(p.z / 3)}`);
    if (p.moving) { if (p.sprinting) this.sprintTime += dt; else this.walkTime += dt; }
    const step = this.G.missions.currentStep();
    if (step?.id !== this.stepId) { this.stepId = step?.id; this.stepStart = this.G.now; }
    this.hotspots = this.hotspots.filter(h => h.until > this.G.now);
  }
  /** General playstyle label: used by dialogue and help pacing. */
  style() {
    const sprintRatio = this.sprintTime / Math.max(1, this.sprintTime + this.walkTime);
    const explore = this.cells.size / Math.max(1, 6 + this.G.missions.stepsDone() * 3);
    if (sprintRatio > 0.45 || this.rush > 1) return 'rusher';
    if (explore > 2.2) return 'explorer';
    if (this.docsRead >= 3 || this.helpAsked >= 3) return 'methodical';
    if (this.talks >= 6) return 'social';
    return 'balanced';
  }
  get stuckThreshold() { // game minutes on a step before help is offered
    const diff = { relaxed: 0.6, standard: 1, demanding: 1.8 }[settings.difficulty] || 1;
    const st = this.style();
    return 14 * diff * (st === 'explorer' ? 1.6 : st === 'methodical' ? 1.3 : 1) + this.helpAsked * 2;
  }
  stuckLevel() { const t = this.G.now - this.stepStart; return t < this.stuckThreshold ? 0 : t < this.stuckThreshold * 2 ? 1 : 2; }
  /** Should THIS npc proactively offer help? Requires that they see the player, and limits interventions globally. */
  wantsHelp(npc) {
    if (this.G.emergency || !this.G.missions.currentStep()) return false;
    if (this.G.now - this.lastHelpAt < 10) return false;
    if (this.stuckLevel() < 1) return false;
    return npc.traits.warmth * npc.traits.patience > 0.35 || this.stuckLevel() >= 2;
  }
  helped() { this.lastHelpAt = this.G.now; }
  /** Guided-nav arrow: always on if enabled, or temporarily when very stuck. */
  showArrow() { return settings.guidedNav || this.stuckLevel() >= 2; }
  toJSON() { return { cells: [...this.cells], sprintTime: this.sprintTime, walkTime: this.walkTime, talks: this.talks, helpAsked: this.helpAsked, quizFails: this.quizFails, rush: this.rush, deniedCount: this.deniedCount, docsRead: this.docsRead }; }
  load(d) { Object.assign(this, d); this.cells = new Set(d.cells || []); this.hotspots = []; }
}

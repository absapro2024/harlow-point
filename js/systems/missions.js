// Work-order system. Steps complete when matching bus events fire. Prerequisites are checked
// against credentials. Quality is affected by the player's focus when the work is done.
import { bus } from '../core/events.js';
import { WORK_ORDERS } from '../data/workorders.js';

export class Missions {
  constructor(G) {
    this.G = G; this.wos = {};
    for (const t of WORK_ORDERS) this.wos[t.id] = { id: t.id, status: t.autoAssign ? 'active' : 'locked', done: {}, quality: [], notes: [] };
    bus.on('*', e => this.onEvent(e));
  }
  tpl(id) { return WORK_ORDERS.find(w => w.id === id); }
  list() { return WORK_ORDERS.map(t => ({ t, s: this.wos[t.id] })); }
  stepOpen(wo, step) { const s = this.wos[wo]; return s && s.status === 'active' && !s.done[step]; }
  stepDone(wo, step) { return !!this.wos[wo]?.done[step]; }
  stepsDone() { return Object.values(this.wos).reduce((a, s) => a + Object.keys(s.done).length, 0); }
  readyToReport(wo) { const t = this.tpl(wo); return t.steps.filter(s => !s.optional && s.id !== 'report').every(s => this.wos[wo].done[s.id]); }
  canAccept(id) {
    const t = this.tpl(id), c = this.G.player.cred, r = [];
    if (c.tier < t.minTier) r.push(`Requires Tier ${t.minTier}`);
    for (const q of t.quals) if (!c.quals.includes(q)) r.push(`Requires ${q}`);
    if (this.G.player.needs.focus < 25) r.push('You are too fatigued to safely start new work. Rest first.');
    return r;
  }
  accept(id) { const r = this.canAccept(id); if (r.length) return r; this.wos[id].status = 'active'; bus.emit('wo_accepted', { id }); this.G.ui.toast(`Accepted ${id}: ${this.tpl(id).title}`); return []; }
  /** First incomplete step across active WOs (orientation first). Used for objectives and guided nav. */
  currentStep() {
    for (const t of WORK_ORDERS) { const s = this.wos[t.id]; if (s.status !== 'active') continue;
      for (const st of t.steps) { if (s.done[st.id]) continue; if (st.id === 'report' && !this.readyToReport(t.id)) continue; return { ...st, wo: t.id }; } }
    return null;
  }
  onEvent(e) {
    for (const t of WORK_ORDERS) {
      const s = this.wos[t.id]; if (s.status !== 'active') continue;
      for (const st of t.steps) {
        if (s.done[st.id]) continue;
        const on = st.on; if (on.type !== e.type) continue;
        if (on.id && on.id !== e.id) continue; if (on.topic && on.topic !== e.topic) continue;
        if (st.id === 'report' && !this.readyToReport(t.id)) continue;
        s.done[st.id] = this.G.now; s.quality.push(this.G.player.needs.quality);
        this.G.ui.toast(`✔ ${st.text.replace('(Recommended) ', '')}`); this.G.audio.ok();
        bus.emit('step_done', { wo: t.id, step: st.id });
        if (t.steps.every(x => x.optional || s.done[x.id])) this.complete(t, s);
        this.G.autosave();
      }
    }
  }
  complete(t, s) {
    s.status = 'done';
    const q = s.quality.reduce((a, b) => a + b, 0) / Math.max(1, s.quality.length);
    const r = t.reward || {};
    if (r.tier) this.G.player.cred.tier = Math.max(this.G.player.cred.tier, r.tier);
    if (r.qual) this.G.player.cred.quals.push(r.qual);
    for (const u of r.unlock || []) if (this.wos[u].status === 'locked') this.wos[u].status = 'available';
    this.G.player.performance.reliability = Math.min(1, this.G.player.performance.reliability + 0.05);
    this.G.player.performance.quality = (this.G.player.performance.quality + q) / 2;
    this.G.ui.banner(`${t.id} complete`, `${t.title} • Work quality ${Math.round(q * 100)}%${r.tier ? ` • Badge upgraded to Tier ${r.tier}` : ''}`);
    bus.emit('wo_complete', { id: t.id, quality: q });
  }
  toJSON() { return this.wos; }
  load(d) { for (const k in d) if (this.wos[k]) this.wos[k] = d[k]; }
}

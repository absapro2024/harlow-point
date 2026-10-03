// HUD + generic UI primitives (toasts, subtitles, banners, prompts, modal panels, choices).
import { settings } from '../core/settings.js';
const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = { inspect: '🔍', use: '✋', repair: '🔧', restricted: '⛔', background: '▫️', talk: '💬', door: '🪪' };
const CAT = { inspect: 'Inspect', use: 'Use', repair: 'Repair', restricted: 'Restricted', background: 'Background', talk: 'Talk', door: 'Badge' };

export class UI {
  constructor(G) { this.G = G; this.modal = null; this.hintsShown = new Set(JSON.parse(localStorage.getItem('hp_hints') || '[]')); }
  toast(text, ms = 3500) { const d = document.createElement('div'); d.textContent = text; $('toasts').appendChild(d); setTimeout(() => d.remove(), ms); }
  subtitle(who, text, ms) {
    if (!settings.subtitles && !who.startsWith('📢')) return;
    const s = settings.reducedReading && text.length > 140 ? text.slice(0, text.indexOf('.', 60) + 1 || 140) : text;
    const d = document.createElement('div'); d.innerHTML = `<b>${esc(who)}:</b> ${esc(s)}`; $('subs').appendChild(d);
    while ($('subs').children.length > 3) $('subs').firstChild.remove();
    setTimeout(() => d.remove(), ms || Math.max(3500, s.length * 55));
  }
  banner(title, sub, ms = 4500) { const b = $('banner'); b.querySelector('b').textContent = title; b.querySelector('span').textContent = sub; b.classList.remove('hidden'); clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.add('hidden'), ms); }
  hint(key, text) {
    if (!settings.reminders && key !== 'force') return;
    if (this.hintsShown.has(key)) return; this.hintsShown.add(key); localStorage.setItem('hp_hints', JSON.stringify([...this.hintsShown]));
    const h = $('hint'); h.textContent = '💡 ' + text; h.classList.remove('hidden'); clearTimeout(this._ht); this._ht = setTimeout(() => h.classList.add('hidden'), 7000);
  }
  resetHints() { this.hintsShown.clear(); localStorage.removeItem('hp_hints'); }
  prompt(t) {
    const p = $('prompt'), u = $('btnUse');
    if (!t || this.modal || this.G.paused) { p.classList.add('hidden'); u.classList.add('hidden'); return; }
    $('promptIcon').textContent = ICON[t.cat] || '•'; $('promptText').textContent = t.label; const c = $('promptCat'); c.textContent = CAT[t.cat]; c.className = t.cat;
    p.classList.remove('hidden'); u.classList.remove('hidden');
  }
  update(G) {
    const n = G.player.needs;
    $('clock').textContent = G.clock.fmt(); $('shift').textContent = `${G.clock.dayName} • ${G.clock.shift.name} • ${G.weather.type.name}`;
    for (const el of document.querySelectorAll('.need')) {
      const k = el.dataset.k; if (k === 'nutrition' && settings.simplifiedHealth) { el.style.display = 'none'; continue; }
      const v = k === 'stress' ? 100 - n.stress : n[k]; el.style.setProperty('--v', v + '%'); el.classList.toggle('low', v < 30);
    }
    $('focus').textContent = `Focus ${n.focus}%  •  Health ${n.health}%`;
    const step = G.missions.currentStep();
    $('objective').innerHTML = G.emergency ? '<span class="wo-id">DRILL IN PROGRESS</span>Walk to Assembly Area B (parking lot) and check in with Security.'
      : step ? `<span class="wo-id">${step.wo}</span>${esc(settings.reducedReading ? step.text.split(' at ')[0] : step.text)}` : '<span class="wo-id">NO ACTIVE STEP</span>Check the WO-03 terminal for new work orders.';
    const c = G.player.cred; $('badgechip').textContent = c.badgeId ? `🪪 ${c.badgeId} • Tier ${c.tier}${G.escorted() ? ' • ESCORTED' : ''}` : '🪪 No badge yet';
    $('btnRadio').classList.toggle('hidden', !G.player.hasRadio);
    $('btnRun').classList.toggle('on', G.sprintToggle);
    const fat = Math.max(0, 50 - n.focus); $('vignette').style.boxShadow = `inset 0 0 ${fat * 4}px ${fat * 2}px rgba(0,0,0,${Math.min(0.75, fat / 50)})`;
    // guided-nav arrow
    const tgt = G.objectiveTarget();
    const a = $('arrow');
    if (tgt && G.director.showArrow() && !this.modal) {
      const dx = tgt[0] - G.player.x, dz = tgt[1] - G.player.z, d = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz) - G.player.yaw; a.classList.remove('hidden');
      $('arrowIcon').style.transform = `rotate(${-ang}rad)`; $('arrowDist').textContent = d < 2 ? 'here' : `${Math.round(d)} m`;
    } else a.classList.add('hidden');
  }
  // ---------- modal framework
  open(title, html, { tabs = null, onClose = null } = {}) {
    this.close(); this.G.setPaused(true);
    const el = document.createElement('div'); el.className = 'panel';
    el.innerHTML = `<header><b>${esc(title)}</b><button data-close>✕</button></header>${tabs ? `<div class="tabs">${tabs}</div>` : ''}<div class="body">${html}</div>`;
    document.getElementById('overlay').appendChild(el); this.modal = el; this.onClose = onClose;
    el.querySelector('[data-close]').onclick = () => this.close();
    return el;
  }
  close() { if (!this.modal) return; this.modal.remove(); this.modal = null; this.G.setPaused(false); const f = this.onClose; this.onClose = null; f && f(); }
  choice(title, text, options) {
    const el = this.open(title, `<p>${esc(text)}</p><div class="opts">${options.map((o, i) => `<button data-i="${i}" class="${o.primary ? 'primary' : ''}">${esc(o.label)}</button>`).join('')}</div>`);
    el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const o = options[+b.dataset.i]; this.close(); o.fn && o.fn(); });
  }
  info(title, html) { this.open(title, html); }
}

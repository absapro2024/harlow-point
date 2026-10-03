// Title screen, character creation, and job-placement assessment.
import { esc } from './hud.js';
import { ROLES, QUIZ, PRIOR, CAT_NAMES } from '../data/roles.js';
import { hasSave } from '../core/save.js';
const ov = () => document.getElementById('overlay');
function screen(html) { ov().innerHTML = `<div class="screen"><div class="card">${html}</div></div>`; return ov().querySelector('.card'); }

export function titleScreen(onNew, onContinue) {
  const c = screen(`<h1>Harlow Point: Shift Work</h1><p class="dim">A first-person career simulation at a fictional civilian nuclear generating station.</p>
    <p class="placeholder-tag">Chapter 1: Cedar Ridge Training Center</p>
    <p class="dim" style="font-size:13px">Computer controls: click to look with the mouse • W A S D move • E interact • Shift run • Q work orders • Esc menu</p><div class="opts"><button class="primary" id="new">New career</button><button onclick="location.href='world.html'">Open world: Texas (real terrain, live weather)</button><button id="cont" ${hasSave(1) ? '' : 'disabled'}>Continue</button></div>
    <p class="dim" style="font-size:12px">All stations, people, equipment, and procedures are fictional and simplified for gameplay. Nothing here is real operating guidance.</p>`);
  c.querySelector('#new').onclick = onNew; c.querySelector('#cont').onclick = onContinue;
}
export function characterCreation(done) {
  const P = { name: '', pronouns: 'they/them', skin: 3, hair: 'short', build: 'average', background: 'trade', education: 'associate', prior: 'none' };
  const sel = (k, opts) => `<div class="row">${opts.map(([v, l]) => `<button data-k="${k}" data-v="${v}" class="${P[k] === v ? 'sel' : ''}">${l}</button>`).join('')}</div>`;
  const render = () => {
    const c = screen(`<h2>Your employee profile</h2>
      <h3>Name</h3><input id="nm" maxlength="24" placeholder="First and last name" value="${esc(P.name)}">
      <h3>Pronouns</h3>${sel('pronouns', [['she/her', 'she/her'], ['he/him', 'he/him'], ['they/them', 'they/them']])}
      <h3>Appearance (shown on your badge photo)</h3><div class="row">${[1, 2, 3, 4, 5, 6].map(i => `<button data-k="skin" data-v="${i}" class="${P.skin == i ? 'sel' : ''}" style="background:${['#f1d3b5', '#e0b48f', '#c68e63', '#a8724c', '#8d5a3b', '#5a3825'][i - 1]}">&nbsp;</button>`).join('')}</div>
      ${sel('hair', [['short', 'Short hair'], ['long', 'Long hair'], ['curly', 'Curly'], ['shaved', 'Shaved'], ['covered', 'Head covering']])}
      ${sel('build', [['slim', 'Slim'], ['average', 'Average'], ['broad', 'Broad']])}
      <h3>Background</h3>${sel('background', [['military', 'Military technical service'], ['trade', 'Trade school'], ['university', 'University'], ['career_change', 'Career changer'], ['local', 'Local community hire']])}
      <h3>Education</h3>${sel('education', [['hs', 'High school / GED'], ['associate', 'Associate'], ['bachelor', 'Bachelor\'s'], ['master', 'Master\'s+']])}
      <h3>Prior work experience</h3>${sel('prior', [['none', 'None'], ['industrial', 'Industrial'], ['electrical', 'Electrical'], ['healthcare', 'Healthcare'], ['security', 'Security'], ['office', 'Office / IT'], ['lab', 'Laboratory']])}
      <p class="dim" style="font-size:12px">These choices only shape flavor and the assessment's starting suggestions. They never limit eligibility, ability, or worth.</p>
      <div class="opts"><button class="primary" id="go">Continue to job-placement assessment ▸</button></div>`);
    c.querySelector('#nm').oninput = e => P.name = e.target.value;
    c.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { P[b.dataset.k] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; const st = c.scrollTop; render(); ov().querySelector('.card').scrollTop = st; });
    c.querySelector('#go').onclick = () => { P.name = P.name.trim() || 'Alex Rivera'; assessment(P, done); };
  };
  render();
}
function assessment(P, done) {
  const score = {}; for (const k in CAT_NAMES) score[k] = 0;
  for (const [k, v] of Object.entries(PRIOR[P.prior] || {})) score[k] += v;
  let i = 0;
  const q = () => {
    if (i >= QUIZ.length) return results();
    const Q = QUIZ[i];
    const c = screen(`<p class="dim">Job-placement assessment • ${i + 1}/${QUIZ.length}</p><h2>${esc(Q.q)}</h2><div class="opts">${Q.a.map(([t], k) => `<button data-k="${k}">${esc(t)}</button>`).join('')}</div>`);
    c.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { for (const [k, v] of Object.entries(Q.a[+b.dataset.k][1])) score[k] += v; i++; q(); });
  };
  const results = () => {
    const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
    const starters = ROLES.filter(r => r.starter);
    const rec = starters.find(r => r.cat === ranked[0][0]) || starters[0];
    let chosen = rec.id;
    const render = () => {
      const c = screen(`<h2>Assessment results</h2><p>Your strongest interests: ${ranked.slice(0, 3).map(([k]) => `<span class="chip">${CAT_NAMES[k]}</span>`).join('')}</p>
        <p>Recommended starting role: <b>${esc(rec.name)}</b></p><p class="dim">You may choose any available starting role.</p>
        <div class="opts">${starters.map(r => `<button data-r="${r.id}" class="${chosen === r.id ? 'sel' : ''}">${esc(r.name)} <span class="dim">• ${r.dept}${r.id === rec.id ? ' • recommended' : ''}</span></button>`).join('')}</div>
        <div class="opts"><button class="primary" id="start">Start first day ▸</button></div>`);
      c.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { chosen = b.dataset.r; const st = c.scrollTop; render(); ov().querySelector('.card').scrollTop = st; });
      c.querySelector('#start').onclick = () => { const r = ROLES.find(x => x.id === chosen); ov().innerHTML = ''; done({ ...P, roleId: r.id, roleName: r.name, dept: r.dept, ladder: r.ladder, aptitudes: score }); };
    };
    render();
  };
  q();
}

// Feature panels: dialogue, training terminal, work orders, documents, menu, settings, AI insight.
import { esc } from './hud.js';
import { MODULES, HELP, POLICY } from '../data/training.js';
import { GLOSSARY } from '../data/glossary.js';
import { settings, saveSettings, defaults } from '../core/settings.js';
import { writeSave, readSave, hasSave, exportCode, importCode } from '../core/save.js';
import { bus } from '../core/events.js';
import { tone } from '../ai/dialogue.js';
import { rootNode } from '../ai/dialogue.js';

// ---------------------------------------------------------------- dialogue
export function openDialogue(G, npc) {
  const ui = G.ui; ui.close(); G.setPaused(true, true);
  G.director.note('talk');
  const el = document.createElement('div'); el.className = 'dlg'; document.getElementById('overlay').appendChild(el); ui.modal = el;
  const end = () => { el.remove(); ui.modal = null; npc.inConversation = false; npc.goal = null; npc.steps = []; G.setPaused(false); };
  ui.onClose = () => { npc.inConversation = false; };
  const show = (node) => {
    if (!node) return end();
    let i = 0;
    const render = () => {
      const op = npc.memory.op, t = tone(npc);
      const head = `<div class="row" style="flex-wrap:nowrap"><div><div class="who">${esc(npc.name)}</div><div class="role">${esc(npc.def.role)} • rapport: ${t}</div></div>
        <div style="flex:0 0 120px;font-size:11px" class="dim">Trust<div class="bar"><i style="width:${op.tru * 100}%"></i></div>Respect<div class="bar"><i style="width:${op.res * 100}%"></i></div></div></div>`;
      if (i < node.lines.length - 1) { el.innerHTML = head + `<div class="line">${esc(node.lines[i])}</div><div class="opts"><button class="primary" data-next>Continue ▸</button></div>`; el.querySelector('[data-next]').onclick = () => { i++; render(); }; return; }
      el.innerHTML = head + `<div class="line">${esc(node.lines[i] || '')}</div><div class="opts">${(node.options || []).map((o, k) => `<button data-k="${k}">${esc(o.label)}</button>`).join('')}</div>`;
      if (!node.options || !node.options.length) { el.querySelector('.opts').innerHTML = '<button data-end>Done</button>'; el.querySelector('[data-end]').onclick = end; }
      el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => show(node.options[+b.dataset.k].fn()));
    };
    render();
  };
  show(rootNode(npc, G));
}

// ---------------------------------------------------------------- training terminal
export function openTerminal(G, tab = 'library') {
  const tabs = [['library', 'Training Library'], ['records', 'My Records'], ['help', 'Help Center'], ['glossary', 'Glossary'], ['policy', 'Policy Manual'], ['tutorial', 'Tutorial']];
  const el = G.ui.open('Training Terminal TT-01 (fictional content)', '', { tabs: tabs.map(([k, n]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('') });
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { G.ui.close(); openTerminal(G, b.dataset.t); });
  const body = el.querySelector('.body'), p = G.player;
  if (tab === 'library') {
    body.innerHTML = MODULES.map(m => { const rec = p.training?.[m.id]; return `<div class="wo"><b>${m.id}</b> ${esc(m.title)} ${m.required ? '<span class="chip">Required</span>' : ''}<br>
      <span class="dim">${rec ? `Passed ${Math.round(rec.score * 100)}% • expires day ${rec.expires + 1}` : 'Not completed'} • valid ${m.validDays} days</span><div class="row" style="margin-top:8px"><button data-m="${m.id}" class="${rec ? '' : 'primary'}">${rec ? 'Retake' : 'Start'}</button></div></div>`; }).join('');
    body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => runModule(G, MODULES.find(m => m.id === b.dataset.m)));
  }
  if (tab === 'records') body.innerHTML = `<h3>Credential</h3>Badge ${p.cred.badgeId || '—'} • Tier ${p.cred.tier}<br>Qualifications: ${p.cred.quals.map(q => `<span class="chip">${q}</span>`).join('') || 'none'}
    <h3>Performance record</h3>Reliability ${Math.round(p.performance.reliability * 100)} • Work quality ${Math.round(p.performance.quality * 100)} • Safety violations logged: ${p.stats.violations}
    <h3>Career path</h3>${esc(p.profile.roleName)} → ${(p.profile.ladder || []).map(esc).join(' → ')}<p class="dim">Promotions need time in role, certifications, supervisor trust, and a clean safety record. More roles and stations arrive in future updates.</p>`;
  if (tab === 'help') body.innerHTML = HELP.map(([h, t]) => `<h3>${esc(h)}</h3><p>${esc(t)}</p>`).join('');
  if (tab === 'glossary') body.innerHTML = GLOSSARY.map(([h, t]) => `<p><b>${esc(h)}</b>: ${esc(t)}</p>`).join('');
  if (tab === 'policy') body.innerHTML = POLICY.map(([h, t]) => `<h3>${esc(h)}</h3><p>${esc(t)}</p>`).join('');
  if (tab === 'tutorial') { body.innerHTML = `<p>The "training simulator" for the tutorial: tap below to show every tutorial hint again as you play.</p><button class="primary" id="rt">Replay tutorial hints</button>`; body.querySelector('#rt').onclick = () => { G.ui.resetHints(); G.ui.close(); G.ui.hint('move', 'Drag the left side to walk and the right side to look. Look at things to see prompts.'); }; }
}
function runModule(G, m) {
  const pages = G.settingsReduced() ? m.pages.map(s => s.split('. ')[0] + '.') : m.pages;
  let i = 0, q = 0, score = 0;
  const el = G.ui.open(`${m.id} — ${m.title}`, '');
  const body = el.querySelector('.body');
  const page = () => {
    if (i < pages.length) { body.innerHTML = `<p class="dim">Page ${i + 1}/${pages.length}</p><p style="font-size:17px">${esc(pages[i])}</p><div class="row"><button ${i ? '' : 'disabled'} id="pv">◂ Back</button><button class="primary" id="nx">Next ▸</button></div>`;
      body.querySelector('#nx').onclick = () => { i++; page(); }; body.querySelector('#pv').onclick = () => { i--; page(); }; return; }
    quiz();
  };
  const quiz = () => {
    if (q >= m.quiz.length) return finish();
    const Q = m.quiz[q];
    body.innerHTML = `<p class="dim">Question ${q + 1}/${m.quiz.length}</p><p style="font-size:17px">${esc(Q.q)}</p><div class="opts">${Q.options.map((o, k) => `<button data-k="${k}">${esc(o)}</button>`).join('')}</div>`;
    body.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const ok = +b.dataset.k === Q.answer; if (ok) score++;
      body.innerHTML = `<p style="font-size:17px">${ok ? '✅ Correct.' : '❌ Not quite.'}</p><p>${esc(Q.explain)}</p><button class="primary" id="nq">Continue ▸</button>`;
      body.querySelector('#nq').onclick = () => { q++; quiz(); };
    });
  };
  const finish = () => {
    const s = score / m.quiz.length, pass = s >= m.pass;
    if (pass) { G.player.training = G.player.training || {}; G.player.training[m.id] = { score: s, completed: G.clock.day, expires: G.clock.day + m.validDays }; if (!G.player.cred.quals.includes(m.grantsQual)) G.player.cred.quals.push(m.grantsQual); }
    body.innerHTML = `<h2>${pass ? 'Passed' : 'Not passed yet'}: ${Math.round(s * 100)}%</h2><p>${pass ? `Qualification ${m.grantsQual} added to your badge record.` : `You need ${Math.round(m.pass * 100)}%. Review the pages and try again; there is no penalty for retaking.`}</p><button class="primary" id="dn">Close</button>`;
    body.querySelector('#dn').onclick = () => G.ui.close();
    bus.emit('quiz_result', { id: m.id, pass }); if (pass) { bus.emit('quiz_pass', { id: m.id }); G.player.needs.addStress(-5); } else G.player.needs.addStress(4);
    G.audio[pass ? 'ok' : 'deny']();
  };
  page();
}

// ---------------------------------------------------------------- work orders
export function openWO(G, atTerminal = false) {
  const el = G.ui.open(atTerminal ? 'Work-Order Terminal WO-03' : 'Work Orders (handheld)', '');
  const body = el.querySelector('.body');
  body.innerHTML = G.missions.list().filter(({ s }) => s.status !== 'locked').map(({ t, s }) => {
    const reasons = s.status === 'available' ? G.missions.canAccept(t.id) : [];
    return `<div class="wo"><b>${t.id}</b> ${esc(t.title)} <span class="chip">${t.type}</span><span class="chip">${s.status.toUpperCase()}</span><span class="chip">Priority: ${t.priority}</span>
      <p class="dim">${esc(t.summary)}</p>${t.steps.map(st => `<div class="step ${s.done[st.id] ? 'done' : ''}">${s.done[st.id] ? '☑' : '☐'} ${esc(st.text)}</div>`).join('')}
      ${s.status === 'available' ? (atTerminal ? `<div class="row" style="margin-top:8px"><button class="primary" data-acc="${t.id}" ${reasons.length ? 'disabled' : ''}>Accept work order</button></div>${reasons.map(r => `<div class="dim">⛔ ${esc(r)}</div>`).join('')}` : '<p class="dim">Accept at the WO-03 terminal in the Ops Training Office.</p>') : ''}
      ${atTerminal && t.id === 'WO-0002' && s.status === 'active' && ['e1', 'e2', 'e3'].every(k => s.done[k]) && !s.done.doc ? `<h3>Your recorded findings</h3>${Object.entries(G.ext.recorded).map(([k, v]) => `<div>${k.toUpperCase()}: ${v}</div>`).join('')}<button class="primary" data-doc>Submit documentation</button>` : ''}</div>`;
  }).join('') + (atTerminal ? '' : '<p class="dim">Tip: new work orders become available as you complete training and earn trust.</p>');
  body.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => { G.missions.accept(b.dataset.acc); G.ui.close(); openWO(G, true); });
  const d = body.querySelector('[data-doc]'); if (d) d.onclick = () => { G.submitExtDoc(); G.ui.close(); };
}

// ---------------------------------------------------------------- documents
export function openDoc(G, title, paras, { sign = null } = {}) {
  const el = G.ui.open(title, paras.map(p => Array.isArray(p) ? `<h3>${esc(p[0])}</h3><p>${esc(p[1])}</p>` : `<p>${esc(p)}</p>`).join('') + (sign ? `<button class="primary" id="sg">${esc(sign.label)}</button>` : ''));
  if (sign) el.querySelector('#sg').onclick = () => { sign.fn(); G.ui.close(); };
}

// ---------------------------------------------------------------- menu & settings & insight
export function openMenu(G) {
  const el = G.ui.open('Menu', `<div class="opts">
    <button class="primary" id="m_resume">Resume</button><button id="m_save">Save game</button><button id="m_load" ${hasSave(1) ? '' : 'disabled'}>Load last save</button>
    <button id="m_ai">What coworkers think of you (AI insight)</button><button id="m_set">Settings & accessibility</button><button id="m_term">Help center</button>
    <button id="m_exp">Export save code (backup)</button><button id="m_imp">Import save code</button><button id="m_title">Quit to title</button></div>
    <p class="dim placeholder-tag">Chapter 1 • All facilities, people, and procedures are fictional.</p>`);
  const $ = (id) => el.querySelector('#' + id);
  $('m_resume').onclick = () => G.ui.close();
  $('m_save').onclick = () => { G.save(); G.ui.close(); };
  $('m_load').onclick = () => { G.ui.close(); G.loadGame(); };
  $('m_ai').onclick = () => openInsight(G);
  $('m_set').onclick = () => openSettings(G);
  $('m_term').onclick = () => openTerminal(G, 'help');
  $('m_exp').onclick = () => { G.save(); const c = exportCode(1); G.ui.open('Save code', `<p>Copy this code somewhere safe (Notes app). You can restore it with Import.</p><textarea style="width:100%;height:40vh;font-size:10px;user-select:text;-webkit-user-select:text">${c}</textarea>`); };
  $('m_imp').onclick = () => { const el2 = G.ui.open('Import save code', `<textarea id="ic" style="width:100%;height:40vh"></textarea><button class="primary" id="ib">Import & load</button>`); el2.querySelector('#ib').onclick = () => { try { importCode(1, el2.querySelector('#ic').value); G.ui.close(); G.loadGame(); } catch { G.ui.toast('That code is not valid.'); } }; };
  $('m_title').onclick = () => location.reload();
}
export function openSettings(G) {
  const S = [['difficulty', 'Difficulty (help timing)', ['relaxed', 'standard', 'demanding']], ['simplifiedHealth', 'Simplified health simulation'], ['reducedFatigue', 'Reduced fatigue penalties'],
    ['reminders', 'Tutorial hints & reminders'], ['colorBlind', 'Color-blind friendly palette'], ['subtitles', 'Subtitles for speech & radio'], ['reducedReading', 'Reduced reading mode'],
    ['guidedNav', 'Guided navigation arrow'], ['disableStressEvents', 'Disable stressful events (drills)'], ['showAIThoughts', 'Show coworker goals above heads'], ['invertY', 'Invert look up/down'],
    ['leftHanded', 'Left-handed controls (swap sides)'], ['lookSensitivity', 'Look sensitivity', [0.5, 0.75, 1, 1.25, 1.5, 2]], ['timeScale', 'Game-time speed', [0.5, 1, 2, 4]]];
  const el = G.ui.open('Settings & accessibility', S.map(([k, label, opts]) => opts
    ? `<div class="row" style="margin:6px 0"><span>${label}</span><select data-k="${k}">${opts.map(o => `<option ${settings[k] == o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`
    : `<div class="row" style="margin:6px 0"><span>${label}</span><button data-k="${k}" class="${settings[k] ? 'primary' : ''}" style="flex:0 0 80px">${settings[k] ? 'On' : 'Off'}</button></div>`).join('') + '<button id="rs">Reset to defaults</button>');
  el.querySelectorAll('button[data-k]').forEach(b => b.onclick = () => { settings[b.dataset.k] = !settings[b.dataset.k]; saveSettings(); G.applySettings(); G.ui.close(); openSettings(G); });
  el.querySelectorAll('select[data-k]').forEach(s => s.onchange = () => { const v = s.value; settings[s.dataset.k] = isNaN(+v) ? v : +v; saveSettings(); G.applySettings(); });
  el.querySelector('#rs').onclick = () => { Object.assign(settings, defaults); saveSettings(); G.applySettings(); G.ui.close(); openSettings(G); };
}
const SRC = { saw: 'saw it', heard: 'heard it', log: 'from a log/record', told: 'was told', self: 'firsthand' };
export function openInsight(G) {
  G.ui.open('Coworker AI insight', `<p class="dim">This is a transparent view of each coworker's memories about you, where they got each one, and how those memories shape their trust, respect, and rapport. NPCs only know what they personally saw, heard, read in a log, or were told.</p>` +
    `<p>Your playstyle as the adaptive director reads it: <b>${G.director.style()}</b></p>` +
    G.npcs.map(n => { const o = n.memory.op; const mem = n.memory.entries.filter(e => e.subject === 'player' && e.type !== 'first_meet').sort((a, b) => b.t - a.t).slice(0, 6);
      return `<div class="wo"><b>${esc(n.name)}</b> <span class="dim">${esc(n.def.role)}</span><br>Trust ${Math.round(o.tru * 100)} • Respect ${Math.round(o.res * 100)} • Rapport ${Math.round(o.aff * 100)} • Mood ${n.emotion.valence > 0.3 ? 'good' : n.emotion.valence < 0 ? 'low' : 'okay'}
      <br><span class="dim">Doing: ${esc(n._labelText.split('• ')[1] || '')} • top options considered: ${(n.lastScores || []).map(([k, s]) => `${k} ${s}`).join(', ')}</span>
      ${mem.map(e => `<div class="mem">${esc(e.type.replace(/_/g, ' '))}${e.count > 1 ? ` ×${e.count}` : ''} <span class="dim">(${SRC[e.source]}${e.from ? ' by ' + G.npcs.find(x => x.id === e.from).name.split(' ')[0] : ''})</span></div>`).join('') || '<div class="mem dim">No notable memories of you yet.</div>'}</div>`; }).join(''));
}

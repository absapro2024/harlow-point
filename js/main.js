// Harlow Point: Shift Work — Milestone 1 bootstrap and game glue.
// Wires systems together. Each system lives in its own module (see docs/DESIGN.md §2).
import * as THREE from '../vendor/three.module.js';
import { bus } from './core/events.js';
import { Clock } from './core/clock.js';
import { settings } from './core/settings.js';
import { writeSave, readSave } from './core/save.js';
import { buildFacility, POINTS, roomAt, ROOMS } from './world/facility.js';
import { lineOfSight } from './world/nav.js';
import { box, cyl } from './world/builder.js';
import { Controls } from './player/controls.js';
import { Player } from './player/player.js';
import { Doors, checkAccess } from './systems/access.js';
import { Weather } from './systems/weather.js';
import { PlantState } from './systems/plant.js';
import { Missions } from './systems/missions.js';
import { Radio } from './systems/radio.js';
import { NPCS } from './data/npcs.js';
import { NPC, AIManager } from './ai/npc.js';
import { Director } from './ai/director.js';
import { canSee } from './ai/perception.js';
import { UI } from './ui/hud.js';
import { openDialogue, openTerminal, openWO, openDoc, openMenu, openInsight } from './ui/panels.js';
import { titleScreen, characterCreation } from './ui/chargen.js';
import { openSim } from './ui/minigame.js';
import { POLICY } from './data/training.js';

// ------------------------------------------------------------------ iOS-only gate
const params = new URLSearchParams(location.search);
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const DEV = params.has('dev');
const DESKTOP = !('ontouchstart' in window) && navigator.maxTouchPoints === 0;
if (DESKTOP) document.body.classList.add('desktop');
const NATIVE = !!window.Capacitor?.isNativePlatform?.();
if ('serviceWorker' in navigator && !DEV && !NATIVE) navigator.serviceWorker.register('sw.js').catch(() => {});

// ------------------------------------------------------------------ renderer / scene
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 160);
const hemi = new THREE.HemisphereLight(0xffffff, 0x556070, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dd, 1.2); sun.position.set(20, 30, 25); scene.add(sun);
const indoor = new THREE.AmbientLight(0xfff8ee, 0.45); scene.add(indoor);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const world = buildFacility(scene);
world.doorById = Object.fromEntries(world.doors.map(d => [d.id, d]));

// ------------------------------------------------------------------ audio (WebAudio placeholder tones)
const audio = (() => { let ctx; const tone = (f, d = 0.12, type = 'sine', v = 0.08, when = 0) => { if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.value = v; o.connect(g).connect(ctx.destination); const t = ctx.currentTime + when; o.start(t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.stop(t + d + 0.02); };
  return { unlock() { if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); } ctx.resume(); }, ok() { tone(880, 0.1); tone(1320, 0.12, 'sine', 0.06, 0.08); }, deny() { tone(220, 0.25, 'square', 0.05); },
    chime() { tone(660, 0.4); tone(523, 0.5, 'sine', 0.08, 0.35); }, radio() { tone(1400, 0.05, 'square', 0.03); }, alarm() { tone(440, 0.6, 'triangle', 0.05); tone(554, 0.6, 'triangle', 0.05, 0.6); } }; })();

// ------------------------------------------------------------------ game state object
const G = {
  scene, world, audio, settings, clock: new Clock(), time: 0, paused: true, emergency: false, sprintToggle: false, items: [], drillDone: false,
  get now() { return this.clock.day * 1440 + this.clock.minute; },
  ext: { status: {}, recorded: {} },
  settingsReduced: () => settings.reducedReading,
};
G.player = new Player(camera);
G.ui = new UI(G);
G.weather = new Weather(scene);
G.plant = new PlantState();
G.radio = new Radio(G);
G.doors = new Doors(world);
G.npcs = NPCS.map(d => new NPC(d, scene));
G.missions = new Missions(G);
G.director = new Director(G);
G.ai = new AIManager(G);
const controls = new Controls(canvas);
G.setPaused = (p) => { G.paused = p; controls.enabled = !p; if (p) { if (document.pointerLockElement) document.exitPointerLock(); controls.reset(); G.ui.prompt(null); document.getElementById('hint').classList.add('hidden'); } };
G.escorted = () => G.npcs.some(n => n.goal?.kind === 'escort' && Math.hypot(n.x - G.player.x, n.z - G.player.z) < 4);
G.applySettings = () => { document.body.classList.toggle('cb', settings.colorBlind); document.body.classList.toggle('lefty', settings.leftHanded); G.clock.scale = 0.25 * settings.timeScale;
  for (const n of G.npcs) { const l = n._labelText; n._labelText = ''; n.setLabel(settings.showAIThoughts ? l : n.name); } };
G.applySettings();
// Randomize extinguisher tags: one is out of date (fictional monthly check).
const exts = ['ext_1', 'ext_2', 'ext_3']; const bad = exts[Math.floor(Math.random() * 3)];
for (const e of exts) G.ext.status[e] = e === bad ? 'TAG OUT OF DATE' : 'OK';

// ------------------------------------------------------------------ helpers used by AI/dialogue
const WHERE = {
  'ia:ppe_cabinet': 'The PPE cabinet is in the Locker Room. Go through the turnstile, then take the first door on the left off the main corridor.',
  'ia:radio_charger': 'Radios charge in the Ops Training Office: second door on the right down the corridor, on the far wall.',
  'ia:policy_shelf': 'The Safety Handbook is on the bookshelf in Classroom 1, first door on the right, back left corner.',
  'ia:train_terminal': 'Training terminal TT-01 is in Classroom 1, first door on the right, in the far corner by the window wall.',
  'ia:fountain': 'The break room is the second door on the left. The water fountain is on the far wall.',
  'ia:wo_terminal': 'The WO-03 terminal is on the desk in the Ops Training Office, second door on the right.',
  'ia:sim_console': 'The trainer console is in the middle of the Simulator Hall at the end of the corridor.',
  'ia:ext_1': 'FE-C1 is on the corridor wall, near the middle.', 'ia:ext_2': 'FE-L1 is in the lobby, on the east wall near the turnstile.', 'ia:ext_3': 'FE-B1 is in the far corner of the break room.',
  'door:turnstile': 'The turnstile is at the back of the lobby. Tap your badge on the reader.', 'door:sim_door': 'The Simulator Hall door is at the end of the main corridor. Badge in, and wear PPE.',
};
G.directions = (step, npc) => {
  const t = step.target;
  if (t.startsWith('npc:')) {
    const other = G.npcs.find(n => n.id === t.slice(4));
    if (other === npc) return 'You\'re looking for me. Go ahead and pick that topic when we talk.';
    if (canSee(npc, other.x, other.z, world)) return `${other.name.split(' ')[0]}'s right over there.`;
    const sched = other.def.schedule.find(([a, b]) => G.clock.minute >= a && G.clock.minute < b);
    const room = sched ? roomAt(...POINTS[sched[3]]).name : 'around';
    return `${other.name} is usually in the ${room} around now, but I haven't seen ${other.def.id === 'dana' ? 'her' : other.def.id === 'marcus' || other.def.id === 'tom' ? 'him' : 'her'} lately.`;
  }
  return WHERE[t] || 'Check your WO list for details.';
};
G.objectiveTarget = () => {
  if (G.emergency) return POINTS.assembly;
  const s = G.missions.currentStep(); if (!s) return null;
  const [k, id] = s.target.split(':');
  if (k === 'npc') { const n = G.npcs.find(x => x.id === id); return [n.x, n.z]; }
  if (k === 'ia') { const i = world.interactables.find(x => x.id === id); return [i.x, i.z]; }
  if (k === 'door') { const d = world.doorById[id]; return [d.x, d.z + (G.player.z > d.z ? 0.8 : -0.8)]; }
  if (k === 'pt') return POINTS[id];
};
G.issueBadge = () => { G.player.cred.badgeId = 'HP-' + (40000 + Math.floor(Math.random() * 9999)); G.audio.ok(); G.ui.toast(`Badge ${G.player.cred.badgeId} issued: Tier 0 (trainee)`); G.ui.hint('badge', 'Doors with readers need a badge tap: look at the reader or door and tap ✋.'); };
G.removeLostItem = () => { for (const it of G.items) scene.remove(it.mesh); G.items = []; };
G.submitExtDoc = () => {
  const correct = exts.every(e => G.ext.recorded[e] === G.ext.status[e]);
  const s = G.missions.wos['WO-0002']; s.quality.push(correct ? 1 : 0.4);
  if (!correct) { G.ui.toast('Supervisor review: one of your recorded tag results does not match. Check your focus and fatigue.'); G.npcs.find(n => n.id === 'marcus').memory.add('failed_training', { t: G.now, source: 'log' }); }
  bus.emit('wo_document', { id: 'WO-0002' });
};
G.save = () => { writeSave(1, serialize()); G.ui.toast('Game saved'); };
G.autosave = () => { if (G.started) writeSave(1, serialize()); };
G.loadGame = () => { const d = readSave(1); if (!d) return; deserialize(d); G.ui.toast('Save loaded'); };

// ------------------------------------------------------------------ lost item (an NPC "mistake" that drives emergent play)
const DROP = [[-7, 5, 0.5, 'Locker Room bench'], [6, 18.8, 0.5, 'Lobby bench'], [4.5, 3.6, 0.8, 'Classroom 1 table'], [-6, -9.6, 0.93, 'Break-room counter'], [6.4, -8.6, 0.83, 'Ops office desk']];
function spawnFlashlight(spot) {
  const [x, z, y] = spot; const m = cyl(scene, 0.04, 0.24, 0xf2c94c, x, y + 0.04, z); m.rotation.z = Math.PI / 2;
  G.items.push({ id: 'flashlight', x, z, y, mesh: m, spot });
}
G.clock.at(7 * 60 + 25, () => {
  const tom = G.npcs.find(n => n.id === 'tom'); if (tom.flags.lostOnce || tom.lostItem) return; tom.flags.lostOnce = true;
  spawnFlashlight(DROP[Math.floor(Math.random() * DROP.length)]);
  tom.lostItem = 'flashlight'; tom.beliefs.flashlight = { break_mid: 0.5, locker_mid: 0.35, corridor_mid: 0.3, lobby_mid: 0.25, training_mid: 0.2, office_mid: 0.15 };
  tom.favorHint = () => `Last I remember I was in the ${['break room', 'locker room', 'corridor'][Math.floor(Math.random() * 3)]}, but honestly, I've been all over the building.`;
  tom.say(G, 'Where did I put my flashlight…', { radio: false });
});
// ------------------------------------------------------------------ PA / clock events
G.clock.at(7 * 60, () => G.radio.pa(`Good morning, Cedar Ridge. Today's weather: ${G.weather.describe()}. ${G.plant.summary()}. Day shift has the watch.`));
G.clock.at(12 * 60, () => G.radio.pa('Reminder: take your meal break, and stay hydrated.'));
G.clock.at(18 * 60, () => { G.radio.pa('Shift turnover. Day shift, complete your handover notes.'); });
G.clock.at(0, () => { G.weather.setDay(G.clock.day); G.plant.dailyTick(); });
G.clock.at(9 * 60 + 30, () => scheduleDrill(1));
function scheduleDrill(delay) { if (G.drillDone || G.drillAt || settings.disableStressEvents) return; G.drillAt = G.now + delay; }
bus.on('quiz_pass', e => { if (e.id === 'GET-1') { scheduleDrill(6); G.radio.pa('Attention, Cedar Ridge: a site evacuation drill will be conducted this morning.'); } });
G.startDrill = () => { G.emergency = true; G.drillAt = null; G.radio.pa('This is a drill. This is a drill. A site evacuation drill is in progress. All Cedar Ridge personnel proceed to Assembly Area B and check in with Security. This is a drill.'); G.audio.alarm(); G.player.needs.addStress(8);
  G.ui.hint('drill', 'DRILL: Walk, don\'t run, to Assembly Area B in the parking lot. Reader doors are unlocked for exit.'); for (const n of G.npcs) { n.inConversation = false; n.goal = null; n.decideT = 0; } };
G.endDrill = (ok) => { G.emergency = false; G.drillDone = true; G.radio.pa('This is a drill. The drill is complete. All clear; you may return to work. This is a drill.'); G.player.needs.addStress(-6);
  if (ok) G.ui.banner('Drill complete', 'You were accounted for at Assembly Area B'); for (const n of G.npcs) { n.goal = null; n.steps = []; } };
G.endConversation = () => {};

// ------------------------------------------------------------------ interaction targeting
function findTarget() {
  const p = G.player, [fx, fz] = p.forward(); let best = null, bestS = 1e9;
  const consider = (x, z, maxD, obj) => {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d > maxD) return;
    const dot = (dx * fx + dz * fz) / (d || 1); if (dot < 0.8 && d > 0.8) return;
    if (!lineOfSight(world, p.x, p.z, x - dx / d * 0.15, z - dz / d * 0.15)) return;
    const s = d * (2 - dot) * (obj.npc ? 0.55 : obj.ia?.cat === 'background' ? 1.4 : 1); if (s < bestS) { bestS = s; best = obj; }
  };
  for (const n of G.npcs) consider(n.x, n.z, 3.2, { cat: 'talk', label: `Talk to ${n.name}`, npc: n });
  for (const it of world.interactables) consider(it.x, it.z, 2.6, { cat: it.cat, label: it.name, ia: it });
  for (const d of world.doors) if (d.reader) consider(d.x, d.z, 2.4, { cat: 'door', label: `${d.name}`, door: d });
  for (const it of G.items) consider(it.x, it.z, 2.2, { cat: 'use', label: 'Yellow flashlight ("T. BECKER" on tape)', item: it });
  return best;
}
let target = null;
document.getElementById('btnUse').addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); doInteract(); }, { passive: false });
document.getElementById('btnUse').addEventListener('click', () => doInteract());
addEventListener('keydown', e => {
  if (e.code === 'KeyE' && !G.paused) doInteract();
  if (e.code === 'Escape' && G.started) G.ui.modal ? G.ui.close() : openMenu(G);
  if (!G.started || G.ui.modal) return;
  if (e.code === 'KeyQ') openWO(G, false); if (e.code === 'KeyM') openMenu(G); if (e.code === 'KeyH') openTerminal(G, 'help'); if (e.code === 'KeyR' && G.player.hasRadio) openRadio();
});
const tap = (id, fn) => { const b = document.getElementById(id); b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false }); b.addEventListener('click', fn); };
tap('btnRun', () => { G.sprintToggle = !G.sprintToggle; if (G.sprintToggle && !roomAt(G.player.x, G.player.z).outdoor) G.ui.hint('run', 'Running indoors is discouraged. Coworkers notice and may remind you to walk.'); });
tap('btnMenu', () => openMenu(G)); tap('btnWO', () => openWO(G, false)); tap('btnHelp', () => openTerminal(G, 'help'));
tap('btnRadio', () => openRadio());

function doInteract() {
  if (!target || G.paused) return;
  audio.unlock();
  if (target.npc) return openDialogue(G, target.npc);
  if (target.door) return badgeDoor(target.door);
  if (target.item) { G.player.inv.push('flashlight'); G.removeLostItem(); G.ui.toast('Picked up: yellow flashlight (T. BECKER)'); G.ui.hint('item', 'Return the flashlight to its owner, or turn it in to Security\'s lost and found.'); return; }
  const it = target.ia; bus.emit('interact', { id: it.id });
  (HANDLERS[it.id] || (() => G.ui.info(it.name, `<p>${it.desc}</p><p class="dim">${{ background: 'Background equipment: not operable by you.', inspect: '', restricted: 'Restricted.' }[it.cat] || ''}</p>`)))(it);
}
function badgeDoor(d) {
  const p = G.player;
  const inside = Math.sign(d.axis === 'x' ? p.z - d.z : p.x - d.x) === d.insideSign;
  if (inside && d.rule !== 'protected_area') { d.holdUntil = G.time + 4; d.openedBy = 'player'; G.audio.ok(); G.doors.flash(d, true); if (d.id !== 'sim_door' || !G.missions.stepOpen('WO-0003', 'enter')) bus.emit('door_badge', { id: d.id + '_exit' }); return; }
  if (!p.cred.badgeId) { G.audio.deny(); G.ui.toast('You don\'t have a badge yet. Check in at the Security desk.'); return; }
  const r = G.doors.badge(d, 'player', p.cred, { escorted: G.escorted(), emergencyEgress: G.emergency }, G.time);
  if (r.ok) { G.audio.ok(); if (d.id === 'sim_door') G.ui.hint('ppe_line', 'Yellow line ahead: hard hat and safety glasses are required past it.'); }
  else { G.audio.deny(); p.needs.addStress(3); G.ui.info('Access denied', `<p><b>${d.name}</b></p>${r.reasons.map(x => `<p>⛔ ${x}</p>`).join('')}<p class="dim">Denied badge attempts are logged by Security.</p>`); }
}
function openRadio() {
  const el = G.ui.open('Radio: Cedar Ridge channel', `<div class="opts"><button id="r1">Call supervisor (Marcus): request guidance</button><button id="r2">Call Security (Dana)</button></div><h3>Recent traffic</h3>${G.radio.log.slice(-15).reverse().map(l => `<div class="mem">${l.t} <b>${l.from}</b>: ${l.text}</div>`).join('') || '<p class="dim">Quiet.</p>'}`);
  el.querySelector('#r1').onclick = () => { G.ui.close(); G.radio.transmit(G.player.name, 'Marcus, this is the new hire. Requesting guidance on my next task.'); const s = G.missions.currentStep(); const m = G.npcs.find(n => n.id === 'marcus');
    setTimeout(() => G.radio.transmit('Marcus Hale', s ? `Copy. Next step: ${s.text.replace('(Recommended) ', '')}. ${G.directions(s, m)}` : 'Copy. Check the WO-03 terminal for new work. Nice job today.'), 1800); G.director.note('ask_help'); m.memory.add('asked_help', { t: G.now, source: 'heard' }); };
  el.querySelector('#r2').onclick = () => { G.ui.close(); G.radio.transmit(G.player.name, 'Security, new hire. Radio check.'); setTimeout(() => G.radio.transmit('Dana Ruiz', 'Security copies, loud and clear. Keep traffic brief, please.'), 1500); };
}

// ------------------------------------------------------------------ interactable handlers
const n = () => G.player.needs;
const HANDLERS = {
  car_player: () => {
    const ready = G.missions.wos['WO-0001'].status === 'done' && (G.clock.minute >= 15 * 60 || ['WO-0002', 'WO-0003'].every(id => G.missions.wos[id].status === 'done'));
    if (!ready) return G.ui.info('Your car', '<p>Your shift isn\'t over yet. Finish orientation, then either complete your available work orders or wait until 15:00 to clock out.</p>');
    G.ui.choice('Clock out', 'End your shift and go home? The game will save and continue with your next shift.', [{ label: 'Clock out & go home', primary: true, fn: clockOut }, { label: 'Stay a bit longer' }]);
  },
  weather_station: () => G.ui.info('Site weather station', `<p>${G.weather.describe()}.</p><p class="dim">Weather affects outdoor work, hydration, and drills. Coastal fog is common at Harlow Point (fictional).</p>`),
  notice_lobby: () => { G.player.readDocs.includes('notice') || G.player.readDocs.push('notice'); G.director.note('read'); openDoc(G, 'Lobby notice board', ['SAFETY: Badge at every reader. No tailgating. Report injuries.', `TODAY: ${G.weather.describe()}. A site drill may be held this week.`, `PLANT STATUS (fictional): ${G.plant.summary()}.`, 'LOST & FOUND: Security desk.', 'NEW HIRES: Welcome! Orientation in Classroom 1 at 07:00.']); },
  visitor_log: (it) => G.ui.info(it.name, `<p>${it.desc}</p>`),
  poster_stop: (it) => { G.director.note('read'); G.ui.info(it.name, `<p>${it.desc}</p>`); },
  lp2_panel: (it) => G.ui.choice(it.name, it.desc + ' Qualified electrical maintenance only, under an assigned work order.', [{ label: 'Read the label and leave it', primary: true, fn: () => G.ui.toast('Good call. Not your equipment, not your work order.') },
    { label: 'Try to open the panel', fn: () => { bus.emit('violation', { kind: 'tried_panel', x: G.player.x, z: G.player.z }); G.audio.deny(); G.player.needs.addStress(5); G.ui.toast('The panel is locked. Opening equipment without authorization is a safety violation.'); } }]),
  locker_player: () => G.ui.choice('Your locker (#114)', 'Store personal items. This is also a safe place to save.', [{ label: 'Save game', primary: true, fn: () => G.save() }, { label: 'Close', fn: () => {} }]),
  ppe_cabinet: () => { const p = G.player; if (p.ppe.hardhat) return G.ui.choice('PPE issue cabinet', 'You already have a hard hat and safety glasses.', [{ label: 'Keep them', primary: true }, { label: 'Return PPE', fn: () => { p.ppe.hardhat = p.ppe.glasses = false; } }]);
    p.ppe.hardhat = p.ppe.glasses = true; G.ui.toast('Issued: hard hat + safety glasses (worn)'); G.audio.ok(); },
  sink: () => { n().addStress(-2); G.ui.toast('You wash your hands. Good habits.'); },
  first_aid: (it) => G.ui.info(it.name, `<p>${it.desc}</p>`),
  fountain: () => { n().hydration = Math.min(100, n().hydration + 40); G.ui.toast('💧 Water. You feel more alert.'); },
  coffee: () => { G.cups = (G.cups || 0) + 1; n().energy = Math.min(100, n().energy + 10); n().hydration = Math.min(100, n().hydration + 2);
    if (G.cups > 3) { n().addStress(6); G.ui.toast('☕ That\'s a lot of coffee. You feel jittery (stress up).'); } else { n().addStress(-2); G.ui.toast('☕ Coffee. A small energy boost.'); } },
  vending: () => { n().nutrition = Math.min(100, n().nutrition + 30); G.ui.toast('🍽 Granola bar and an apple.'); },
  bench: () => G.ui.choice('Break table', 'Take a 15-minute break? Time will pass.', [{ label: 'Rest 15 minutes', primary: true, fn: () => { G.clock.advance(15); n().energy = Math.min(100, n().energy + 15); n().addStress(-10); G.ui.toast('You rest. Energy and stress improve.'); } }, { label: 'Not now' }]),
  break_board: () => openDoc(G, 'Break-room board', ['"Who keeps leaving lids in the microwave?" (Facilities)', '"Lost & found is at the Security desk!" (D. Ruiz)', '"Softball Thursday, all shifts welcome." (T. Becker)', `Days until Unit 2 planned outage (fictional): ${G.plant.outageDaysAway}`]),
  train_terminal: () => { openTerminal(G, 'library'); },
  whiteboard: () => openDoc(G, 'Whiteboard', ['TODAY: New Employee Orientation. Instructor L. Okafor.', '07:00 Welcome • GET-1 at terminal TT-01 • Break-room tour • Report to M. Hale', 'Reminder: STAR, three-way communication, questioning attitude.']),
  policy_shelf: () => openDoc(G, 'Safety Handbook & Policy Manual (FICTIONAL)', POLICY, G.player.readDocs.includes('handbook') ? {} : { sign: { label: 'I have read this: sign the acknowledgment sheet', fn: () => { G.player.readDocs.push('handbook'); G.player.readTimes.handbook = G.now; G.director.note('read'); bus.emit('read', { id: 'handbook' }); } } }),
  shift_log: () => openDoc(G, 'Shift log: Ops Training (fictional)', ['NIGHT → DAY HANDOVER', '• Simulator trainer reset and ready. Priya on mockup today.', '• Corridor light LP-2 circuit 4 flickering. Electrical WO written, do not touch.', '• New hire starts today; badge processing at Security 06:45.', `• ${G.plant.summary()}`]),
  wo_terminal: () => openWO(G, true),
  radio_charger: () => { if (G.player.hasRadio) return G.ui.toast('You already have a radio.'); G.player.hasRadio = true; G.audio.radio(); G.ui.toast('📻 Radio issued. You will now hear radio traffic.'); G.ui.hint('radio', 'Tap 📻 to see traffic or call your supervisor. Keep it brief and professional.'); },
  sim_console: () => { if (!G.missions.stepDone('WO-0003', 'brief')) return G.ui.info('Unit-Balance Trainer', `<p>${G.missions.wos['WO-0003'].status === 'active' ? 'Get your pre-job brief from Priya Natarajan before starting.' : 'Accept WO-0003 at the WO-03 terminal first.'}</p>`); openSim(G); },
  pa_reader: () => badgeDoor(world.doorById.pa_door),
};
for (const e of exts) HANDLERS[e] = (it) => {
  const active = G.missions.stepOpen('WO-0002', { ext_1: 'e1', ext_2: 'e2', ext_3: 'e3' }[e]);
  const truth = G.ext.status[e], f = n().focus;
  const html = `<p>Pressure gauge: in the green (fictional). Pin and tamper seal: intact.</p><p>Inspection tag: <b>${truth === 'OK' ? 'Current, initialed last month' : 'Last initial is three months old'}</b></p>`;
  if (!active) return G.ui.info(it.name, html + '<p class="dim">Extinguisher checks are done under WO-0002.</p>');
  const misread = f < 45 && Math.random() < 0.45;
  if (misread) G.ui.toast('You\'re tired and the tag is hard to focus on…');
  const el = G.ui.open(it.name + ': record finding', html.replace(truth === 'OK' ? 'Current, initialed last month' : 'Last initial is three months old', misread ? '(hard to read, smudged)' : (truth === 'OK' ? 'Current, initialed last month' : 'Last initial is three months old')) + `<div class="opts"><button data-v="OK">Record: OK</button><button data-v="TAG OUT OF DATE">Record: Tag out of date</button></div>`);
  el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { G.ext.recorded[e] = b.dataset.v; G.ui.close(); bus.emit('inspect_ext', { id: e }); });
};

// ------------------------------------------------------------------ end of shift → next day (persistent calendar)
function clockOut() {
  const p = G.player, late = Math.max(0, G.clock.minute - 18 * 60) / 60;
  const done = G.missions.list().filter(({ s }) => s.status === 'done').map(({ t }) => t.id);
  const ops = G.npcs.map(n => `${n.name.split(' ')[0]} ${Math.round(n.memory.disposition * 100)}`).join(' • ');
  // overnight: sleep quality depends on how late you left and how stressed you were
  p.needs.sleepQuality = Math.max(40, Math.min(100, 95 - late * 12 - p.needs.stress * 0.3));
  G.clock.day += 1; G.clock.minute = 6 * 60 + 40; G.weather.setDay(G.clock.day); G.plant.dailyTick();
  Object.assign(p.needs, { energy: p.needs.sleepQuality, hydration: 85, nutrition: 80, stress: Math.max(10, p.needs.stress * 0.5), strain: 0 });
  p.x = 0; p.z = 34; p.yaw = Math.PI; G.cups = 0; G.drillDone = true; G.emergency = false;
  // daily rounds regenerate
  const w2 = G.missions.wos['WO-0002']; if (w2.status !== 'locked') { Object.assign(w2, { status: 'available', done: {}, quality: [] }); const nb = exts[Math.floor(Math.random() * 3)]; for (const e of exts) G.ext.status[e] = e === nb ? 'TAG OUT OF DATE' : 'OK'; G.ext.recorded = {}; }
  for (const n of G.npcs) { n.goal = null; n.steps = []; const st = POINTS[n.def.schedule[0][3]]; n.x = st[0]; n.z = st[1]; n.flags.lostOnce = Math.random() < 0.6; n.needs.energy = 95; n.needs.hydration = 90; }
  G.removeLostItem();
  G.autosave();
  G.ui.open(`Shift summary: Day ${G.clock.day}`, `<p>Work orders completed so far: ${done.join(', ') || 'none'}</p><p>Safety violations on record: ${p.stats.violations}</p><p>Badge: Tier ${p.cred.tier} • Qualifications: ${p.cred.quals.join(', ')}</p><p>Coworker regard: ${ops}</p><p>Sleep quality last night: ${Math.round(p.needs.sleepQuality)}%${late > 0 ? ' (you stayed late)' : ''}</p><p class="dim">New day: ${G.clock.dayName}, ${G.weather.describe()}. Daily rounds (WO-0002) are available again at the WO-03 terminal.</p>`);
}

// ------------------------------------------------------------------ save / load
function serialize() {
  return { clock: G.clock.toJSON(), weatherDay: G.weather.day, player: G.player.toJSON(), npcs: G.npcs.map(n => n.toJSON()), missions: G.missions.toJSON(), plant: G.plant.toJSON(),
    director: G.director.toJSON(), ext: G.ext, emergency: false, drillDone: G.drillDone, drillAt: G.drillAt || null, items: G.items.map(i => i.spot), cups: G.cups || 0 };
}
function deserialize(d) {
  G.clock.load(d.clock); G.weather.setDay(d.weatherDay); G.player.load(d.player);
  for (const nd of d.npcs) G.npcs.find(n => n.id === nd.id)?.load(nd);
  G.missions.load(d.missions); G.plant.load(d.plant); G.director.load(d.director); G.ext = d.ext; G.drillDone = d.drillDone; G.drillAt = d.drillAt; G.emergency = false; G.cups = d.cups;
  G.removeLostItem(); for (const s of d.items || []) spawnFlashlight(s);
  const tom = G.npcs.find(n => n.id === 'tom'); if (tom.lostItem) tom.favorHint = () => 'I\'ve been all over the building. It could be anywhere.';
  for (const n of G.npcs) n.setLabel(n.name);
  startPlay();
}

// ------------------------------------------------------------------ boot flow
function startPlay() { document.getElementById('hud').classList.remove('hidden'); document.getElementById('overlay').innerHTML = ''; G.started = true; G.setPaused(false); audio.unlock(); }
titleScreen(() => { audio.unlock(); characterCreation(profile => {
  G.player.profile = profile; startPlay();
  G.ui.banner('Monday, 06:40', 'Cedar Ridge Training Center • Harlow Point Generating Station (fictional)', 5500);
  setTimeout(() => G.ui.hint('move', DESKTOP ? 'Click the game to look with the mouse. W A S D to walk, E to interact, hold Shift to run, Q work orders, Esc menu. Head inside to the Security desk.' : 'Drag the left side to walk and the right side to look. Head inside to the Security desk.'), 1200);
  G.autosave();
}); }, () => { audio.unlock(); G.loadGame(); });

// ------------------------------------------------------------------ main loop
let last = performance.now();
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  if (!G.paused && G.started) {
    G.time += dt;
    const gm = dt * G.clock.scale; G.clock.tick(dt);
    G.player.update(dt, controls.read(), world, G.npcs, G.sprintToggle || !!controls.keys.ShiftLeft || !!controls.keys.ShiftRight);
    G.player.needs.update(gm, { sprinting: G.player.sprinting, warm: false });
    G.ai.update(dt, gm);
    G.director.update(gm, dt);
    G.doors.update(dt, G.time, [G.player, ...G.npcs], G.player, G.emergency);
    if (G.drillAt && G.now >= G.drillAt && !G.emergency) G.startDrill();
    if (G.emergency && Math.random() < dt / 6) audio.alarm();
    target = findTarget(); G.ui.prompt(target);
    if (target && target.cat !== 'talk') G.ui.hint('interact', 'When a prompt appears, tap ✋. The tag shows the type: Inspect, Use, Restricted, or Background.');
    if (target?.cat === 'talk') G.ui.hint('talk', 'Tap ✋ to talk. Coworkers remember how you treat them and what they see you do.');
    const nd = G.player.needs; if (nd.hydration < 35) G.ui.hint('thirst', 'You\'re getting thirsty. Focus drops when you\'re dehydrated. The break room has a fountain.');
    if (nd.energy < 30) G.ui.hint('tired', 'You\'re fatigued. Rest at the break table or tell your supervisor. Low focus lowers work quality.');
    if (Math.floor(G.time) % 30 === 0 && Math.floor(G.time - dt) % 30 !== 0) G.autosave();
  }
  G.weather.update(dt, G.clock.hour, sun, hemi);
  if (G.started) G.ui.update(G);
  for (const it of G.items) it.mesh.rotation.y += dt;
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
// Expose for debugging in dev mode
if (DEV) { window.G = G; window.DBG = { bus, doInteract, findTarget, badgeDoor, HANDLERS, setT: () => (target = findTarget()) }; }

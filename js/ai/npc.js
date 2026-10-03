// NPC agent + AI manager.
// Layers (bottom → top):
//  1. Reliable game logic: navigation, doors and badges, rule checks, collision-free paths
//  2. Perception: sight cone + LOS + reaction delay + attention; hearing; logs; radio; gossip
//  3. Memory & opinion: episodic memories with source + salience → trust / respect / affinity
//  4. Utility scoring: picks the goal that matters most right now (needs, schedule, social, player)
//  5. Planner: turns the goal into concrete steps (methods branch on beliefs)
//  6. Expression: personality-driven barks, dialogue, radio, and visible "thought" labels
import * as THREE from '../../vendor/three.module.js';
import { bus } from '../core/events.js';
import { box, labelSprite, mat } from '../world/builder.js';
import { POINTS, roomAt } from '../world/facility.js';
import { findPath } from '../world/nav.js';
import { checkAccess } from '../systems/access.js';
import { Memory } from './memory.js';
import { canSee, canHear, attention } from './perception.js';
import { choose, curve, clamp } from './utility.js';
import { plan } from './planner.js';
import { tone, gossipText } from './dialogue.js';
import { settings } from '../core/settings.js';

const READER_NODES = { '0,10': 'turnstile', '0,-10': 'sim_door' };
const ACTIVITY = {
  supervise_class: ['work', 'supervising class'], office_work: ['work', 'paperwork'], teach: ['work', 'teaching'], sim_prep: ['work', 'prepping simulator'],
  maintenance: ['work', 'repairing'], security_post: ['work', 'watching the desk'], coffee_break: ['coffee', 'coffee break'], lunch: ['lunch', 'lunch'], off: ['off', 'off shift'],
};
const GOAL_LABEL = { hydrate: 'getting water', coffee: 'getting coffee', rest: 'taking a break', socialize: 'chatting', greet_player: 'saying hi', correct_player: 'coming to talk to you',
  help_player: 'coming to help', investigate: 'checking a noise', evacuate: 'evacuating (drill)', headcount: 'headcount (drill)', escort: 'escorting you', search: 'searching for flashlight',
  verify_claim: 'checking a sheet', return_item: 'returning an item', ask_player: 'wants to ask you', patrol: 'on patrol', off: 'off shift' };

export class NPC {
  constructor(def, scene) {
    this.def = def; this.id = def.id; this.name = def.name; this.traits = def.traits;
    this.cred = { badgeId: 'E-' + def.id, tier: def.tier, quals: def.quals.slice(), securityHold: false };
    const start = POINTS[def.schedule[0][3]] || [0, 0];
    this.x = start[0] + (Math.random() - 0.5); this.z = start[1] + (Math.random() - 0.5); this.yaw = Math.PI;
    this.fov = THREE.MathUtils.degToRad(110 + def.traits.curiosity * 30); this.sightRange = 13 + def.traits.curiosity * 4;
    this.reactionDelay = 0.35 + (1 - def.traits.confidence) * 0.5; // seconds of continuous sight before "noticing"
    this.memory = new Memory(this);
    this.needs = { hydration: 70 + Math.random() * 30, energy: 75 + Math.random() * 25, social: Math.random() * 40 };
    this.emotion = { valence: 0.2, arousal: 0.2, stress: 0.1, confidence: def.traits.confidence };
    this.rel = {}; this.beliefs = {}; this.cooldowns = {}; this.flags = {}; this.queue = []; this.recentLines = [];
    this.goal = null; this.steps = []; this.stepState = null; this.decideT = Math.random(); this.percT = Math.random() * 0.25;
    this.seeT = 0; this.seesPlayer = false; this.lastSeenPlayer = null; this.greetedDay = -1; this.nextPatrol = 0; this.heard = null;
    this.concern = null; this.correctedAt = -999; this.pendingClaim = null; this.favorPending = false; this.lostItem = null; this.inConversation = false;
    this.buildMesh(scene);
  }
  buildMesh(scene) { // PLACEHOLDER_ASSET: capsule-style worker figure
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.1, 10), mat(this.def.color)); body.position.y = 0.95; g.add(body);
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.45, 8), mat(0x2b3138)); legs.position.y = 0.22; g.add(legs);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mat([0xc68e63, 0x8d5a3b, 0xe0b48f, 0x5a3825, 0xb07850][this.def.name.length % 5])); head.position.y = 1.68; g.add(head);
    if (this.def.hardhat) { const hh = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(this.def.hardhat)); hh.position.y = 1.73; g.add(hh); }
    const vis = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), mat(0x111111)); vis.position.set(0, 1.7, 0.15); g.add(vis); // eyes = facing cue
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.02), mat(0xffffff)); badge.position.set(0.1, 1.25, 0.27); g.add(badge);
    this.label = labelSprite(this.def.name); this.label.position.y = 2.15; g.add(this.label);
    this.group = g; this.body = body; scene.add(g); this._labelText = '';
  }
  setLabel(text) { if (text === this._labelText) return; this._labelText = text; const old = this.label; this.label = labelSprite(text, '#e8f4ff'); this.label.scale.set(1.5, 0.37, 1); this.label.position.y = 2.15; this.group.remove(old); this.group.add(this.label); old.material.map.dispose(); }
  queueGoal(g) { this.queue.push(g); this.decideT = 0; }
  say(G, text, { radio = false } = {}) {
    this.lastSaid = text;
    const p = G.player, d = Math.hypot(p.x - this.x, p.z - this.z);
    const audible = d < 6 || (d < 13 && canHear(this, p.x, p.z, 13, G.world));
    if (radio) G.radio.transmit(this.name, text);
    else if (audible) G.ui.subtitle(this.name, text);
  }

  // ------------------------------------------------ perception
  perceive(G, dt) {
    const p = G.player;
    const vis = canSee(this, p.x, p.z, G.world);
    this.seeT = vis ? this.seeT + dt : 0;
    const was = this.seesPlayer;
    this.seesPlayer = this.seeT >= this.reactionDelay * (1 + this.emotion.stress);
    if (this.seesPlayer) {
      this.lastSeenPlayer = { x: p.x, z: p.z, t: G.now };
      // continuous observations of the player's conduct
      const room = roomAt(p.x, p.z);
      if (room.id === 'sim' && p.z < -11 && !(p.ppe.hardhat && p.ppe.glasses) && !G.emergency) G.ai.observeViolation(this, 'no_ppe', G);
      if (p.sprinting && !room.outdoor && (this.cooldowns.ranNote || 0) < G.now) { this.cooldowns.ranNote = G.now + 20; G.ai.observeViolation(this, G.emergency ? 'ran_in_drill' : 'ran_indoors', G); }
    }
    if (!was && this.seesPlayer) bus.emit('npc_noticed_player', { npc: this.id });
    // objects: lost items are perceived like anything else
    for (const it of G.items) if (!this.memory.latest('saw_item', it.id) && canSee(this, it.x, it.z, G.world, { range: 6 })) {
      this.memory.add('saw_item', { subject: it.id, t: G.now, source: 'saw', data: { pos: [it.x, it.z], place: roomAt(it.x, it.z).name } });
      if (this.lostItem === it.id) this.checkForItem(G, it.id);
    }
  }
  // ------------------------------------------------ decision (utility)
  decide(G) {
    const now = G.now, p = G.player, c = [];
    const dist = Math.hypot(p.x - this.x, p.z - this.z);
    const tr = this.traits;
    if (G.emergency) c.push({ kind: this.id === 'dana' ? 'headcount' : 'evacuate', score: 1.5 });
    for (const q of this.queue) c.push(q);
    const sched = this.def.schedule.find(([a, b]) => G.clock.minute >= a && G.clock.minute < b) || this.def.schedule[0];
    const [kind, label] = ACTIVITY[sched[2]] || ['work', sched[2]];
    c.push({ kind, place: sched[3], label, key: sched[3], score: kind === 'off' ? 0.9 : kind === 'lunch' ? 0.62 : kind === 'coffee' ? 0.5 : 0.36 + tr.conscientious * 0.18 });
    if (this.id === 'dana' && now > this.nextPatrol) c.push({ kind: 'patrol', hotspots: G.director.hotspots, score: 0.55 + (G.director.hotspots.length ? 0.15 : 0) });
    // needs
    c.push({ kind: 'hydrate', score: curve.logistic(1 - this.needs.hydration / 100, 0.6, 9) * 0.8 });
    c.push({ kind: 'coffee', score: curve.logistic(1 - this.needs.energy / 100, 0.55, 8) * 0.55 * (this.id === 'tom' ? 1.3 : 1) });
    c.push({ kind: 'rest', score: curve.logistic(1 - this.needs.energy / 100, 0.75, 10) * 0.7 });
    // social with coworkers
    if (this.needs.social > 55) {
      const mate = G.npcs.filter(o => o !== this && !['evacuate', 'headcount', 'escort'].includes(o.goal?.kind) && Math.hypot(o.x - this.x, o.z - this.z) < 9 && roomAt(o.x, o.z) === roomAt(this.x, this.z))
        .sort((a, b) => (this.rel[b.id] || 0.5) - (this.rel[a.id] || 0.5))[0];
      if (mate) c.push({ kind: 'socialize', target: mate.id, key: mate.id, score: (this.needs.social / 100) * (0.25 + tr.talkative * 0.45) });
    }
    // player-directed goals (all require that this NPC knows where the player is)
    const knows = this.lastSeenPlayer && now - this.lastSeenPlayer.t < 3;
    if (this.concern && knows && now - this.correctedAt > 30 && !this.inConversation) c.push({ kind: 'correct_player', concern: this.concern, score: 0.55 + tr.strictness * 0.35 });
    // serious concerns: if the player can't be seen, ask for them over the radio (only if the player carries one)
    if (this.concern && !knows && ['lied', 'lied_late', 'missed_drill'].includes(this.concern) && now - this.correctedAt > 30 && !this.flags.radioed && G.player.hasRadio) {
      this.flags.radioed = true; this.say(G, `${G.player.name.split(' ')[0]}, ${this.name.split(' ')[0]}. When you get a minute, come find me. I need a quick word.`, { radio: true });
    }
    if (this.seesPlayer && dist < 9 && this.greetedDay !== G.clock.day && tr.warmth > 0.6 && this.memory.has('first_meet') === false && this.id !== 'dana' && this.id !== 'marcus')
      c.push({ kind: 'greet_player', score: 0.35 + tr.warmth * 0.35 });
    if (this.seesPlayer && G.director.wantsHelp(this) && dist < 14) c.push({ kind: 'help_player', score: 0.45 + tr.warmth * tr.patience * 0.5 });
    if (this.lostItem && this.seesPlayer && dist < 10 && !this.favorPending && this.memory.op.aff > 0.42) c.push({ kind: 'ask_player', favor: this.lostItem, score: 0.6 });
    if (this.lostItem) c.push({ kind: 'search', item: this.lostItem, score: 0.6 + (1 - tr.conscientious) * 0.1 });
    if (this.pendingClaim && now - this.pendingClaim.t > 15) c.push({ kind: 'verify_claim', claim: this.pendingClaim, score: 0.52 });
    if (this.heard && now - this.heard.t < 10) c.push({ kind: 'investigate', pos: this.heard.pos, key: this.heard.pos.join(), what: this.heard.what, score: 0.3 + tr.curiosity * 0.35 });
    if (this.inConversation) { this.setGoal({ kind: 'talking', score: 2 }, G, []); return; }
    const best = choose(this, c, now);
    if (best && (!this.goal || best.kind !== this.goal.kind || (best.key || '') !== (this.goal.key || ''))) this.setGoal(best, G);
  }
  setGoal(g, G, steps) {
    if (this.goal && this.goal.kind === g.kind && (this.goal.key || '') === (g.key || '') && this.steps.length) return;
    this.queue = this.queue.filter(q => q !== g);
    this.goal = g; this.steps = steps || plan(g, this, G); this.stepState = null;
    const lbl = g.kind === 'talking' ? 'talking with you' : g.label && ['work', 'lunch', 'coffee', 'off'].includes(g.kind) ? g.label : GOAL_LABEL[g.kind] || g.kind;
    this.setLabel(settings.showAIThoughts === false ? this.name : `${this.name.split(' ')[0]} • ${lbl}`);
    if (g.kind === 'patrol') this.nextPatrol = G.now + 45 + Math.random() * 20;
  }
  finishGoal(G) { const k = this.goal?.kind; this.cooldowns[k] = G.now + ({ greet_player: 120, help_player: 15, socialize: 12, correct_player: 20, ask_player: 999, hydrate: 20, coffee: 50, rest: 60, investigate: 6 }[k] || 1); this.goal = null; this.steps = []; this.decideT = 0; }

  // ------------------------------------------------ plan execution
  update(G, dt, gameDt) {
    this.needs.hydration -= gameDt / 8; this.needs.energy -= gameDt / 10; this.needs.social = Math.min(100, this.needs.social + gameDt * (0.15 + this.traits.talkative * 0.35));
    this.emotion.valence += (0.15 - this.emotion.valence) * 0.002 * gameDt * 10; this.emotion.stress = Math.max(0, this.emotion.stress - gameDt * 0.004);
    this.memory.decay(gameDt);
    this.percT -= dt; if (this.percT <= 0) { this.percT = 0.2 + Math.random() * 0.1; this.perceive(G, 0.25); }
    this.decideT -= dt; if (this.decideT <= 0) { this.decideT = 0.6 + Math.random() * 0.5; this.decide(G); }
    if (this.inConversation) { this.faceTo(G.player.x, G.player.z, dt); this.animate(dt, false); return; }
    const s = this.steps[0];
    let moving = false;
    if (!s) { if (this.goal) this.finishGoal(G); this.animate(dt, false); return; }
    const st = this.stepState || (this.stepState = { t: 0 });
    st.t += dt;
    const done = () => { this.steps.shift(); this.stepState = null; };
    if (s.go || s.goNear) {
      let tgt = s.go;
      if (s.goNear) { const a = s.goNear === 'player' ? G.player : G.npcs.find(n => n.id === s.goNear); if (!a) return done(); tgt = [a.x, a.z];
        if (Math.hypot(a.x - this.x, a.z - this.z) < (s.dist || 1.6)) return done(); }
      if (!st.path || (s.goNear && Math.hypot(st.pathGoal[0] - tgt[0], st.pathGoal[1] - tgt[1]) > 1.5) || st.t > 40) { st.path = findPath(this.x, this.z, tgt[0], tgt[1]); st.pathGoal = tgt.slice(); st.t = Math.min(st.t, 39); }
      moving = this.followPath(G, st, dt, s.brisk || G.emergency);
      if (!moving && !st.path.length) return done();
    } else if (s.wait !== undefined || s.work !== undefined) { if (st.t > (s.wait ?? s.work) * (s.work ? 1 : 1)) done(); if (s.work) this.workIdle(dt, st); }
    else if (s.look !== undefined) { this.yaw += Math.sin(st.t * 1.4) * dt * 1.2; if (st.t > s.look) done(); }
    else if (s.face !== undefined) { if (s.face !== null) this.yaw = s.face; done(); }
    else if (s.facePlayer) { this.faceTo(G.player.x, G.player.z, dt * 3); if (st.t > 0.4) done(); }
    else if (s.faceAgent) { const o = G.npcs.find(n => n.id === s.faceAgent); if (o) this.faceTo(o.x, o.z, dt * 3); if (st.t > 0.3) done(); }
    else if (s.do) { s.do(this, G); done(); }
    else if (s.radio) { this.say(G, s.radio, { radio: true }); done(); }
    else if (s.greet) { this.greetedDay = G.clock.day; this.say(G, G.ai.bark(this, 'greet', G)); done(); }
    else if (s.correct) { this.correctedAt = G.now; this.flags.radioed = false; this.say(G, G.ai.bark(this, 'correct_' + s.correct, G)); G.player.needs.addStress(4); if (s.correct === 'tailgate') this.flags.tgDiscussed = true; done(); }
    else if (s.offerHelp) { const step = G.missions.currentStep(); if (step) this.say(G, G.ai.bark(this, 'help_intro', G) + ' ' + G.directions(step, this)); G.director.helped(); done(); }
    else if (s.askFavor) { this.favorPending = true; this.say(G, G.ai.bark(this, 'ask_flashlight', G)); bus.emit('favor_asked', { npc: this.id, item: s.askFavor }); done(); }
    else if (s.chat) { G.ai.chat(this, G.npcs.find(n => n.id === s.chat), G); done(); }
    else if (s.headcount) { G.ai.startHeadcount(this, G); done(); }
    else if (s.handover) { const to = G.npcs.find(n => n.id === s.handover.to); if (to) G.ai.handover(this, to, s.handover, G); done(); }
    else if (s.follow) {
      const p = G.player, d = Math.hypot(p.x - this.x, p.z - this.z);
      if (G.now > s.until) { this.say(G, 'Escort time\'s up. Let\'s head back out to the corridor.'); return done(); }
      if (d > 1.8) { if (!st.path || st.t > 1) { st.path = findPath(this.x, this.z, p.x, p.z); st.t = 0; } moving = this.followPath(G, st, dt, d > 5); }
      else this.faceTo(p.x, p.z, dt * 2);
      const door = G.world.doorById.sim_door; // escort badges the door for the player
      if (Math.hypot(door.x - this.x, door.z - this.z) < 2.5 && Math.hypot(door.x - p.x, door.z - p.z) < 3 && door.openT < 0.2 && G.time > door.holdUntil) G.doors.badge(door, this.id, this.cred, {}, G.time);
    } else done();
    this.animate(dt, moving);
  }
  followPath(G, st, dt, brisk) {
    const wp = st.path[0]; if (!wp) return false;
    const dx = wp[0] - this.x, dz = wp[1] - this.z, d = Math.hypot(dx, dz);
    // reader doors along the path: stop and badge (respecting the same rules as the player)
    const doorId = READER_NODES[`${wp[0]},${wp[1]}`];
    if (doorId && d < 1.3) {
      const door = G.world.doorById[doorId];
      if (door.openT < 0.8) {
        if (G.time > door.holdUntil && (!st.badgeT || G.time - st.badgeT > 2)) { st.badgeT = G.time; const egress = (Math.sign(door.axis === 'x' ? this.z - door.z : this.x - door.x) === door.insideSign);
          const r = egress ? { ok: true } : G.doors.badge(door, this.id, this.cred, { emergencyEgress: G.emergency }, G.time);
          if (egress) { door.holdUntil = G.time + 3; door.openedBy = this.id; }
          if (!r.ok) { st.path = []; return false; } }
        this.faceTo(wp[0], wp[1], dt * 3); return true;
      }
    }
    // stuck detection: if little progress for 2.5s (crowding at a door), accept the waypoint and move on
    st.prog = st.prog || { t: G.time, x: this.x, z: this.z };
    if (G.time - st.prog.t > 2.5) { if (Math.hypot(this.x - st.prog.x, this.z - st.prog.z) < 0.4 && d < 2.5) { st.path.shift(); } st.prog = { t: G.time, x: this.x, z: this.z }; }
    if (d < (doorId ? 0.7 : 0.45)) { st.path.shift(); return true; }
    // separation from other agents
    let sx = 0, sz = 0;
    for (const o of [...G.npcs, G.player]) { if (o === this) continue; const ox = this.x - o.x, oz = this.z - o.z, od = Math.hypot(ox, oz); if (od < 0.8 && od > 0.01) { sx += ox / od * (0.8 - od); sz += oz / od * (0.8 - od); } }
    const sp = (brisk ? 1.75 : 1.2) * (0.9 + this.traits.confidence * 0.2) * (this.needs.energy < 25 ? 0.85 : 1);
    this.x += (dx / d * sp + sx * 2) * dt; this.z += (dz / d * sp + sz * 2) * dt;
    this.faceTo(this.x + dx, this.z + dz, dt * 6);
    return true;
  }
  workIdle(dt, st) { st.base = st.base ?? this.yaw; this.yaw = st.base + Math.sin(st.t * 0.35) * 0.5 * this.traits.curiosity; }
  faceTo(x, z, k) { const t = Math.atan2(x - this.x, z - this.z); let df = ((t - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; this.yaw += df * Math.min(1, k * 4); }
  animate(dt, moving) {
    this.walkT = (this.walkT || 0) + (moving ? dt * 9 : 0);
    this.group.position.set(this.x, moving ? Math.abs(Math.sin(this.walkT)) * 0.04 : 0, this.z);
    this.group.rotation.y = this.yaw; this.body.rotation.z = moving ? Math.sin(this.walkT) * 0.04 : 0;
  }
  // ---------- belief-driven helpers used by planner methods
  checkForItem(G, itemId) {
    const it = G.items.find(i => i.id === itemId);
    if (it && Math.hypot(it.x - this.x, it.z - this.z) < 3.5 && canSee(this, it.x, it.z, G.world, { fov: Math.PI * 2, range: 4 })) {
      G.removeLostItem(); this.lostItem = null; this.favorPending = false;
      this.say(G, G.ai.bark(this, 'found_own', G)); this.emotion.valence += 0.3; this.finishGoal(G);
    }
  }
  verifyClaim(G, claim) {
    this.pendingClaim = null;
    const t = G.player.readTimes.handbook;
    if (t === undefined) { this.memory.add('lied', { t: G.now, source: 'log' }); this.concern = 'lied'; }
    else if (t > claim.t) { this.memory.add('lied', { t: G.now, source: 'log', credibility: 0.4 }); this.concern = 'lied_late'; }
    else this.memory.add('honest', { t: G.now, source: 'log' });
  }
  investigated(g) { this.heard = null; }
  toJSON() { return { id: this.id, x: this.x, z: this.z, yaw: this.yaw, memory: this.memory.toJSON(), needs: this.needs, emotion: this.emotion, rel: this.rel, beliefs: this.beliefs, flags: this.flags,
    concern: this.concern, pendingClaim: this.pendingClaim, favorPending: this.favorPending, lostItem: this.lostItem, greetedDay: this.greetedDay, carrying: this.carrying || null }; }
  load(d) { const { memory, ...rest } = d; Object.assign(this, rest); this.memory.load(memory); this.goal = null; this.steps = []; this.inConversation = false; }
}

// =====================================================================================
export class AIManager {
  constructor(G) {
    this.G = G;
    for (const a of G.npcs) for (const b of G.npcs) if (a !== b) a.rel[b.id] = 0.5 + Math.random() * 0.3;
    G.npcs.find(n => n.id === 'tom').rel.priya = 0.85; G.npcs.find(n => n.id === 'lena').rel.marcus = 0.85; G.npcs.find(n => n.id === 'dana').rel.marcus = 0.8;
    bus.on('violation', e => this.onViolation(e));
    bus.on('badge_attempt', e => this.onBadge(e));
    bus.on('quiz_result', e => this.onQuiz(e));
    bus.on('wo_complete', e => { for (const n of G.npcs) if (['marcus', 'lena'].includes(n.id) || n.seesPlayer) n.memory.add(e.quality > 0.8 ? 'quality_work' : 'completed_wo', { t: G.now, source: n.seesPlayer ? 'saw' : 'log' }); });
    bus.on('player_sound', e => { for (const n of G.npcs) if (canHear(n, e.x, e.z, e.loud, G.world) && !n.seesPlayer) n.heard = { pos: [e.x, e.z], t: G.now, what: e.what }; });
    bus.on('interact', e => { if (e.id === 'lp2_panel') this.onViolation({ kind: 'tried_panel', x: G.player.x, z: G.player.z }); });
  }
  update(dt, gameDt) { for (const n of this.G.npcs) n.update(this.G, dt, gameDt); this.updateHeadcount(); }
  /** A violation is only known to NPCs who can actually see it at that moment (and are paying attention). */
  onViolation(e) {
    const G = this.G;
    for (const n of G.npcs) {
      if (!canSee(n, e.x, e.z, G.world) || Math.random() > attention(n)) continue;
      this.observeViolation(n, e.kind, G, true);
      // escalation: a witness radios Security about access violations
      if (e.kind === 'tailgate' && n.id !== 'dana' && n.traits.strictness + n.traits.conscientious > 0.9) {
        const dana = G.npcs.find(x => x.id === 'dana');
        n.say(G, `Security, ${n.name.split(' ')[0]}. Heads up: the new hire came through the turnstile behind someone without badging.`, { radio: true });
        dana.memory.add('tailgate', { t: G.now, source: 'told', from: n.id, credibility: dana.rel[n.id] }); dana.concern = 'tailgate'; dana.lastSeenPlayer = { x: G.player.x, z: G.player.z, t: G.now };
      }
    }
    if (['tailgate', 'no_ppe', 'tried_panel'].includes(e.kind)) { G.player.stats.violations++; G.plant.onPlayerSafety(-1); }
  }
  observeViolation(n, kind, G, alreadyChecked) {
    const fresh = n.memory.add(kind, { t: G.now, source: 'saw', place: roomAt(G.player.x, G.player.z).id });
    if (!fresh) return;
    n.emotion.valence -= 0.1 * n.traits.strictness;
    if (n.traits.strictness >= 0.55 || ['tailgate', 'no_ppe', 'tried_panel'].includes(kind)) { n.concern = kind; n.lastSeenPlayer = { x: G.player.x, z: G.player.z, t: G.now }; n.decideT = 0; }
  }
  /** Security sees every badge event in the access log, not just ones she witnesses. */
  onBadge(e) {
    const G = this.G; if (e.who !== 'player') return;
    if (!e.ok) {
      G.director.denied(e.door);
      const dana = G.npcs.find(n => n.id === 'dana');
      const c = G.director.deniedCount[e.door];
      if (e.door === 'pa_door' && c >= 3) {
        dana.memory.add('denied_restricted', { t: G.now, source: 'log' });
        if (c === 3) { dana.concern = 'denied_restricted'; dana.lastSeenPlayer = { x: e.x, z: e.z, t: G.now }; dana.say(G, 'Security. I\'m showing repeated denied taps at the Protected Area reader. I\'m going to take a look.', { radio: true }); }
      }
      for (const n of G.npcs) if (n.id !== 'dana' && canHear(n, e.x, e.z, 8, G.world) && !n.seesPlayer) n.heard = { pos: [e.x, e.z], t: G.now, what: 'denied beep' };
    }
  }
  onQuiz(e) {
    const G = this.G;
    for (const n of G.npcs) {
      if (n.id === 'lena' && n.seesPlayer) n.memory.add(e.pass ? 'passed_training' : 'failed_training', { t: G.now, source: 'saw' });
      else if (n.id === 'marcus' || n.id === 'lena') n.memory.add(e.pass ? 'passed_training' : 'failed_training', { t: G.now, source: 'log' }); // training records system
    }
    if (!e.pass) G.director.note('quiz_fail');
  }
  /** NPC↔NPC conversation: they exchange their most noteworthy unshared memory (gossip with attribution). */
  chat(a, b, G) {
    if (!b) return;
    a.needs.social = 0; b.needs.social = Math.max(0, b.needs.social - 40);
    const m = a.memory.gossipFor(b.id);
    let line;
    if (m) {
      m.shared.push(b.id);
      if (m.type === 'saw_item') { b.memory.add('saw_item', { subject: m.subject, t: G.now, source: 'told', from: a.id, data: m.data }); line = `${b.name.split(' ')[0]}, if you're missing a flashlight, I saw one in the ${m.data.place}.`;
        if (b.lostItem === m.subject) { b.say(G, 'Wait, really? Thanks!'); b.decideT = 0; b.goal = null; b.steps = []; } }
      else { b.memory.add(m.type, { t: G.now, source: 'told', from: a.id, credibility: b.rel[a.id] || 0.5 }); line = `${pick(['Did you see', 'Heads up:', 'So,'])} the new hire ${gossipText(m) || 'is settling in'}.`; }
    } else line = pick([`How's the outage prep going, ${b.name.split(' ')[0]}?`, `${G.weather.type.name} again. Typical.`, `Coffee machine's acting up again.`, `You on days all week?`, `Did you see the backlog number? ${G.plant.backlog}.`]);
    a.rel[b.id] = clamp((a.rel[b.id] || 0.5) + 0.02); b.rel[a.id] = clamp((b.rel[a.id] || 0.5) + 0.02);
    a.say(G, line);
    setTimeout(() => b.say(G, pick(m && m.type !== 'saw_item' ? ['Huh. Good to know.', 'Noted.', 'Interesting. Thanks.'] : ['Ha, yeah.', 'Tell me about it.', 'Same as always.'])), 1800);
  }
  handover(from, to, g, G) {
    from.carrying = null; to.lostItem = null; to.favorPending = false;
    to.memory.add('turned_in_item', { t: G.now, source: 'told', from: from.id, credibility: 0.9 });
    from.say(G, `${to.name.split(' ')[0]}, your flashlight. The new hire turned it in.`);
    setTimeout(() => to.say(G, 'Oh, excellent. I\'ll thank them.'), 1600);
  }
  startHeadcount(dana, G) { this.hc = { dana, start: G.now, seenPlayer: false }; }
  updateHeadcount() {
    const G = this.G, hc = this.hc; if (!hc || !G.emergency) return;
    const ap = POINTS.assembly, p = G.player;
    if (Math.hypot(p.x - ap[0], p.z - ap[1]) < 7 && hc.dana.seesPlayer) { if (!hc.seenPlayer) { hc.seenPlayer = true; hc.dana.say(G, `${G.player.name}, checked in. Thank you.`); bus.emit('drill_checkin'); } }
    const atAP = G.npcs.filter(n => Math.hypot(n.x - ap[0], n.z - ap[1]) < 8);
    if ((atAP.length === G.npcs.length && G.now - hc.start > 4 && (hc.seenPlayer || G.now - hc.start > 12)) || G.now - hc.start > 18) {
      const missing = G.npcs.filter(n => !atAP.includes(n)).map(n => n.name); if (!hc.seenPlayer) missing.push(G.player.name);
      hc.dana.say(G, `Security. Accountability for Cedar Ridge complete: ${6 - missing.length} of 6.${missing.length ? ' Not accounted for: ' + missing.join(', ') + '.' : ' All personnel accounted for.'}`, { radio: true });
      const playerMissing = !hc.seenPlayer;
      for (const n of G.npcs) n.memory.add(playerMissing ? 'missed_drill' : 'attended_drill', { t: G.now, source: n.id === 'dana' ? 'saw' : 'heard' });
      if (playerMissing) { G.npcs.find(n => n.id === 'marcus').concern = 'missed_drill'; G.director.note('missed_drill'); }
      this.hc = null; G.endDrill(!playerMissing);
    }
  }
  bark(n, kind, G) {
    const nm = G.player.name.split(' ')[0], t = tone(n);
    const B = {
      greet: [`Hey, you must be ${nm}. Welcome. Holler if you need anything.`, `Morning! New hire, right? Welcome to Cedar Ridge.`],
      correct_tailgate: n.id === 'dana' ? [`${nm}, hold on. You came through the turnstile behind someone. Everyone badges for themselves, every time. I've logged it.`] : [`Hey ${nm}, you need to badge yourself through, even if the door's already open.`],
      correct_no_ppe: [`${nm}, stop there, please. Hard hat and safety glasses past the yellow line. The PPE cabinet is in the locker room.`],
      correct_ran_indoors: [`Easy, ${nm}. Walk, please. Blind corners.`, 'No running in the building, please.'],
      correct_ran_in_drill: ['Walk, don\'t run, even in a drill.'],
      correct_denied_restricted: [`${nm}, I've seen several denied taps on the Protected Area reader from your badge. That door isn't for you yet. If you need something back there, come ask me.`],
      correct_tried_panel: [`Whoa, ${nm}, leave LP-2 alone. That's for qualified electricians, on a work order.`],
      correct_missed_drill: [`${nm}, you weren't at Assembly B during the drill. In a real event, people would have gone looking for you. Next time, walk out with everyone.`],
      correct_lied: [`${nm}, I checked the handbook acknowledgment sheet, and it isn't signed. You told me you'd read it. I need to be able to trust what you tell me. Please read it, and next time just say "not yet."`],
      correct_lied_late: [`${nm}, I see you signed the handbook sheet after we talked. Next time just tell me "not yet." That's always an acceptable answer.`],
      help_intro: t === 'cool' ? ['Looking for something?'] : [`You look a bit turned around, ${nm}.`, `Need a hand, ${nm}?`, 'Hey, can I point you somewhere?'],
      ask_flashlight: [`Hey ${nm}, have you seen a yellow flashlight with my name on tape? I set it down somewhere this morning. If you spot it, I'd owe you one.`],
      found_own: ['There you are! Found my flashlight.', 'Ha, found it. Right where I didn\'t look.'],
    }[kind] || ['…'];
    return pick(B);
  }
}
const pick = a => a[Math.floor(Math.random() * a.length)];

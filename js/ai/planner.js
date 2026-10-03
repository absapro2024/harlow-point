// Goal-based planner (HTN-style method library). Utility AI picks WHAT to pursue.
// The planner decides HOW, building a short sequence of primitive steps.
// Primitives: go(target) | wait(sec) | say(text|fn) | face(target) | do(fn) | radio(text) | badgeAware
// Methods can branch on world state and the NPC's beliefs, so the same goal yields different plans.
import { POINTS } from '../world/facility.js';

const P = (name) => POINTS[name];
// Which way an NPC faces while working at a post (yaw: 0=+z, PI/2=+x).
const FACING = { sec_post: Math.PI / 2, train_front: Math.PI, lena_post: Math.PI * 0.85, sim_post: -Math.PI / 2, office_post: -Math.PI / 2, break_counter: Math.PI, c_lp2: -Math.PI / 2 };
export function plan(goal, npc, G) {
  const M = METHODS[goal.kind];
  return M ? M(goal, npc, G) : [{ wait: 2 }];
}
const METHODS = {
  work: (g, npc) => [{ go: P(g.place) || [npc.x, npc.z] }, { face: FACING[g.place] ?? null }, { work: 20 + Math.random() * 25, label: g.label }],
  patrol: (g, npc, G) => {
    const route = (g.hotspots && g.hotspots.length) ? g.hotspots.map(h => h.pos) : [P('lobby_patrol_a'), [0, 11.6], [0, 0], [0, -8.6], [0, 11.6], P('lobby_patrol_b')];
    const steps = [];
    for (const pt of route) steps.push({ go: pt }, { look: 1.5 + Math.random() * 1.5 });
    steps.push({ radio: g.hotspots?.length ? `Security, extra check at the ${g.hotspots[0].name} complete.` : 'Security, building rounds complete. All normal.' });
    steps.push({ go: P('sec_post') });
    return steps;
  },
  hydrate: () => [{ go: P('fountain') }, { anim: 'drink', wait: 3 }, { do: (n) => { n.needs.hydration = 100; } }],
  coffee: () => [{ go: P('coffee') }, { anim: 'pour', wait: 4 }, { do: (n) => { n.needs.energy = Math.min(100, n.needs.energy + 30); } }],
  rest: () => [{ go: P('bench') }, { anim: 'sit', wait: 20 }, { do: (n) => { n.needs.energy = Math.min(100, n.needs.energy + 25); n.emotion.stress *= 0.6; } }],
  lunch: (g) => [{ go: P(g.place || 'bench') }, { anim: 'eat', wait: 30 }, { do: (n) => { n.needs.energy = Math.min(100, n.needs.energy + 15); n.needs.social = 0; } }],
  socialize: (g, npc, G) => [{ goNear: g.target }, { faceAgent: g.target }, { chat: g.target }, { wait: 3 }],
  greet_player: (g) => [{ goNear: 'player', dist: 2.2 }, { facePlayer: true }, { greet: true }],
  correct_player: (g) => [{ goNear: 'player', dist: 2.0, brisk: true }, { facePlayer: true }, { correct: g.concern }],
  help_player: (g) => [{ goNear: 'player', dist: 2.2 }, { facePlayer: true }, { offerHelp: true }],
  investigate: (g) => [{ go: g.pos, brisk: true }, { look: 2.5 }, { look: 2 }, { do: (n) => { n.investigated(g); } }],
  evacuate: () => [{ go: P('assembly'), brisk: true }, { wait: 9999, label: 'at assembly' }],
  headcount: () => [{ go: P('assembly'), brisk: true }, { headcount: true }, { wait: 9999, label: 'accountability' }],
  escort: (g) => [{ follow: 'player', until: g.until }],
  // Searching uses the NPC's own (imperfect) beliefs about where a lost item might be.
  search: (g, npc) => {
    const known = npc.memory.latest('saw_item', g.item);
    if (known) return [{ go: known.data.pos }, { look: 2 }, { do: (n, G) => n.checkForItem(G, g.item) }];
    const cand = Object.entries(npc.beliefs[g.item] || {}).sort((a, b) => b[1] - a[1]);
    const [place] = cand[0] || ['break_mid'];
    return [{ go: P(place) }, { look: 2.5 }, { do: (n, G) => { n.checkForItem(G, g.item); if (n.beliefs[g.item]) n.beliefs[g.item][place] = 0.01; } }];
  },
  verify_claim: (g) => [{ go: P('train_front') }, { go: [3.6, 8.7] }, { look: 3, label: 'checking acknowledgment sheet' }, { do: (n, G) => n.verifyClaim(G, g.claim) }],
  return_item: (g) => [{ goNear: g.to, dist: 1.6 }, { faceAgent: g.to }, { handover: g }],
  ask_player: (g) => [{ goNear: 'player', dist: 2.2 }, { facePlayer: true }, { askFavor: g.favor }],
  off: (g) => [{ go: P('lot_center') }, { wait: 9999, label: 'off shift' }],
};

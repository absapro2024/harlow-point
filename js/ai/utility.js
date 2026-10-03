// Utility AI: each candidate goal returns a score from 0 to 1 using response curves.
// The chooser adds commitment (hysteresis), a little personality-weighted noise, and cooldowns,
// so NPCs are decisive but not robotic.
export const curve = {
  linear: (x) => clamp(x), inv: (x) => clamp(1 - x),
  quad: (x) => clamp(x) ** 2, sqrt: (x) => Math.sqrt(clamp(x)),
  logistic: (x, mid = 0.5, k = 10) => 1 / (1 + Math.exp(-k * (x - mid))),
};
export function clamp(x, a = 0, b = 1) { return Math.max(a, Math.min(b, x)); }

export function choose(npc, candidates, now) {
  let best = null, bestScore = -1; const scored = [];
  for (const c of candidates) {
    if (npc.cooldowns[c.kind] && npc.cooldowns[c.kind] > now) continue;
    let s = c.score;
    if (s <= 0) continue;
    if (npc.goal && npc.goal.kind === c.kind && sameKey(npc.goal, c)) s += 0.12; // commitment
    s += (Math.random() - 0.5) * 0.06 * (1.2 - npc.traits.conscientious);       // variety
    scored.push([c.kind, +s.toFixed(2)]);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  npc.lastScores = scored.sort((a, b) => b[1] - a[1]).slice(0, 4);
  return best;
}
const sameKey = (a, b) => (a.key || '') === (b.key || '');

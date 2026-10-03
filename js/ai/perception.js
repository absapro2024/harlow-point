// Perception: limited sight cone, line of sight, hearing radius with wall attenuation,
// a reaction delay, and attention that depends on how busy the NPC is. No omniscience.
import { lineOfSight } from '../world/nav.js';

export function canSee(npc, x, z, world, { fov = npc.fov, range = npc.sightRange } = {}) {
  const dx = x - npc.x, dz = z - npc.z, d = Math.hypot(dx, dz);
  if (d > range) return false;
  if (d > 1.2) {
    const ang = Math.atan2(dx, dz); let diff = Math.abs(((ang - npc.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (diff > fov / 2) return false;
  }
  return lineOfSight(world, npc.x, npc.z, x, z);
}
export function canHear(npc, x, z, loud, world) {
  const d = Math.hypot(x - npc.x, z - npc.z);
  if (d > loud) return false;
  return d < loud * 0.5 || lineOfSight(world, npc.x, npc.z, x, z);
}
/** Attention: busy or stressed NPCs notice less. Curious NPCs notice more. */
export function attention(npc) {
  const busy = npc.goal && ['work', 'evacuate', 'search'].includes(npc.goal.kind) ? 0.25 : 0;
  return Math.max(0.3, Math.min(0.98, 0.75 + npc.traits.curiosity * 0.25 - busy - npc.emotion.stress * 0.3));
}

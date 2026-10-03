// Fictional access-control model. A rule is checked against a credential and a context, and
// returns { ok, reasons[] } so the player always learns WHY access was denied.
import { bus } from '../core/events.js';

export const RULES = {
  public: () => [],
  badge_inside: () => [],
  badge: (c) => (!c.badgeId ? ['No employee badge issued. Check in at the Security desk.'] : []).concat(c.securityHold ? ['Badge on security hold. See Security.'] : []),
  sim_hall: (c, ctx) => {
    const r = [];
    if (!c.badgeId) r.push('No badge.');
    if (c.tier < 1 && !ctx.escorted) r.push(`Clearance Tier 1 required (you have Tier ${c.tier}).`);
    if (!c.quals.includes('GET-1') && !ctx.escorted) r.push('GET-1 Site Safety Basics not completed.');
    return r;
  },
  protected_area: (c) => {
    const r = [];
    if (c.tier < 3) r.push(`Clearance Tier 3 required (you have Tier ${c.tier}).`);
    if (!c.quals.includes('PA-1')) r.push('Protected Area qualification (PA-1) not held.');
    r.push('Protected Area entry also requires security processing.');
    return c.tier >= 3 && c.quals.includes('PA-1') ? [] : r;
  },
};
export function checkAccess(ruleId, cred, ctx = {}) {
  if (ctx.emergencyEgress && ruleId !== 'protected_area') return { ok: true, reasons: [], override: 'Emergency egress' };
  const reasons = (RULES[ruleId] || (() => ['Unknown rule']))(cred, ctx);
  return { ok: reasons.length === 0, reasons };
}

/** Door controller: auto doors open for anyone near. Reader doors open only after a granted badge tap. */
export class Doors {
  constructor(world) { this.world = world; this.doors = world.doors; this.prevSide = {}; }
  badge(door, who, cred, ctx, time) {
    const res = checkAccess(door.rule, cred, ctx);
    bus.emit('badge_attempt', { door: door.id, who, ok: res.ok, reasons: res.reasons, x: door.x, z: door.z, loud: 8, t: time });
    if (res.ok) { door.holdUntil = time + 4; door.openedBy = who; if (who === 'player') bus.emit('door_badge', { id: door.id }); }
    this.flash(door, res.ok);
    return res;
  }
  flash(door, ok) { for (const l of door.lamp || []) { l.material = l.material.clone(); l.material.color.set(ok ? 0x2ecc71 : 0xd23b3b); setTimeout(() => l.material.color.set(0xd23b3b), 1500); } }
  update(dt, time, agents, player, emergency) {
    for (const d of this.doors) {
      let want = false;
      if (!d.reader) want = agents.some(a => Math.hypot(a.x - d.x, a.z - d.z) < 2.2);
      else want = time < d.holdUntil || (emergency && d.rule !== 'protected_area' && agents.some(a => Math.hypot(a.x - d.x, a.z - d.z) < 2));
      if (want && d.reader && time >= d.holdUntil && emergency) { d.holdUntil = time + 3; d.openedBy = 'emergency'; }
      d.openT += (want ? 1 : -1) * dt * 2.5; d.openT = Math.max(0, Math.min(1, d.openT));
      const off = d.openT * d.width * 0.95;
      if (d.axis === 'x') d.mesh.position.x = d.home.x + off; else d.mesh.position.z = d.home.z + off;
      d.collider.disabled = d.openT > 0.75;
      // tailgating detection for player crossing reader doors
      if (d.reader) {
        const along = d.axis === 'x' ? Math.abs(player.x - d.x) < d.width / 2 : Math.abs(player.z - d.z) < d.width / 2;
        const side = Math.sign(d.axis === 'x' ? player.z - d.z : player.x - d.x);
        const prev = this.prevSide[d.id];
        if (along && prev !== undefined && side !== prev && side !== 0) {
          if (d.openedBy && d.openedBy !== 'player' && d.openedBy !== 'emergency') {
            const res = checkAccess(d.rule, player.cred, {});
            bus.emit('violation', { kind: 'tailgate', door: d.id, authorized: res.ok, x: player.x, z: player.z, severity: res.ok ? 0.4 : 1 });
          }
          bus.emit('door_pass', { id: d.id, who: 'player' });
          d.openedBy = d.openedBy === 'player' ? null : d.openedBy;
        }
        if (side !== 0) this.prevSide[d.id] = side;
      }
    }
  }
}

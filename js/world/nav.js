// Navigation: room-node graph + A*, plus 2D line-of-sight tests against wall/door colliders.
import { NAV_NODES, NAV_EDGES, ROOMS, roomAt } from './facility.js';

const adj = {};
for (const [a, b] of NAV_EDGES) { (adj[a] ||= []).push(b); (adj[b] ||= []).push(a); }
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function roomNodeFor(x, z) {
  const r = roomAt(x, z);
  if (r.nodes) return r.nodes.reduce((best, n) => d2(NAV_NODES[n], [x, z]) < d2(NAV_NODES[best], [x, z]) ? n : best, r.nodes[0]);
  return r.node;
}
function astar(s, g) {
  const open = new Set([s]), came = {}, gs = { [s]: 0 }, fs = { [s]: d2(NAV_NODES[s], NAV_NODES[g]) };
  while (open.size) {
    let cur = null; for (const n of open) if (cur === null || fs[n] < fs[cur]) cur = n;
    if (cur === g) { const p = [cur]; while (came[p[0]]) p.unshift(came[p[0]]); return p; }
    open.delete(cur);
    for (const nb of adj[cur] || []) {
      const t = gs[cur] + d2(NAV_NODES[cur], NAV_NODES[nb]);
      if (t < (gs[nb] ?? Infinity)) { came[nb] = cur; gs[nb] = t; fs[nb] = t + d2(NAV_NODES[nb], NAV_NODES[g]); open.add(nb); }
    }
  }
  return [s];
}
/** Returns list of [x,z] waypoints from (fx,fz) to (tx,tz). Also returns door ids crossed. */
export function findPath(fx, fz, tx, tz) {
  const rf = roomAt(fx, fz), rt = roomAt(tx, tz);
  if (rf === rt && !rf.nodes) return [[tx, tz]];
  const s = roomNodeFor(fx, fz), g = roomNodeFor(tx, tz);
  const nodes = astar(s, g);
  const pts = nodes.map(n => NAV_NODES[n].slice());
  // skip first node if it's behind us inside same room
  if (pts.length > 1 && rf === roomAt(...pts[1])) pts.shift();
  pts.push([tx, tz]);
  return pts;
}
// Segment vs AABB (slab test) on XZ
function segHits(ax, az, bx, bz, c) {
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for (const [p, d, mn, mx] of [[ax, dx, c.minX, c.maxX], [az, dz, c.minZ, c.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < mn || p > mx) return false; }
    else { let u = (mn - p) / d, v = (mx - p) / d; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false; }
  }
  return true;
}
export function lineOfSight(world, ax, az, bx, bz) {
  for (const c of world.colliders) {
    if (c.door) { const d = world.doorById[c.door]; if (d && d.openT > 0.6) continue; if (d && d.axis && d.mesh.material.transparent) continue; } // glass doors see-through
    if (c.low) continue;
    if (segHits(ax, az, bx, bz, c)) return false;
  }
  return true;
}
export { roomAt };

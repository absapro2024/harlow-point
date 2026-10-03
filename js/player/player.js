// First-person player: movement, collision vs. wall/door/prop boxes, needs, and credentials.
import { Needs } from '../systems/needs.js';
import { bus } from '../core/events.js';
import { roomAt } from '../world/facility.js';
const R = 0.32, EYE = 1.65;
export class Player {
  constructor(camera) {
    this.camera = camera; this.x = 0; this.z = 34; this.yaw = Math.PI; this.pitch = 0; this.moving = false; this.sprinting = false;
    this.needs = new Needs(); this.inv = []; this.ppe = { hardhat: false, glasses: false }; this.hasRadio = false;
    this.cred = { badgeId: null, tier: 0, quals: [], securityHold: false };
    this.readDocs = []; this.readTimes = {}; this.stats = { violations: 0, helps: 0 }; this.performance = { reliability: 0.5, safety: 0.7, quality: 0.7, teamwork: 0.5 };
    this.profile = {}; this.soundT = 0;
  }
  get name() { return this.profile.name || 'New Hire'; }
  get roleName() { return this.profile.roleName || 'trainee'; }
  update(dt, input, world, npcs, sprintToggle) {
    this.yaw -= input.look; this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - input.pitch));
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let vx = fx * input.my - fz * input.mx, vz = fz * input.my + fx * input.mx; // forward + right(-fz, fx)
    const m = Math.hypot(vx, vz); this.moving = m > 0.05;
    this.sprinting = sprintToggle && this.moving;
    const speed = (this.sprinting ? 3.6 : 1.9) * this.needs.speedMul;
    if (m > 1) { vx /= m; vz /= m; }
    this.tryMove(vx * speed * dt, 0, world); this.tryMove(0, vz * speed * dt, world);
    for (const n of npcs) { const dx = this.x - n.x, dz = this.z - n.z, d = Math.hypot(dx, dz); if (d < 0.6 && d > 0.001) { this.x += dx / d * (0.6 - d); this.z += dz / d * (0.6 - d); } }
    this.bob = (this.bob || 0) + (this.moving ? dt * (this.sprinting ? 13 : 8) : 0);
    this.camera.position.set(this.x, EYE + (this.moving ? Math.sin(this.bob) * 0.03 : 0), this.z);
    this.camera.rotation.set(this.pitch, this.yaw + Math.PI, 0, 'YXZ');
    if (this.sprinting && !roomAt(this.x, this.z).outdoor && (this.soundT -= dt) < 0) { this.soundT = 0.8; bus.emit('player_sound', { x: this.x, z: this.z, loud: 7, what: 'running footsteps' }); }
  }
  tryMove(dx, dz, world) {
    const nx = this.x + dx, nz = this.z + dz;
    for (const c of world.colliders) { if (c.disabled) continue; if (nx + R > c.minX && nx - R < c.maxX && nz + R > c.minZ && nz - R < c.maxZ) return; }
    this.x = nx; this.z = nz;
  }
  forward() { return [Math.sin(this.yaw), Math.cos(this.yaw)]; }
  toJSON() { const { camera, needs, ...rest } = this; return { ...rest, needs: needs.toJSON() }; }
  load(d) { const { needs, ...rest } = d; Object.assign(this, rest); this.needs.load(needs); }
}

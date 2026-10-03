// Procedural geometry helpers. ALL meshes created here are PLACEHOLDER_ASSET (primitive stand-ins
// to be replaced with authored models in M7). Colliders are axis-aligned boxes on the XZ plane.
import * as THREE from '../../vendor/three.module.js';

export const WALL_H = 3.2, WALL_T = 0.2;
const matCache = new Map();
export function mat(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(k);
}
export function box(scene, w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z); m.userData.placeholder = 'PLACEHOLDER_ASSET'; scene.add(m); return m;
}
export function cyl(scene, r, h, color, x, y, z, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat(color));
  m.position.set(x, y, z); scene.add(m); return m;
}
// Canvas-text texture for signs/labels (PLACEHOLDER_ASSET).
export function textTexture(lines, { w = 512, h = 256, bg = '#f4f1e8', fg = '#1d2a33', size = 40, border = '#c9302c' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) { g.strokeStyle = border; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12); }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const arr = Array.isArray(lines) ? lines : [lines];
  arr.forEach((t, i) => {
    const s = i === 0 ? size : size * 0.6;
    g.font = `${i === 0 ? 700 : 500} ${s}px -apple-system, Helvetica, Arial`;
    g.fillText(t, w / 2, h / 2 + (i - (arr.length - 1) / 2) * size * 1.05, w - 30);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function sign(scene, lines, x, y, z, rotY, w = 1.2, h = 0.6, opts) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTexture(lines, opts) }));
  m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m); return m;
}
export function labelSprite(text, color = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,20,30,0.65)'; g.beginPath(); g.roundRect(4, 8, 248, 48, 14); g.fill();
  g.fillStyle = color; g.font = '600 26px -apple-system, Helvetica'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 33, 236);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: true }));
  s.scale.set(1.0, 0.25, 1); return s;
}

// Walls with door gaps. gaps: [[center, width], ...]
export class WallBuilder {
  constructor(scene, colliders, color = 0xd9d4c7) { this.scene = scene; this.col = colliders; this.color = color; }
  seg(x1, z1, x2, z2) {
    const w = Math.abs(x2 - x1) || WALL_T, d = Math.abs(z2 - z1) || WALL_T;
    if (w < 0.01 || d < 0.01) return;
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    box(this.scene, w, WALL_H, d, this.color, cx, WALL_H / 2, cz);
    // baseboard stripe for depth readability
    box(this.scene, w + 0.01, 0.12, d + 0.01, 0x56626b, cx, 0.06, cz);
    this.col.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  }
  h(z, x1, x2, gaps = []) { // wall along X at fixed z
    let cur = x1;
    for (const [c, w] of [...gaps].sort((a, b) => a[0] - b[0])) { if (c - w / 2 - cur > 0.01) this.seg(cur, z, c - w / 2, z); cur = c + w / 2; }
    if (x2 - cur > 0.01) this.seg(cur, z, x2, z);
  }
  v(x, z1, z2, gaps = []) {
    let cur = z1;
    for (const [c, w] of [...gaps].sort((a, b) => a[0] - b[0])) { if (c - w / 2 - cur > 0.01) this.seg(x, cur, x, c - w / 2); cur = c + w / 2; }
    if (z2 - cur > 0.01) this.seg(x, cur, x, z2);
  }
}

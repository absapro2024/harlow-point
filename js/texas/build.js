// World construction: real terrain (USGS 3DEP elevation via AWS Terrain Tiles, Lake Whitney area,
// Bosque/Hill County TX), graded industrial pads, roads, vegetation, and two FICTIONAL generating
// stations designed the way a U.S. utility would lay one out (generic, not modeled on any real plant).
import * as THREE from '../../vendor/three.module.js';

export const N = 513, CELL = 38.961, HALF = (N - 1) / 2 * CELL, LAKE = 158.92;
export const SITE = { x: 390, z: -4870, elev: 173, rot: 0, name: 'Harlow Point Generating Station' };
export const GAS = { x: 5688, z: -3623, elev: 166, rot: 0, name: 'Bosque Bend Energy Center' };
SITE.rot = Math.atan2(-623, -623); // local +Z faces the lake (northwest)
GAS.rot = 0.4;

let H; // Float32Array heights (row-major, row = z)
export const colliders = []; // {cx, cz, hw, hd, c, s, top}
export const pois = [];

// ---------- helpers
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const R = rnd(12345);
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return (hash2(xi, zi) * (1 - u) + hash2(xi + 1, zi) * u) * (1 - v) + (hash2(xi, zi + 1) * (1 - u) + hash2(xi + 1, zi + 1) * u) * v; }
function fbm(x, z) { let a = 0.5, s = 0; for (let i = 0; i < 4; i++) { s += a * vnoise(x, z); x *= 2.1; z *= 2.1; a *= 0.5; } return s; }
const smooth = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };

export function heightAt(x, z) {
  const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
  const j = Math.max(0, Math.min(N - 2, Math.floor(fx))), i = Math.max(0, Math.min(N - 2, Math.floor(fz)));
  const u = Math.min(1, Math.max(0, fx - j)), v = Math.min(1, Math.max(0, fz - i));
  // match the triangle split used by the mesh (diagonal from (i,j+1) to (i+1,j))
  const h00 = H[i * N + j], h10 = H[i * N + j + 1], h01 = H[(i + 1) * N + j], h11 = H[(i + 1) * N + j + 1];
  if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
  return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}
export const isWater = (x, z) => heightAt(x, z) < LAKE + 0.3;

function grade(cx, cz, r0, r1, elev, rectHalf = null, rot = 0) {
  // Cut/fill an industrial pad: flat inside, blended embankment outside.
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = j * CELL - HALF, z = i * CELL - HALF; let d;
    if (rectHalf) { const lx = (x - cx) * c - (z - cz) * s, lz = (x - cx) * s + (z - cz) * c; d = Math.hypot(Math.max(0, Math.abs(lx) - rectHalf[0]), Math.max(0, Math.abs(lz) - rectHalf[1])); }
    else d = Math.hypot(x - cx, z - cz) - r0;
    if (d > r1) continue; const k = d <= 0 ? 1 : 1 - smooth(0, r1, d); const idx = i * N + j; H[idx] = H[idx] * (1 - k) + elev * k;
  }
}
function gradeLine(pts, w, blend) {
  // Road grading: pull terrain toward a smoothed road profile.
  for (let p = 0; p < pts.length - 1; p++) {
    const a = pts[p], b = pts[p + 1];
    const minx = Math.min(a.x, b.x) - w - blend, maxx = Math.max(a.x, b.x) + w + blend, minz = Math.min(a.z, b.z) - w - blend, maxz = Math.max(a.z, b.z) + w + blend;
    for (let i = Math.max(0, Math.floor((minz + HALF) / CELL)); i <= Math.min(N - 1, Math.ceil((maxz + HALF) / CELL)); i++)
      for (let j = Math.max(0, Math.floor((minx + HALF) / CELL)); j <= Math.min(N - 1, Math.ceil((maxx + HALF) / CELL)); j++) {
        const x = j * CELL - HALF, z = i * CELL - HALF; const abx = b.x - a.x, abz = b.z - a.z; let t = ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz); t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)); if (d > w + blend) continue;
        const target = a.y + (b.y - a.y) * t; const k = d < w ? 0.85 : 0.85 * (1 - smooth(w, w + blend, d)); const idx = i * N + j; H[idx] = H[idx] * (1 - k) + target * k;
      }
  }
}

// ---------- procedural textures (PLACEHOLDER_ASSET: replace with scanned PBR texture sets)
function canvasTex(size, draw, repeat = 1) { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function noiseFill(g, s, base, vari, grain = 1) { const im = g.createImageData(s, s); for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const n = (fbm(x / 18 * grain, y / 18 * grain) - 0.5) * 2 + (Math.random() - 0.5) * 0.6; const o = (y * s + x) * 4;
  im.data[o] = base[0] + n * vari; im.data[o + 1] = base[1] + n * vari; im.data[o + 2] = base[2] + n * vari; im.data[o + 3] = 255; } g.putImageData(im, 0, 0); }
export const TEX = {};
function makeTextures() {
  TEX.ground = canvasTex(512, (g, s) => { noiseFill(g, s, [128, 128, 128], 60, 2.2); }, 1);
  TEX.ground.colorSpace = THREE.NoColorSpace;
  TEX.concrete = canvasTex(256, (g, s) => { noiseFill(g, s, [176, 174, 168], 14, 3); g.strokeStyle = 'rgba(60,60,60,.25)'; g.lineWidth = 1; for (let y = 0; y <= s; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); } }, 1);
  TEX.siding = canvasTex(256, (g, s) => { g.fillStyle = '#c9c4b6'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 16) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, 0, 3, s); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 8, 0, 2, s); } }, 1);
  TEX.sidingBlue = canvasTex(256, (g, s) => { g.fillStyle = '#5c7186'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 16) { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x, 0, 3, s); } }, 1);
  TEX.asphalt = canvasTex(256, (g, s) => { noiseFill(g, s, [58, 58, 60], 10, 6); }, 1);
  TEX.gravel = canvasTex(256, (g, s) => { noiseFill(g, s, [150, 146, 138], 30, 9); }, 1);
  TEX.road = canvasTex(256, (g, s) => { noiseFill(g, s, [62, 62, 64], 9, 6); g.fillStyle = '#d8b13a'; g.fillRect(s / 2 - 3, 0, 2, s); g.fillRect(s / 2 + 2, 0, 2, s); g.fillStyle = '#e8e8e8'; g.fillRect(8, 0, 3, s); g.fillRect(s - 11, 0, 3, s); }, 1);
  TEX.windows = canvasTex(256, (g, s) => { g.fillStyle = '#b8b4a8'; g.fillRect(0, 0, s, s); for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { g.fillStyle = '#2c3a46'; g.fillRect(x * 32 + 5, y * 64 + 18, 22, 30); } }, 1);
  TEX.winEmit = canvasTex(256, (g, s) => { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { if (Math.random() < 0.55) { g.fillStyle = '#ffdca0'; g.fillRect(x * 32 + 5, y * 64 + 18, 22, 30); } } }, 1);
  TEX.fence = canvasTex(128, (g, s) => { g.clearRect(0, 0, s, s); g.strokeStyle = 'rgba(190,195,200,.9)'; g.lineWidth = 1.2; for (let i = -s; i < s * 2; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); g.beginPath(); g.moveTo(i + s, 0); g.lineTo(i, s); g.stroke(); } }, 1);
  TEX.water = canvasTex(512, (g, s) => { const im = g.createImageData(s, s); for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const e = 0.6; const hx = fbm((x + 1) / 24, y / 24) - fbm((x - 1) / 24, y / 24), hy = fbm(x / 24, (y + 1) / 24) - fbm(x / 24, (y - 1) / 24);
    const o = (y * s + x) * 4; im.data[o] = 128 + hx * 255 * e * 2; im.data[o + 1] = 128 + hy * 255 * e * 2; im.data[o + 2] = 255; im.data[o + 3] = 255; } g.putImageData(im, 0, 0); }, 1);
  TEX.water.colorSpace = THREE.NoColorSpace;
}

export const MAT = {};
function makeMaterials() {
  const m = (o) => new THREE.MeshStandardMaterial(o);
  MAT.concrete = m({ map: TEX.concrete, roughness: 0.88, metalness: 0 });
  MAT.containment = m({ map: TEX.concrete, color: 0xe9e6de, roughness: 0.8 });
  MAT.siding = m({ map: TEX.siding, roughness: 0.55, metalness: 0.35 });
  MAT.sidingBlue = m({ map: TEX.sidingBlue, roughness: 0.5, metalness: 0.4 });
  MAT.office = m({ map: TEX.windows, emissiveMap: TEX.winEmit, emissive: 0x000000, roughness: 0.6 });
  MAT.roof = m({ color: 0x8b8d8f, roughness: 0.75, metalness: 0.3 });
  MAT.steel = m({ color: 0x9aa1a6, roughness: 0.45, metalness: 0.85 });
  MAT.galv = m({ color: 0xb7bcbf, roughness: 0.5, metalness: 0.9 });
  MAT.tank = m({ color: 0xe8e8e2, roughness: 0.4, metalness: 0.3 });
  MAT.asphalt = m({ map: TEX.asphalt, roughness: 0.92 });
  MAT.road = m({ map: TEX.road, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  MAT.gravel = m({ map: TEX.gravel, roughness: 0.98, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  MAT.lot = m({ map: TEX.asphalt, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  MAT.fence = m({ map: TEX.fence, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.8 });
  MAT.transformer = m({ color: 0x6f7a6c, roughness: 0.6, metalness: 0.5 });
  MAT.red = m({ color: 0xff2a1a, emissive: 0xff1a0a, emissiveIntensity: 2 });
  MAT.brick = m({ color: 0x9a6b52, roughness: 0.9 });
  MAT.white = m({ color: 0xf0eee8, roughness: 0.7 });
  MAT.barn = m({ color: 0x8a2f25, roughness: 0.85 });
  MAT.tinRoof = m({ color: 0xa4a7a8, roughness: 0.5, metalness: 0.7 });
  MAT.water = new THREE.MeshPhysicalMaterial({ color: 0x24393c, roughness: 0.06, metalness: 0.0, normalMap: TEX.water, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 3.0, ior: 1.33, specularIntensity: 1 });
  MAT.trunk = m({ color: 0x4b3b2c, roughness: 1 });
  MAT.cedar = m({ color: 0x2f4127, roughness: 0.95, flatShading: true });
  MAT.oak = m({ color: 0x4c5a2c, roughness: 0.95, flatShading: true });
  MAT.mesquite = m({ color: 0x66713f, roughness: 0.95, flatShading: true });
}

// ---------- terrain mesh
function buildTerrain(scene) {
  const g = new THREE.BufferGeometry(); const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const k = i * N + j, x = j * CELL - HALF, z = i * CELL - HALF, h = H[k];
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; uv[k * 2] = x / 6; uv[k * 2 + 1] = z / 6;
    const hx = H[i * N + Math.min(N - 1, j + 1)] - H[i * N + Math.max(0, j - 1)], hz = H[Math.min(N - 1, i + 1) * N + j] - H[Math.max(0, i - 1) * N + j];
    const slope = Math.hypot(hx, hz) / (2 * CELL); const n = fbm(x / 350, z / 350), n2 = fbm(x / 60 + 7, z / 60 + 3);
    // Cross Timbers / Grand Prairie in October: tawny grass, green pasture in bottoms, limestone ledges, red-tan shoreline.
    c.setRGB(0.55, 0.49, 0.32);                                                  // dry prairie grass (little bluestem, October)
    c.lerp(new THREE.Color(0.40, 0.42, 0.24), smooth(0.45, 0.75, n) * 0.8);      // greener improved pasture
    c.lerp(new THREE.Color(0.58, 0.52, 0.36), smooth(0.55, 0.8, n2) * 0.5);      // bleached grass patches
    c.lerp(new THREE.Color(0.66, 0.63, 0.56), smooth(0.16, 0.32, slope));        // limestone bluffs
    const shore = h - LAKE; if (shore < 2.5) c.lerp(new THREE.Color(0.55, 0.46, 0.36), 1 - smooth(0.3, 2.5, shore)); // exposed shoreline
    if (shore < 0.2) c.setRGB(0.30, 0.30, 0.25);
    const wd = treeDensity(x, z, h, slope * CELL); c.lerp(new THREE.Color(0.20, 0.25, 0.14), Math.min(0.75, wd * 0.9)); // woodland canopy seen from afar
    c.convertSRGBToLinear();
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  const idx = new Uint32Array((N - 1) * (N - 1) * 6); let p = 0;
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < N - 1; j++) { const a = i * N + j, b = a + 1, d = a + N, e = d + 1; idx[p++] = a; idx[p++] = d; idx[p++] = b; idx[p++] = b; idx[p++] = d; idx[p++] = e; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.ground, roughness: 0.96, metalness: 0 });
  // detail map is a grayscale multiplier centered on 0.5 -> brighten to keep albedo
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
    vec4 dt = texture2D(map, vMapUv); vec4 dt2 = texture2D(map, vMapUv*0.071);
    diffuseColor.rgb *= (0.55 + dt.r*0.9) * (0.75 + dt2.r*0.5);`); };
  const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; scene.add(mesh); MAT.terrain = mat;
  // lake surface (fills everything below pool elevation)
  const w = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2, 1, 1), MAT.water); w.rotation.x = -Math.PI / 2; w.position.y = LAKE + 0.15; w.receiveShadow = true; scene.add(w);
  TEX.water.repeat.set(400, 400); MAT.waterMesh = w;
  // far skirt so the map edge does not look like a cliff
  const sk = new THREE.Mesh(new THREE.RingGeometry(HALF * 1.0, HALF * 4, 64, 1), new THREE.MeshStandardMaterial({ color: 0x6c6648, roughness: 1 }));
  sk.rotation.x = -Math.PI / 2; sk.position.y = 180; scene.add(sk);
}

// ---------- site-local placement
class Site {
  constructor(scene, s) { this.s = s; this.g = new THREE.Group(); this.g.position.set(s.x, s.elev, s.z); this.g.rotation.y = s.rot; scene.add(this.g); this.c = Math.cos(s.rot); this.sn = Math.sin(s.rot); }
  world(lx, lz) { return { x: this.s.x + lx * this.c + lz * this.sn, z: this.s.z - lx * this.sn + lz * this.c }; }
  add(mesh, lx, y, lz, ry = 0, collide = true) { mesh.position.set(lx, y, lz); mesh.rotation.y = ry; mesh.castShadow = true; mesh.receiveShadow = true; this.g.add(mesh);
    if (collide) { mesh.geometry.computeBoundingBox(); const bb = mesh.geometry.boundingBox; const w = this.world(lx, lz); const a = this.s.rot + ry;
      colliders.push({ cx: w.x, cz: w.z, hw: (bb.max.x - bb.min.x) / 2 * mesh.scale.x, hd: (bb.max.z - bb.min.z) / 2 * mesh.scale.z, c: Math.cos(a), s: Math.sin(a), top: this.s.elev + y + bb.max.y * mesh.scale.y }); }
    return mesh; }
  box(w, h, d, mat, lx, lz, y = 0, ry = 0, uvScale = 1) { const g = new THREE.BoxGeometry(w, h, d); scaleUV(g, w, h, d, uvScale); g.translate(0, h / 2, 0); return this.add(new THREE.Mesh(g, mat), lx, y, lz, ry); }
  cyl(r, h, mat, lx, lz, y = 0, seg = 40, collide = true) { const g = new THREE.CylinderGeometry(r, r, h, seg, 1); g.translate(0, h / 2, 0); const m = this.add(new THREE.Mesh(g, mat), lx, y, lz, 0, false);
    if (collide) { const w = this.world(lx, lz); colliders.push({ cx: w.x, cz: w.z, r, top: this.s.elev + y + h }); } return m; }
  flat(w, d, mat, lx, lz, ry = 0, y = 0.06) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 20, uv.getY(i) * d / 20);
    const m = new THREE.Mesh(g, mat); m.position.set(lx, y, lz); m.rotation.y = ry; m.receiveShadow = true; this.g.add(m); return m; }
}
function scaleUV(g, w, h, d, s) { const uv = g.attributes.uv, nrm = g.attributes.normal; for (let i = 0; i < uv.count; i++) { const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
  const su = nx > 0.5 ? d : w, sv = ny > 0.5 ? d : h; uv.setXY(i, uv.getX(i) * su / (20 * s), uv.getY(i) * sv / (20 * s)); } }

function fenceLine(site, pts, height = 3.0) {
  for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const len = Math.hypot(bx - ax, bz - az);
    const g = new THREE.PlaneGeometry(len, height); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * len / 3, uv.getY(k) * height / 3);
    const m = new THREE.Mesh(g, MAT.fence); m.position.set((ax + bx) / 2, height / 2, (az + bz) / 2); m.rotation.y = -Math.atan2(bz - az, bx - ax); site.g.add(m);
    const posts = Math.ceil(len / 3); const pg = new THREE.CylinderGeometry(0.05, 0.05, height + 0.5, 6); pg.translate(0, (height + 0.5) / 2, 0);
    const im = new THREE.InstancedMesh(pg, MAT.galv, posts + 1); const o = new THREE.Object3D();
    for (let p = 0; p <= posts; p++) { const t = p / posts; o.position.set(ax + (bx - ax) * t, 0, az + (bz - az) * t); o.updateMatrix(); im.setMatrixAt(p, o.matrix); } site.g.add(im);
    // treat fences as thin colliders
    const w = site.world((ax + bx) / 2, (az + bz) / 2); const a = site.s.rot - Math.atan2(bz - az, bx - ax);
    colliders.push({ cx: w.x, cz: w.z, hw: len / 2, hd: 0.15, c: Math.cos(a), s: Math.sin(a), top: site.s.elev + height });
  }
}

function containment(site, lx, lz, r = 21, h = 50) {
  site.cyl(r, h, MAT.containment, lx, lz, 0, 64);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), MAT.containment); dome.scale.y = 0.62; site.add(dome, lx, h, lz, 0, false);
  // buttresses + base ring
  for (let a = 0; a < 3; a++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, h, 1.6).translate(0, h / 2, 0), MAT.containment); const ang = a / 3 * Math.PI * 2 + 0.3; site.add(b, lx + Math.cos(ang) * (r + 0.6), 0, lz + Math.sin(ang) * (r + 0.6), -ang, false); }
  site.cyl(r + 1.2, 3, MAT.concrete, lx, lz, 0, 64, false);
}

function lattice(site, lx, lz, h, w, mat = MAT.galv) {
  // simple steel lattice tower (met tower / transmission)
  const grp = new THREE.Group(); const leg = new THREE.CylinderGeometry(0.12, 0.12, h, 5); leg.translate(0, h / 2, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const m = new THREE.Mesh(leg, mat); m.position.set(sx * w / 2, 0, sz * w / 2); grp.add(m); }
  for (let y = 4; y < h; y += 5) { const br = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, 0.15), mat); br.position.y = y; br.position.z = -w / 2; grp.add(br); const br2 = br.clone(); br2.position.z = w / 2; grp.add(br2);
    const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, w), mat); b3.position.set(-w / 2, y, 0); grp.add(b3); const b4 = b3.clone(); b4.position.x = w / 2; grp.add(b4); }
  grp.position.set(lx, 0, lz); site.g.add(grp); return grp;
}

const beacons = [];
function beacon(site, lx, y, lz) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), MAT.red); m.position.set(lx, y, lz); site.g.add(m); beacons.push(m); }

// ---------- the fictional nuclear station (typical two-unit U.S. pressurized-water reactor site layout; not to scale of any real plant)
function buildNuclear(scene) {
  const s = new Site(scene, SITE);
  // graded pad + yard paving
  s.flat(560, 520, MAT.gravel, 0, 20);
  s.flat(420, 300, MAT.lot, 0, 40, 0, 0.08);
  // power block: two containments, shared auxiliary building between them, fuel buildings outboard
  containment(s, -70, 20); containment(s, 70, 20);
  s.box(84, 34, 56, MAT.concrete, 0, 20);                           // auxiliary building
  s.box(30, 40, 50, MAT.concrete, -128, 20); s.box(30, 40, 50, MAT.concrete, 128, 20); // fuel handling buildings
  s.cyl(1.6, 78, MAT.steel, 0, 34, 0, 16, false);                   // plant vent stack
  beacon(s, 0, 78.5, 34);
  s.box(60, 22, 34, MAT.concrete, 0, -40);                          // control / electrical building
  s.box(26, 12, 20, MAT.concrete, -54, -46); s.box(26, 12, 20, MAT.concrete, 54, -46); // emergency diesel generator buildings
  // turbine buildings on the lake side (circulating water from the intake)
  s.box(120, 38, 48, MAT.siding, -72, 104); s.box(120, 38, 48, MAT.siding, 72, 104);
  s.box(120, 6, 48, MAT.roof, -72, 104, 38); s.box(120, 6, 48, MAT.roof, 72, 104, 38);
  s.box(28, 30, 20, MAT.sidingBlue, 0, 104);                        // heater bay / connecting structure
  // main and auxiliary transformers with fire walls
  for (const ux of [-72, 72]) { for (let t = -1; t <= 1; t++) { s.box(9, 8, 7, MAT.transformer, ux + t * 16, 142); s.box(1, 10, 9, MAT.concrete, ux + t * 16 + 8, 142); } }
  // condensate / refueling water storage tanks
  s.cyl(9, 14, MAT.tank, -170, 60); s.cyl(9, 14, MAT.tank, 170, 60); s.cyl(12, 16, MAT.tank, -170, 100); s.cyl(12, 16, MAT.tank, 170, 100);
  // warehouse, maintenance shop, admin, training center
  s.box(90, 14, 50, MAT.siding, 200, -150); s.box(60, 11, 36, MAT.sidingBlue, 120, -150);
  const admin = s.box(80, 15, 26, MAT.office, -10, -170); s.box(80, 0.8, 26, MAT.roof, -10, -170, 15);
  const trn = s.box(64, 11, 26, MAT.office, -150, -190); s.box(64, 0.8, 26, MAT.roof, -150, -190, 11);
  pois.push({ name: 'Harlow Point Generating Station: Main gate', ...s.world(0, -265) }, { name: 'Administration building', ...s.world(-10, -205) }, { name: 'Training center', ...s.world(-150, -220) });
  // parking
  s.flat(220, 70, MAT.lot, -40, -235, 0, 0.1); cars(s, -40, -235, 220, 70);
  // security: double perimeter fence around the protected area, gatehouse (generic, non-functional)
  const P = [[-230, -110], [230, -110], [230, 200], [-230, 200], [-230, -110]], P2 = P.map(([x, z]) => [x * 1.035, z < 0 ? z - 8 : z + 8]);
  fenceLine(s, P); fenceLine(s, P2);
  s.box(18, 5, 10, MAT.white, 0, -128); s.box(22, 0.6, 14, MAT.roof, 0, -128, 5);
  // switchyard
  s.flat(220, 160, MAT.gravel, -380, 40, 0, 0.1);
  for (let gx = -460; gx <= -300; gx += 40) for (let gz = -10; gz <= 90; gz += 50) { lattice(s, gx, gz, 18, 1.2); s.box(3, 3, 2, MAT.galv, gx + 20, gz); }
  fenceLine(s, [[-492, -42], [-268, -42], [-268, 122], [-492, 122], [-492, -42]], 2.5);
  // met tower and water tower
  lattice(s, 330, -330, 60, 2); beacon(s, 330, 60.5, -330);
  s.cyl(1.2, 34, MAT.white, 420, -420, 0, 12); const wt = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), MAT.white); s.add(wt, 420, 38, -420, 0, false);
  // circulating water discharge canal toward the lake
  return s;
}

function cars(site, cx, cz, w, d) {
  const g = new THREE.BoxGeometry(1.9, 1.45, 4.7); g.translate(0, 0.72, 0);
  const cols = [0xf2f2f2, 0x1c1c1e, 0x8b9399, 0x3a4c66, 0x8e2b2b, 0xd7d2c6, 0x4b5a40];
  const n = Math.floor(w / 3) * 4; const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.6 }), n);
  const o = new THREE.Object3D(); let k = 0; const c = new THREE.Color();
  for (let row = 0; row < 4; row++) for (let i = 0; i < Math.floor(w / 3); i++) { if (R() < 0.3) continue; o.position.set(cx - w / 2 + 2 + i * 3, 0.1, cz - d / 2 + 8 + row * 17); o.rotation.y = (R() - 0.5) * 0.05; o.updateMatrix(); im.setMatrixAt(k, o.matrix); im.setColorAt(k, c.setHex(cols[Math.floor(R() * cols.length)])); k++; }
  im.count = k; im.castShadow = true; site.g.add(im);
}

// ---------- fictional combined-cycle natural gas plant
const plumes = [];
function buildGas(scene) {
  const s = new Site(scene, GAS);
  s.flat(360, 300, MAT.gravel, 0, 0);
  for (const x of [-45, 45]) { s.box(22, 26, 46, MAT.sidingBlue, x, 0); s.cyl(3.4, 55, MAT.steel, x, -30, 0, 24); beacon(s, x, 55.5, -30); s.box(14, 12, 24, MAT.siding, x, 34); }
  s.box(70, 24, 30, MAT.siding, 0, 70);                              // steam turbine building
  // mechanical-draft cooling tower: 8 cells
  s.box(120, 14, 22, MAT.concrete, 0, 130); for (let i = 0; i < 8; i++) { const x = -52 + i * 15; s.cyl(5.5, 3, MAT.sidingBlue, x, 130, 14, 24, false); plumes.push(s.world(x, 130)); }
  s.cyl(14, 12, MAT.tank, 120, 40); s.cyl(10, 10, MAT.tank, 120, 0);
  s.flat(120, 90, MAT.gravel, -150, 60, 0, 0.1); for (let gx = -190; gx <= -110; gx += 40) for (let gz = 30; gz <= 90; gz += 30) lattice(s, gx, gz, 15, 1);
  s.box(30, 6, 14, MAT.office, 120, -110); s.flat(60, 30, MAT.lot, 120, -140, 0, 0.1); cars(s, 120, -140, 60, 30);
  fenceLine(s, [[-200, -170], [180, -170], [180, 160], [-200, 160], [-200, -170]], 2.4);
  pois.push({ name: 'Bosque Bend Energy Center (gas)', ...s.world(120, -180) });
  return s;
}

// ---------- farms and ranch houses (rural Bosque County texture)
function buildRural(scene) {
  let placed = 0;
  for (let tries = 0; tries < 400 && placed < 26; tries++) {
    const x = (R() - 0.5) * HALF * 1.8, z = (R() - 0.5) * HALF * 1.8, h = heightAt(x, z);
    if (h < LAKE + 6 || Math.hypot(x - SITE.x, z - SITE.z) < 1500 || Math.hypot(x - GAS.x, z - GAS.z) < 800) continue;
    const sl = Math.abs(heightAt(x + 20, z) - heightAt(x - 20, z)) + Math.abs(heightAt(x, z + 20) - heightAt(x, z - 20)); if (sl > 3) continue;
    const s = new Site(scene, { x, z, elev: h - 0.2, rot: R() * Math.PI });
    const house = R() < 0.5 ? MAT.brick : MAT.white; s.box(16, 3.2, 11, house, 0, 0); const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 7.5, 3, 4, 1).rotateY(Math.PI / 4).translate(0, 1.5, 0), MAT.roof); roof.scale.set(1.5, 1, 1.05); s.add(roof, 0, 3.2, 0, 0, false);
    if (R() < 0.7) { s.box(14, 6, 18, R() < 0.5 ? MAT.barn : MAT.tinRoof, 34, 10); }
    if (R() < 0.5) { s.cyl(2.8, 8, MAT.galv, 26, -14, 0, 18); }
    if (R() < 0.6) { lattice(s, -24, 18, 10, 0.8, MAT.galv); } // windmill tower
    placed++;
  }
}

// ---------- roads (graded ribbons following terrain)
const roads = [];
function roadPath(points) { // points [[x,z],...] -> densified with grade profile
  const pts = []; for (let i = 0; i < points.length - 1; i++) { const [ax, az] = points[i], [bx, bz] = points[i + 1]; const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 20);
    for (let k = 0; k < n; k++) { const t = k / n; pts.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t }); } }
  pts.push({ x: points.at(-1)[0], z: points.at(-1)[1] });
  for (const p of pts) p.y = heightAt(p.x, p.z);
  for (let pass = 0; pass < 6; pass++) for (let i = 1; i < pts.length - 1; i++) pts[i].y = (pts[i - 1].y + pts[i].y * 2 + pts[i + 1].y) / 4; // smooth grade
  for (const p of pts) if (p.y < LAKE + 1.5) p.y = LAKE + 1.5; // causeway over water
  roads.push(pts); return pts;
}
function buildRoadMeshes(scene) {
  for (const pts of roads) {
    const w = 4.2, pos = [], uv = [], idx = []; let dist = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; const nx = -dz / l, nz = dx / l;
      if (i > 0) dist += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      const y = Math.max(pts[i].y, heightAt(pts[i].x + nx * w, pts[i].z + nz * w), heightAt(pts[i].x - nx * w, pts[i].z - nz * w)) + 0.25;
      pos.push(pts[i].x + nx * w, y, pts[i].z + nz * w, pts[i].x - nx * w, y, pts[i].z - nz * w); uv.push(0, dist / 8, 1, dist / 8);
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, MAT.road); m.receiveShadow = true; scene.add(m);
  }
}

// ---------- transmission lines (lattice towers + sagging conductors)
function transmission(scene, from, to, spacing = 380) {
  const len = Math.hypot(to.x - from.x, to.z - from.z), n = Math.max(1, Math.round(len / spacing)); const ang = Math.atan2(to.x - from.x, to.z - from.z);
  const towerG = new THREE.Group(); const arms = [];
  const tops = [];
  for (let i = 0; i <= n; i++) { const t = i / n, x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t, y = Math.max(LAKE + 0.5, heightAt(x, z));
    const tw = makeTower(); tw.position.set(x, y, z); tw.rotation.y = ang; scene.add(tw); tops.push({ x, y, z }); }
  const mat = new THREE.LineBasicMaterial({ color: 0x2b2e30 });
  for (const off of [-9, 0, 9]) { const pts = []; for (let i = 0; i < tops.length - 1; i++) { const a = tops[i], b = tops[i + 1];
    for (let k = 0; k <= 16; k++) { const t = k / 16; const sag = Math.sin(t * Math.PI) * 9; const ox = Math.cos(ang) * off, oz = -Math.sin(ang) * off;
      pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t + ox, a.y + (b.y - a.y) * t + 38 - sag, a.z + (b.z - a.z) * t + oz)); } }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat)); }
}
let towerProto;
function makeTower() {
  if (!towerProto) { towerProto = new THREE.Group(); const m = MAT.galv; const h = 42;
    const leg = new THREE.CylinderGeometry(0.2, 0.35, h, 4); leg.translate(0, h / 2, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const l = new THREE.Mesh(leg, m); l.position.set(sx * 2.2, 0, sz * 2.2); l.rotation.z = -sx * 0.045; l.rotation.x = sz * 0.045; towerProto.add(l); }
    for (let y = 6; y < h; y += 6) { const b = new THREE.Mesh(new THREE.BoxGeometry(4.6 - y * 0.06, 0.2, 0.2), m); b.position.y = y; towerProto.add(b); }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(20, 0.6, 0.8), m); arm.position.y = 38.5; towerProto.add(arm);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 0.6), m); arm2.position.y = h; towerProto.add(arm2);
    towerProto.traverse(o => { if (o.isMesh) o.castShadow = true; }); }
  return towerProto.clone();
}

export function treeDensity(x, z, h, sl) {
  if (h < LAKE + 0.8) return 0; const dens = fbm(x / 600, z / 600);
  return Math.max(0, Math.min(1, smooth(0.40, 0.68, dens) * 0.7 + smooth(1.5, 6, sl) * 0.45 + (h - LAKE < 8 ? 0.25 : 0) - 0.12));
}
// ---------- vegetation: post oak, Ashe juniper (cedar), mesquite — instanced, chunked for culling
export const treeChunks = [];
function buildTrees(scene, avoid) {
  const CH = 2000, chunks = new Map();
  const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 3, 5); trunkG.translate(0, 1.5, 0);
  const cedarG = merge([0, 1, 2].map(k => { const g = new THREE.ConeGeometry(2.3 - k * 0.55, 3.4, 8, 1); g.translate((R() - .5) * .4, 2.6 + k * 1.7, (R() - .5) * .4); return g; })); jitter(cedarG, 0.45);
  const oakG = merge([[0, 5.4, 0, 2.6], [1.7, 4.8, 0.6, 2.0], [-1.6, 4.9, -0.5, 2.1], [0.4, 4.6, -1.8, 1.9], [-0.5, 6.2, 1.2, 1.7]].map(([x, y, z, r]) => { const g = new THREE.IcosahedronGeometry(r, 0); g.scale(1, 0.8, 1); g.translate(x, y, z); return g; })); jitter(oakG, 0.5);
  const mesqG = merge([[0, 3.2, 0, 2.0], [1.6, 2.9, 0.5, 1.5], [-1.5, 3.0, -0.4, 1.6]].map(([x, y, z, r]) => { const g = new THREE.IcosahedronGeometry(r, 0); g.scale(1.2, 0.55, 1.2); g.translate(x, y, z); return g; })); jitter(mesqG, 0.4);
  const types = [[cedarG, MAT.cedar], [oakG, MAT.oak], [mesqG, MAT.mesquite]];
  const o = new THREE.Object3D();
  const add = (x, z, t) => { const key = Math.floor((x + HALF) / CH) + ',' + Math.floor((z + HALF) / CH); if (!chunks.has(key)) chunks.set(key, [[], [], []]); chunks.get(key)[t].push([x, z]); };
  for (let k = 0; k < 420000; k++) {
    const x = (R() - 0.5) * HALF * 2, z = (R() - 0.5) * HALF * 2; const h = heightAt(x, z); if (h < LAKE + 0.8) continue;
    if (avoid(x, z)) continue;
    const draws = fbm(x / 140 + 9, z / 140 - 4);
    // trees concentrate along draws/creeks and slopes; prairie tops stay open
    const sl = Math.abs(heightAt(x + 15, z) - heightAt(x - 15, z)) + Math.abs(heightAt(x, z + 15) - heightAt(x, z - 15));
    const p = treeDensity(x, z, h, sl * 1.3);
    if (R() > p * p * 1.1) continue;
    const t = sl > 3 ? 0 : (draws > 0.55 ? 1 : (R() < 0.45 ? 2 : (R() < 0.5 ? 0 : 1)));
    add(x, z, t);
  }
  let total = 0;
  for (const [, lists] of chunks) {
    lists.forEach((list, t) => { if (!list.length) return; const [g, mat] = types[t];
      const crown = new THREE.InstancedMesh(g, mat, list.length), trunk = new THREE.InstancedMesh(trunkG, MAT.trunk, list.length); const c = new THREE.Color();
      list.forEach(([x, z], i) => { const s = 0.7 + R() * 0.6; o.position.set(x, heightAt(x, z) - 0.2, z); o.rotation.set(0, R() * 6.28, 0); o.scale.set(s, s * (0.85 + R() * 0.3), s); o.updateMatrix();
        crown.setMatrixAt(i, o.matrix); trunk.setMatrixAt(i, o.matrix); crown.setColorAt(i, c.setHSL(0.18 + R() * 0.06, 0.25 + R() * 0.15, 0.55 + R() * 0.25)); });
      crown.castShadow = true; crown.receiveShadow = true; trunk.castShadow = true; crown.computeBoundingSphere(); trunk.computeBoundingSphere();
      scene.add(crown); scene.add(trunk); treeChunks.push(crown, trunk); total += list.length; });
  }
  return total;
}
function merge(list) { const out = new THREE.BufferGeometry(); const pos = [], nrm = []; for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; pos.push(...g.attributes.position.array); nrm.push(...g.attributes.normal.array); }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); return out; }
function jitter(g, a) { const p = g.attributes.position; const seen = new Map(); for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); let d = seen.get(k); if (!d) { d = [(R() - .5) * a, (R() - .5) * a, (R() - .5) * a]; seen.set(k, d); } p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]); } g.computeVertexNormals(); }

// ---------- steam plumes from the gas plant's cooling tower
let plumeSys;
function buildPlumes(scene) {
  const tex = canvasTex(64, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
  const mat = new THREE.SpriteMaterial({ map: tex, color: 0xf2f2f2, transparent: true, depthWrite: false, opacity: 0.5 });
  plumeSys = []; for (const p of plumes) for (let k = 0; k < 10; k++) { const sp = new THREE.Sprite(mat.clone()); sp.userData = { base: p, t: k / 10 }; scene.add(sp); plumeSys.push(sp); }
}
export function cullTrees(cam, far) { for (const m of treeChunks) { const c = m.boundingSphere.center; m.visible = Math.hypot(c.x - cam.x, c.z - cam.z) < far + m.boundingSphere.radius; } }
export function animate(dt, time, wind, dayAmt, env) {
  for (const sp of plumeSys) { const u = sp.userData; u.t += dt * 0.04; if (u.t > 1) u.t -= 1; const t = u.t; const wd = (env.windDir + 180) * Math.PI / 180;
    sp.position.set(u.base.x + Math.sin(wd) * t * wind * 18, GAS.elev + 17 + t * 60, u.base.z - Math.cos(wd) * t * wind * 18); const s = 8 + t * 40; sp.scale.set(s, s, 1); sp.material.opacity = (1 - t) * 0.45 * (0.3 + dayAmt * 0.7); }
  const on = (Math.floor(time * 0.75) % 2) === 0; for (const b of beacons) b.visible = on;
  MAT.office.emissive.setRGB(1 - dayAmt, (1 - dayAmt) * 0.9, (1 - dayAmt) * 0.75); MAT.office.emissiveIntensity = 1.2;
  TEX.water.offset.x = time * 0.004 * (1 + wind * 0.1); TEX.water.offset.y = time * 0.002;
  // wet look: darker, glossier ground and roads in/after rain
  const w = env.wet; MAT.terrain.roughness = 0.96 - w * 0.25; MAT.terrain.color.setScalar(1 - w * 0.35); MAT.road.roughness = 0.9 - w * 0.6; MAT.lot.roughness = 0.9 - w * 0.6; MAT.concrete.roughness = 0.88 - w * 0.35;
  MAT.water.normalScale.setScalar(0.25 + wind * 0.04 + env.cur.rain * 0.4);
}

// ---------- near-field grass (instanced blades that follow the player, sway in the wind)
let grass, grassCenter = { x: 1e9, z: 1e9 }, grassMask = () => false; const GR = 34, GN = 26000;
export const grassU = { uTime: { value: 0 }, uWind: { value: 3 } };
function buildGrass(scene, mask) {
  grassMask = mask;
  const g = new THREE.BufferGeometry(); const w = 0.035, h = 0.42;
  g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, -w * 0.6, h * 0.5, 0, w * 0.6, h * 0.5, 0, 0, h, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => { sh.uniforms.uTime = grassU.uTime; sh.uniforms.uWind = grassU.uWind;
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.); float sway = sin(uTime*1.7 + wp.x*0.35 + wp.z*0.27) * (0.04 + uWind*0.012) * position.y * position.y * 3.0;
      transformed.x += sway; transformed.z += sway*0.6;`); };
  grass = new THREE.InstancedMesh(g, mat, GN); grass.frustumCulled = false; grass.receiveShadow = true; scene.add(grass);
}
const _o = new THREE.Object3D(), _c = new THREE.Color();
export function updateGrass(cam) {
  if (!grass) return; if (Math.hypot(cam.x - grassCenter.x, cam.z - grassCenter.z) < 8) return; grassCenter = { x: cam.x, z: cam.z };
  const r = rnd(7); let k = 0;
  for (let i = 0; i < GN; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * GR; let x = Math.round(cam.x / 4) * 4 + Math.cos(a) * d, z = Math.round(cam.z / 4) * 4 + Math.sin(a) * d;
    const h = heightAt(x, z); if (h < LAKE + 0.5 || grassMask(x, z)) continue; const sc = 0.6 + r() * 0.9;
    _o.position.set(x, h - 0.03, z); _o.rotation.set((r() - .5) * 0.5, r() * 6.28, (r() - .5) * 0.4); _o.scale.set(1, sc, 1); _o.updateMatrix(); grass.setMatrixAt(k, _o.matrix);
    const n = fbm(x / 30, z / 30); grass.setColorAt(k, _c.setRGB(0.42 + n * 0.25 + r() * 0.08, 0.38 + n * 0.12 + r() * 0.06, 0.18 + r() * 0.05).convertSRGBToLinear()); k++; }
  grass.count = k; grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
}
let stars;
function buildStars(scene) { const n = 3500, p = []; for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u); if (u < 0.02) { i--; continue; } p.push(r * Math.cos(a) * 30000, u * 30000, r * Math.sin(a) * 30000); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); stars.renderOrder = -2; scene.add(stars); }
export function updateStars(cam, dayAmt, cover) { stars.position.copy(cam); stars.material.opacity = Math.max(0, (1 - dayAmt * 3)) * (1 - cover) * 0.9; stars.visible = stars.material.opacity > 0.01; }

// ---------- main entry
export async function buildWorld(scene, onProgress) {
  const r = await fetch('data/terrain_whitney_513.f32'); if (!r.ok) throw new Error('terrain data missing'); H = new Float32Array(await r.arrayBuffer()); onProgress(0.3);
  makeTextures(); makeMaterials();
  // grading: station pads, then roads
  grade(SITE.x, SITE.z, 0, 220, SITE.elev, [300, 300], SITE.rot);
  grade(GAS.x, GAS.z, 0, 160, GAS.elev, [210, 190], GAS.rot);
  const gate = (() => { const c = Math.cos(SITE.rot), s = Math.sin(SITE.rot), lx = 0, lz = -300; return { x: SITE.x + lx * c + lz * s, z: SITE.z - lx * s + lz * c }; })();
  const gasGate = (() => { const c = Math.cos(GAS.rot), s = Math.sin(GAS.rot), lx = 120, lz = -200; return { x: GAS.x + lx * c + lz * s, z: GAS.z - lx * s + lz * c }; })();
  // county road network (FM-style two-lane roads)
  const p1 = roadPath([[gate.x, gate.z], [gate.x + 900, gate.z + 1600], [gate.x + 2000, gate.z + 4200], [1800, 4500], [2600, HALF - 10]]);
  const p2 = roadPath([[gate.x + 2000, gate.z + 4200], [gasGate.x - 600, gasGate.z + 1500], [gasGate.x, gasGate.z]]);
  const p3 = roadPath([[-HALF + 10, 1500], [-3000, 1200], [0, 2600], [1800, 4500]]);
  const p4 = roadPath([[gasGate.x, gasGate.z], [7600, -800], [HALF - 10, 600]]);
  for (const p of roads) gradeLine(p, 6, 25);
  for (let i = 0; i < H.length; i++) if (H[i] < LAKE + 0.25) H[i] = LAKE - 2.5; // lake bed below the water surface
  onProgress(0.45);
  buildTerrain(scene); onProgress(0.6);
  buildRoadMeshes(scene);
  const nuc = buildNuclear(scene); const gas = buildGas(scene); buildRural(scene); buildPlumes(scene); onProgress(0.75);
  // grid connections: station switchyard -> county lines and the gas plant
  const sy = nuc.world(-380, 40), gsy = gas.world(-150, 60);
  transmission(scene, sy, { x: -HALF + 200, z: -2200 }); transmission(scene, sy, { x: -1500, z: HALF - 200 }); transmission(scene, gsy, { x: sy.x + 50, z: sy.z + 60 }); transmission(scene, gsy, { x: HALF - 200, z: -6500 });
  const pads = [[SITE, 650], [GAS, 420]];
  const n = buildTrees(scene, (x, z) => pads.some(([p, r]) => Math.hypot(x - p.x, z - p.z) < r) || roads.some(pts => nearPolyline(pts, x, z, 14)));
  buildGrass(scene, (x, z) => pads.some(([p, r]) => Math.hypot(x - p.x, z - p.z) < r * 0.62) || roads.some(pts => nearPolyline(pts, x, z, 6))); buildStars(scene);
  onProgress(0.95);
  pois.unshift({ name: 'Lake Whitney overlook', x: nuc.world(-200, 600).x, z: nuc.world(-200, 600).z });
  return { gate, nTrees: n, roads };
}
function nearPolyline(pts, x, z, d) { for (let i = 0; i < pts.length - 1; i += 1) { const a = pts[i]; if (Math.abs(a.x - x) > 60 || Math.abs(a.z - z) > 60) continue; const b = pts[i + 1]; const abx = b.x - a.x, abz = b.z - a.z; let t = ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz || 1); t = Math.max(0, Math.min(1, t)); if (Math.hypot(x - a.x - abx * t, z - a.z - abz * t) < d) return true; } return false; }
export { H };

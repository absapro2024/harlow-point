// Harlow Point open world — ~20 km x 20 km of real Texas terrain around Lake Whitney.
// Walk or drive; real sun path; live NWS weather (or simulated); day/night; map travel.
import * as THREE from '../../vendor/three.module.js';
import { Controls } from '../player/controls.js';
import { Environment, WX, LAT, LON } from './env.js';
import { buildWorld, heightAt, colliders, pois, SITE, GAS, HALF, LAKE, animate, cullTrees, updateGrass, grassU, updateStars } from './build.js';

const $ = (id) => document.getElementById(id);
const TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0; if (TOUCH) document.body.classList.add('touch');
const LOW = TOUCH || new URLSearchParams(location.search).has('low');

const renderer = new THREE.WebGLRenderer({ antialias: !LOW, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.25 : 1.75)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.3, 60000);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const env = new Environment(scene, renderer, camera);
if (LOW) env.sun.shadow.mapSize.set(1024, 1024);
const controls = new Controls(renderer.domElement);

// ---- simulated clock: starts at the real current time in Central Texas
let simMs = Date.now(); const SPEEDS = [1, 10, 60, 300]; let speedI = 1;
const fmtTime = (d) => d.toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// ---- player
const P = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, vy: 0, onGround: true, drive: false, speed: 0 };
const EYE = 1.68;
function placeAt(x, z, yaw) { P.pos.set(x, heightAt(x, z), z); if (yaw != null) P.yaw = yaw; P.vy = 0; }

function collide(nx, nz, y) {
  const r = P.drive ? 1.2 : 0.35;
  for (const c of colliders) {
    const dx = nx - c.cx, dz = nz - c.cz; if (Math.abs(dx) > 260 || Math.abs(dz) > 260) continue;
    if (y > c.top - 0.3) continue; // standing on top
    if (c.r) { const d = Math.hypot(dx, dz), m = c.r + r; if (d < m) { const k = m / (d || 1); nx = c.cx + dx * k; nz = c.cz + dz * k; } continue; }
    const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c; const ex = c.hw + r, ez = c.hd + r;
    if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
      let nlx = lx, nlz = lz; if (ex - Math.abs(lx) < ez - Math.abs(lz)) nlx = Math.sign(lx || 1) * ex; else nlz = Math.sign(lz || 1) * ez;
      nx = c.cx + nlx * c.c + nlz * c.s; nz = c.cz - nlx * c.s + nlz * c.c;
    }
  }
  return [nx, nz];
}

function updatePlayer(dt) {
  const inp = controls.read();
  P.yaw -= inp.look; P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - inp.pitch));
  const run = controls.keys.ShiftLeft || controls.keys.ShiftRight || runToggle;
  let target;
  if (P.drive) { // simple pickup-truck model: throttle/brake, steering
    const thr = inp.my, steer = inp.mx; const max = run ? 38 : 25; // m/s (~85 / 56 mph)
    P.speed += (thr * (thr * P.speed < 0 ? 12 : 4.5)) * dt; P.speed *= (1 - dt * (thr === 0 ? 0.35 : 0.05)); P.speed = Math.max(-8, Math.min(max, P.speed));
    P.yaw -= steer * dt * Math.min(1, Math.abs(P.speed) / 6) * 0.9 * Math.sign(P.speed || 1);
    target = { x: -Math.sin(P.yaw) * P.speed, z: -Math.cos(P.yaw) * P.speed };
  } else {
    const sp = run ? 4.2 : 1.45; const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const m = Math.min(1, Math.hypot(inp.mx, inp.my));
    target = { x: (fx * inp.my + rx * inp.mx) * sp, z: (fz * inp.my + rz * inp.mx) * sp }; if (m > 1) { target.x /= m; target.z /= m; }
  }
  let nx = P.pos.x + target.x * dt, nz = P.pos.z + target.z * dt;
  // terrain slope limit for walking; lake edge
  const hN = heightAt(nx, nz), hC = heightAt(P.pos.x, P.pos.z);
  if (hN < LAKE - 0.6 && !P.drive) { nx = P.pos.x; nz = P.pos.z; toast('The water is too deep to wade here.'); }
  if (P.drive && hN < LAKE - 0.2) { nx = P.pos.x; nz = P.pos.z; P.speed = 0; }
  if (!P.drive && (hN - hC) / Math.max(0.01, Math.hypot(nx - P.pos.x, nz - P.pos.z)) > 1.2) { nx = P.pos.x; nz = P.pos.z; }
  [nx, nz] = collide(nx, nz, P.pos.y);
  nx = Math.max(-HALF + 5, Math.min(HALF - 5, nx)); nz = Math.max(-HALF + 5, Math.min(HALF - 5, nz));
  P.pos.x = nx; P.pos.z = nz;
  const g = Math.max(heightAt(nx, nz), LAKE - 0.6);
  P.vy -= 9.81 * dt; P.pos.y += P.vy * dt; if (P.pos.y <= g) { P.pos.y = g; P.vy = 0; P.onGround = true; }
  if (controls.keys.Space && P.onGround && !P.drive) { P.vy = 3.6; P.onGround = false; }
  // camera with head bob while walking
  const moving = Math.hypot(target.x, target.z); bob += dt * moving * 2.2;
  const eye = P.drive ? 2.1 : EYE + (P.onGround ? Math.sin(bob) * 0.025 * Math.min(1, moving) : 0);
  camera.position.set(P.pos.x, P.pos.y + eye, P.pos.z); camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
}
let bob = 0, runToggle = false;

// ---- HUD
let toastT = 0; function toast(t) { const el = $('toast'); el.textContent = t; el.style.display = 'block'; toastT = 2.5; }
function latlon(x, z) { const mLat = 111320, mLon = 111320 * Math.cos(LAT * Math.PI / 180); return [LAT - z / mLat, LON + x / mLon]; }
function nearestPlace() { let best = null, bd = 1e9; for (const p of [...pois, { name: SITE.name, x: SITE.x, z: SITE.z }, { name: GAS.name, x: GAS.x, z: GAS.z }]) { const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z); if (d < bd) { bd = d; best = p; } } return [best, bd]; }
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function hud() {
  const d = new Date(simMs); const st = WX[env.state];
  const wind = env.cur.wind * 2.237, wdir = DIRS[Math.round(((env.windDir % 360) + 360) % 360 / 45) % 8];
  $('info').innerHTML = `<b>${fmtTime(d).split(', ').slice(-1)[0]}</b> ${fmtTime(d).split(', ').slice(0, 2).join(', ')}<br>${st.label} • ${Math.round(env.tempF)}°F • Wind ${wdir} ${Math.round(wind)} mph<br><span style="opacity:.75">${env.mode === 'live' ? (env.live ? 'Live NWS weather (KINJ)' : 'Live weather unavailable: simulated') : 'Simulated weather'} • time ×${SPEEDS[speedI]}</span>`;
  const [ll, lo] = latlon(P.pos.x, P.pos.z); const [pl, pd] = nearestPlace();
  $('place').innerHTML = `Bosque / Hill County, Texas • ${ll.toFixed(4)}°N ${Math.abs(lo).toFixed(4)}°W • elev ${Math.round(P.pos.y * 3.281)} ft<br><span style="opacity:.8">${pd < 400 ? pl.name : `${(pd / 1609).toFixed(1)} mi to ${pl.name}`}${P.drive ? ` • ${Math.round(Math.abs(P.speed) * 2.237)} mph` : ''}</span>`;
  const hd = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360; let s = ''; for (let a = -90; a <= 90; a += 15) { const v = Math.round((hd + a + 360) % 360); const lab = v % 45 === 0 ? DIRS[v / 45 % 8] : (v % 15 === 0 ? '·' : ''); s += `<span style="display:inline-block;width:16px">${lab}</span>`; }
  $('cstrip').innerHTML = s;
}
$('help').innerHTML = TOUCH ? 'Left thumb: move • Right thumb: look • DRIVE: truck • MAP: travel • TIME: speed' : 'Click to look • WASD move • Shift run • Space jump • V truck • M map • T time speed • 1–8 set weather • L live weather • P photo mode';

// ---- map
const mapC = $('mapc'), mctx = mapC.getContext('2d'); let mapImg = null;
function drawMap() {
  const S = mapC.width;
  if (!mapImg) { const im = mctx.createImageData(S, S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const wx = (x / S - 0.5) * HALF * 2, wz = (y / S - 0.5) * HALF * 2; const h = heightAt(wx, wz), h2 = heightAt(wx + 40, wz + 40); const shade = Math.max(0.55, Math.min(1.3, 1 + (h - h2) * 0.05)); const o = (y * S + x) * 4;
      if (h < LAKE + 0.3) { im.data[o] = 70; im.data[o + 1] = 110; im.data[o + 2] = 140; } else { const t = Math.min(1, (h - LAKE) / 120); im.data[o] = (150 + t * 50) * shade; im.data[o + 1] = (150 + t * 30) * shade; im.data[o + 2] = (100 + t * 20) * shade; } im.data[o + 3] = 255; }
    mctx.putImageData(im, 0, 0); mapImg = mctx.getImageData(0, 0, S, S); }
  mctx.putImageData(mapImg, 0, 0);
  const toM = (x, z) => [(x / (HALF * 2) + 0.5) * S, (z / (HALF * 2) + 0.5) * S];
  mctx.strokeStyle = '#3b3b3b'; mctx.lineWidth = 3; for (const r of WORLD.roads) { mctx.beginPath(); r.forEach((p, i) => { const [a, b] = toM(p.x, p.z); i ? mctx.lineTo(a, b) : mctx.moveTo(a, b); }); mctx.stroke(); }
  mctx.font = 'bold 15px sans-serif'; for (const p of [{ name: '☢ ' + SITE.name, x: SITE.x, z: SITE.z }, { name: '⚡ ' + GAS.name, x: GAS.x, z: GAS.z }, ...pois.slice(0, 1)]) { const [a, b] = toM(p.x, p.z); mctx.fillStyle = '#ffd34d'; mctx.beginPath(); mctx.arc(a, b, 6, 0, 7); mctx.fill(); mctx.fillStyle = '#fff'; mctx.strokeStyle = '#000'; mctx.lineWidth = 3; mctx.strokeText(p.name, a + 9, b + 5); mctx.fillText(p.name, a + 9, b + 5); }
  mctx.fillStyle = '#fff'; mctx.strokeStyle = '#000'; mctx.strokeText('Lake Whitney (Brazos River)', S * 0.42, S * 0.45); mctx.fillText('Lake Whitney (Brazos River)', S * 0.42, S * 0.45);
  const [px, pz] = toM(P.pos.x, P.pos.z); mctx.save(); mctx.translate(px, pz); mctx.rotate(-P.yaw); mctx.fillStyle = '#ff4d4d'; mctx.beginPath(); mctx.moveTo(0, -11); mctx.lineTo(7, 8); mctx.lineTo(-7, 8); mctx.fill(); mctx.restore();
  mctx.fillStyle = '#fff'; mctx.fillText('N ↑   scale: 1 mile', 14, S - 30); mctx.fillRect(14, S - 20, S * 1609 / (HALF * 2), 4);
}
function openMap() { $('map').style.display = 'block'; drawMap(); if (document.pointerLockElement) document.exitPointerLock(); controls.enabled = false; }
function closeMap() { $('map').style.display = 'none'; controls.enabled = true; controls.reset(); }
mapC.addEventListener('click', (e) => { const r = mapC.getBoundingClientRect(); const S = Math.min(r.width, r.height); const ox = r.left + (r.width - S) / 2, oy = r.top + (r.height - S) / 2;
  const x = ((e.clientX - ox) / S - 0.5) * HALF * 2, z = ((e.clientY - oy) / S - 0.5) * HALF * 2; if (Math.abs(x) > HALF || Math.abs(z) > HALF) return;
  if (heightAt(x, z) < LAKE + 0.3) { toast('That spot is in the lake. Pick land.'); return; } placeAt(x, z); closeMap(); toast('Traveled.'); });
$('mapClose').onclick = closeMap; $('bMap').onclick = () => ($('map').style.display === 'block' ? closeMap() : openMap());
$('wxBtn').onclick = () => cycleWeather();
const order = Object.keys(WX);
function cycleWeather() { env.mode = 'sim'; env.setState(order[(order.indexOf(env.state) + 1) % order.length]); toast('Weather: ' + WX[env.state].label); }
function toggleDrive() { P.drive = !P.drive; P.speed = 0; toast(P.drive ? 'Driving the site pickup. W/S throttle, A/D steer, Shift = highway speed.' : 'On foot.'); }
$('bDrive').onclick = toggleDrive; $('bRun').onclick = () => { runToggle = !runToggle; $('bRun').style.background = runToggle ? '#2f6f9f' : ''; };
$('bTime').onclick = () => { speedI = (speedI + 1) % SPEEDS.length; toast('Time ×' + SPEEDS[speedI]); };
let photo = false;
addEventListener('keydown', (e) => {
  env.startAudio();
  if (e.code === 'KeyM') ($('map').style.display === 'block' ? closeMap() : openMap());
  if (e.code === 'Escape' && $('map').style.display === 'block') closeMap();
  if (e.code === 'KeyV') toggleDrive();
  if (e.code === 'KeyT') { speedI = (speedI + 1) % SPEEDS.length; toast('Time ×' + SPEEDS[speedI]); }
  if (e.code === 'KeyL') { env.mode = 'live'; env.fetchLive().then(ok => toast(ok ? 'Live weather: ' + env.liveText : 'Live weather unavailable right now')); }
  if (/^Digit[1-8]$/.test(e.code)) { env.mode = 'sim'; env.setState(order[+e.code.slice(5) - 1]); toast('Weather: ' + WX[env.state].label); }
  if (e.code === 'KeyP') { photo = !photo; document.querySelectorAll('.hud').forEach(h => h.style.visibility = photo ? 'hidden' : ''); }
  if (e.code === 'BracketRight') simMs += 3600e3; if (e.code === 'BracketLeft') simMs -= 3600e3;
});
addEventListener('pointerdown', () => env.startAudio(), { once: true });

// ---- boot
let WORLD;
(async () => {
  const bar = $('bar').firstElementChild; const prog = (p) => { bar.style.width = (p * 100) + '%'; };
  WORLD = await buildWorld(scene, prog);
  env.fetchLive().then(ok => { if (!ok) env.mode = 'sim'; });
  setInterval(() => { if (env.mode === 'live') env.fetchLive(); }, 10 * 60 * 1000);
  // start at the station's main gate looking at the power block
  const g = WORLD.gate; placeAt(g.x, g.z, Math.atan2(-(SITE.x - g.x), -(SITE.z - g.z)));
  if (location.search.includes('t=')) { const hr = +new URLSearchParams(location.search).get('t'); const d = new Date(simMs); d.setUTCHours((hr + 5) % 24, 0, 0); simMs = d.getTime(); }
  if (location.search.includes('wx=')) { env.mode = 'sim'; env.setState(new URLSearchParams(location.search).get('wx')); env.cur = { ...WX[env.state] }; }
  prog(1); $('loading').style.display = 'none'; toast(`${WORLD.nTrees.toLocaleString()} trees • real USGS terrain • ${SITE.name} (fictional)`);
  window.__W = { P, env, camera, placeAt, setTime: (h) => { const d = new Date(simMs); d.setUTCHours((h + 5) % 24, 0, 0); simMs = d.getTime(); }, SITE, GAS };
  let last = performance.now(), t = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    simMs += dt * 1000 * SPEEDS[speedI];
    if (controls.enabled) updatePlayer(dt);
    const { dayAmt } = env.update(dt, new Date(simMs), SPEEDS[speedI], P.pos);
    animate(dt, t, env.cur.wind, dayAmt, env); if ((t * 2 | 0) !== ((t - dt) * 2 | 0)) cullTrees(camera.position, LOW ? 2500 : 4500);
    updateGrass(camera.position); grassU.uTime.value = t; grassU.uWind.value = env.cur.wind; updateStars(camera.position, dayAmt, env.cur.cover);
    env.clouds.position.copy(camera.position); env.sky.position.copy(camera.position);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.display = 'none'; }
    if ((t * 4 | 0) !== ((t - dt) * 4 | 0)) hud();
    renderer.render(scene, camera);
  });
})().catch(e => { $('lt').textContent = 'Could not start: ' + e.message; console.error(e); });

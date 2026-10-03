// Weather & daylight. Deterministic per day so saves are consistent.
import * as THREE from '../../vendor/three.module.js';
const TYPES = [
  { id: 'clear', name: 'Clear', fog: 0.004, sky: 0x9cc6e8, temp: [58, 72] },
  { id: 'overcast', name: 'Overcast', fog: 0.008, sky: 0x9aa5ad, temp: [55, 64] },
  { id: 'coastal_fog', name: 'Coastal fog', fog: 0.045, sky: 0xb7bec3, temp: [52, 60] },
  { id: 'drizzle', name: 'Light rain', fog: 0.015, sky: 0x7d8890, temp: [50, 58], rain: true },
  { id: 'windy', name: 'Windy', fog: 0.005, sky: 0xa9c4d6, temp: [56, 66] },
];
const rnd = s => { const x = Math.sin(s * 9301 + 49297) * 233280; return x - Math.floor(x); };
export class Weather {
  constructor(scene) {
    this.scene = scene; scene.fog = new THREE.FogExp2(0x9cc6e8, 0.004);
    const g = new THREE.BufferGeometry(); const n = 1200, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 50; p[i * 3 + 1] = Math.random() * 12; p[i * 3 + 2] = 20 + Math.random() * 25; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.rain = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaabbcc, size: 0.06, transparent: true, opacity: 0.6 })); // PLACEHOLDER_ASSET
    scene.add(this.rain); this.setDay(0);
  }
  setDay(day) { this.day = day; this.type = TYPES[Math.floor(rnd(day + 3) * TYPES.length)]; const [a, b] = this.type.temp; this.tempF = Math.round(a + rnd(day + 7) * (b - a)); }
  update(dt, hour, sun, hemi) {
    const daylight = Math.max(0.08, Math.min(1, Math.sin(((hour - 6) / 12) * Math.PI) * 1.3));
    const sky = new THREE.Color(this.type.sky).multiplyScalar(daylight * 0.9 + 0.1);
    this.scene.background = sky; this.scene.fog.color.copy(sky); this.scene.fog.density = this.type.fog;
    sun.intensity = 1.6 * daylight * (this.type.id === 'clear' ? 1 : 0.55); hemi.intensity = 0.55 + 0.6 * daylight;
    this.rain.visible = !!this.type.rain;
    if (this.rain.visible) { const a = this.rain.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 9; if (y < 0) y = 12; a.setY(i, y); } a.needsUpdate = true; }
  }
  describe() { return `${this.type.name}, ${this.tempF}°F`; }
}

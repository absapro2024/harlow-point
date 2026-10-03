// Environment: real sun position for Bosque County TX, physically-based sky, procedural cloud layer,
// rain / lightning / fog, wet surfaces, ambient audio, and weather (live NWS observations or simulated).
import * as THREE from '../../vendor/three.module.js';
import { Sky } from '../../vendor/Sky.js';

export const LAT = 31.90, LON = -97.40;

// --- Solar position (NOAA approximation). Returns unit vector: x=east, y=up, z=south.
export function sunVector(date, lat = LAT, lon = LON) {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const N = (date.getTime() - start) / 86400000;
  const g = 2 * Math.PI / 365 * (N - 1);
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const tst = utcMin + eqt + 4 * lon;
  const ha = (tst / 4 - 180) * rad;
  const la = lat * rad;
  const cosZ = Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha);
  const el = Math.asin(Math.max(-1, Math.min(1, cosZ)));
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(decl) * Math.cos(la)) + Math.PI; // from north, clockwise
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

// --- Weather states. Values are targets the environment eases toward.
export const WX = {
  clear:        { label: 'Clear',               cover: 0.05, dark: 0.0,  rain: 0,   fog: 0.00006, wind: 3,  bolt: 0 },
  partly:       { label: 'Partly cloudy',       cover: 0.38, dark: 0.1,  rain: 0,   fog: 0.00007, wind: 4,  bolt: 0 },
  mostly:       { label: 'Mostly cloudy',       cover: 0.62, dark: 0.3,  rain: 0,   fog: 0.00009, wind: 5,  bolt: 0 },
  overcast:     { label: 'Overcast',            cover: 0.9,  dark: 0.55, rain: 0,   fog: 0.00012, wind: 5,  bolt: 0 },
  drizzle:      { label: 'Light rain',          cover: 0.92, dark: 0.6,  rain: 0.3, fog: 0.00022, wind: 5,  bolt: 0 },
  rain:         { label: 'Rain',                cover: 0.97, dark: 0.72, rain: 0.7, fog: 0.00035, wind: 8,  bolt: 0 },
  thunderstorm: { label: 'Thunderstorm',        cover: 1.0,  dark: 0.85, rain: 1.0, fog: 0.00045, wind: 13, bolt: 1 },
  fog:          { label: 'Fog',                 cover: 0.7,  dark: 0.45, rain: 0,   fog: 0.0035,  wind: 1,  bolt: 0 },
};
// October in north-central Texas: mostly fair, passing fronts with rain and storms.
const MARKOV = {
  clear: { clear: .7, partly: .25, fog: .05 },
  partly: { clear: .3, partly: .45, mostly: .25 },
  mostly: { partly: .35, mostly: .3, overcast: .3, drizzle: .05 },
  overcast: { mostly: .3, overcast: .3, drizzle: .2, rain: .15, fog: .05 },
  drizzle: { overcast: .4, drizzle: .3, rain: .3 },
  rain: { drizzle: .3, rain: .35, thunderstorm: .15, overcast: .2 },
  thunderstorm: { rain: .6, thunderstorm: .4 },
  fog: { fog: .4, overcast: .3, partly: .3 },
};
function pick(tbl) { let r = Math.random(); for (const k in tbl) { r -= tbl[k]; if (r <= 0) return k; } return Object.keys(tbl)[0]; }

export function nwsToState(text = '') {
  const t = text.toLowerCase();
  if (/thunder|t-storm|tstorm/.test(t)) return 'thunderstorm';
  if (/heavy rain|rain and/.test(t)) return 'rain';
  if (/drizzle|light rain|showers/.test(t)) return 'drizzle';
  if (/rain/.test(t)) return 'rain';
  if (/fog|mist|haze/.test(t)) return 'fog';
  if (/overcast/.test(t)) return 'overcast';
  if (/mostly cloudy|cloudy/.test(t)) return 'mostly';
  if (/partly|few|scattered/.test(t)) return 'partly';
  return 'clear';
}

const CLOUD_VS = `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix*vec4(position,1.)).xyz - cameraPosition); gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); gl_Position.z = gl_Position.w; }`;
const CLOUD_FS = `
precision highp float; varying vec3 vDir; uniform float uTime, uCover, uDark; uniform vec3 uSun, uSunCol; uniform vec2 uWind;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<6;i++){ s+=a*n(p); p=p*2.03+vec2(17.3,9.1); a*=.5; } return s; }
void main(){
  vec3 d = normalize(vDir); if (d.y < 0.005) discard;
  vec2 uv = d.xz / d.y * 0.9 + uWind * uTime;
  float base = fbm(uv*0.55);
  float detail = fbm(uv*2.3 + 3.1);
  float c = base*0.8 + detail*0.28;
  float th = mix(0.95, 0.25, uCover);
  float dens = smoothstep(th, th + 0.28, c);
  // self-shadowing toward the sun
  vec2 sOff = normalize(uSun.xz + 1e-4) * 0.18;
  float cs = fbm((uv + sOff)*0.55)*0.8 + fbm((uv+sOff)*2.3+3.1)*0.28;
  float shade = clamp(1.0 - (smoothstep(th, th+0.3, cs))*0.65, 0.25, 1.0);
  float day = clamp(uSun.y*4.0 + 0.25, 0.04, 1.0);
  vec3 lit = mix(vec3(0.42,0.45,0.5), uSunCol, shade) * day;
  lit = mix(lit, vec3(0.28,0.30,0.33)*day, uDark);
  float silver = pow(max(dot(d, uSun), 0.0), 12.0) * (1.0-dens) * 0.8;
  lit += uSunCol * silver * day;
  float fade = smoothstep(0.0, 0.18, d.y);
  float a = dens * fade;
  a = max(a, smoothstep(0.55, 1.0, uCover)*0.92*fade);            // overcast deck fills in
  gl_FragColor = vec4(lit, clamp(a,0.,1.));
}`;

export class Environment {
  constructor(scene, renderer, camera) {
    this.scene = scene; this.renderer = renderer; this.camera = camera;
    this.state = 'partly'; this.cur = { ...WX.partly }; this.mode = 'live'; this.liveText = '';
    this.tempF = 72; this.windDir = 160; this.nextWx = 1800; this.wet = 0; this.flash = 0; this.boltTimer = 8;
    this.live = null; this.time = 0;

    this.sky = new Sky(); this.sky.scale.setScalar(45000); scene.add(this.sky);
    const u = this.sky.material.uniforms; u.turbidity.value = 6; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;

    this.cloudMat = new THREE.ShaderMaterial({ vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
      uniforms: { uTime: { value: 0 }, uCover: { value: .3 }, uDark: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uWind: { value: new THREE.Vector2(0.004, 0.002) } } });
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(40000, 48, 24), this.cloudMat); this.clouds.renderOrder = -1; scene.add(this.clouds);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -160; sc.right = 160; sc.top = 160; sc.bottom = -160; sc.near = 10; sc.far = 1200;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun); scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd6ee, 0x5b5040, 0.9); scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x8fa6d6, 0.0); scene.add(this.moon);
    scene.fog = new THREE.FogExp2(0xbfcfdc, 0.00007);

    this.pmrem = new THREE.PMREMGenerator(renderer); this.envT = 0; this.envScene = new THREE.Scene();
    this.envSky = new Sky(); this.envSky.scale.setScalar(1000); this.envScene.add(this.envSky);

    // Rain: line streaks in a box around the camera
    const RN = 9000, pos = new Float32Array(RN * 6); this.rainN = RN; this.rainSeed = new Float32Array(RN * 3);
    for (let i = 0; i < RN; i++) { this.rainSeed[i * 3] = (Math.random() - .5) * 90; this.rainSeed[i * 3 + 1] = Math.random() * 45; this.rainSeed[i * 3 + 2] = (Math.random() - .5) * 90; }
    this.rainGeo = new THREE.BufferGeometry(); this.rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xaab4bf, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.rain = new THREE.LineSegments(this.rainGeo, this.rainMat); this.rain.frustumCulled = false; scene.add(this.rain);

    this.audio = null;
  }

  // Ambient audio (WebAudio noise: wind, rain, thunder). Started on first user gesture.
  startAudio() {
    if (this.audio) return; const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.985 * b + 0.015 * w * 6; d[i] = w * 0.5; d[i] = d[i]; }
    const mk = (type, f, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(ctx.destination); s.start(); return { g, fl }; };
    this.audio = { ctx, buf, wind: mk('lowpass', 380, 0.7), rain: mk('highpass', 1400, 0.4), rainLow: mk('bandpass', 600, 0.6) };
  }
  thunder(dist) {
    if (!this.audio) return; const { ctx, buf } = this.audio; const delay = dist / 343;
    const s = ctx.createBufferSource(); s.buffer = buf; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = Math.max(90, 900 - dist / 6);
    const g = ctx.createGain(); const t = ctx.currentTime + delay; const vol = Math.min(1, 2500 / (dist + 400));
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.08); g.gain.exponentialRampToValueAtTime(vol * .4, t + 1.2); g.gain.exponentialRampToValueAtTime(0.001, t + 5.5);
    s.connect(fl).connect(g).connect(ctx.destination); s.start(t); s.stop(t + 6);
  }

  async fetchLive() {
    // National Weather Service: latest observation at Hillsboro Municipal (KINJ), ~30 km from the map center.
    try {
      const r = await fetch('https://api.weather.gov/stations/KINJ/observations/latest', { headers: { Accept: 'application/geo+json' } });
      if (!r.ok) throw new Error(r.status); const j = await r.json(); const p = j.properties;
      this.live = { text: p.textDescription, tempF: p.temperature?.value != null ? p.temperature.value * 9 / 5 + 32 : null, wind: p.windSpeed?.value, windDir: p.windDirection?.value, at: p.timestamp };
      this.liveText = p.textDescription || ''; if (this.mode === 'live') this.setState(nwsToState(this.liveText));
      if (this.live.tempF != null) this.tempF = this.live.tempF; if (this.live.windDir != null) this.windDir = this.live.windDir;
      return true;
    } catch (e) { this.live = null; return false; }
  }
  setState(s) { if (WX[s]) this.state = s; }

  update(dt, simDate, simSpeed, playerPos) {
    this.time += dt;
    const target = WX[this.state], k = 1 - Math.exp(-dt * 0.08 * Math.max(1, Math.min(simSpeed, 60) / 6));
    for (const key of ['cover', 'dark', 'rain', 'fog', 'wind']) this.cur[key] += (target[key] - this.cur[key]) * k;

    // simulated weather changes every ~30-90 game minutes
    if (this.mode === 'sim') { this.nextWx -= dt * simSpeed; if (this.nextWx <= 0) { this.state = pick(MARKOV[this.state]); this.nextWx = 1800 + Math.random() * 3600; } }

    const sunV = sunVector(simDate); const sunUp = sunV.y;
    const u = this.sky.material.uniforms; u.sunPosition.value.copy(sunV);
    u.turbidity.value = 2.5 + this.cur.cover * 8; u.rayleigh.value = 1.4 + this.cur.cover * 1.2;
    this.cloudMat.uniforms.uTime.value = this.time; this.cloudMat.uniforms.uCover.value = this.cur.cover; this.cloudMat.uniforms.uDark.value = this.cur.dark;
    this.cloudMat.uniforms.uSun.value.copy(sunV);
    const wd = (this.windDir + 180) * Math.PI / 180; this.cloudMat.uniforms.uWind.value.set(Math.sin(wd), -Math.cos(wd)).multiplyScalar(0.0006 * (2 + this.cur.wind) * Math.max(1, Math.min(simSpeed, 30) / 3));

    const warm = THREE.MathUtils.clamp(1 - sunUp * 3, 0, 1); // low sun = warmer light
    const sunCol = new THREE.Color().setRGB(1, 0.92 - warm * 0.35, 0.82 - warm * 0.55);
    this.cloudMat.uniforms.uSunCol.value.copy(sunCol);
    const dayAmt = THREE.MathUtils.smoothstep(sunUp, -0.08, 0.12);
    const occl = 1 - this.cur.cover * 0.85 - this.cur.rain * 0.1;
    this.sun.color.copy(sunCol); this.sun.intensity = Math.max(0, 3.2 * dayAmt * Math.max(0.05, occl));
    this.sun.position.copy(playerPos).addScaledVector(sunV.y > 0 ? sunV : new THREE.Vector3(0, 1, 0), 600); this.sun.target.position.copy(playerPos);
    this.moon.intensity = (1 - dayAmt) * 0.12 * (1 - this.cur.cover * .7); this.moon.position.set(playerPos.x - 300, playerPos.y + 500, playerPos.z + 200);
    this.hemi.intensity = 0.05 + dayAmt * (0.45 - this.cur.dark * 0.2);
    this.hemi.color.setRGB(0.75 - this.cur.dark * .25, 0.82 - this.cur.dark * .25, 0.92 - this.cur.dark * .2);

    // fog color follows sky brightness
    const fc = new THREE.Color().setRGB(0.68, 0.76, 0.84).lerp(new THREE.Color(0.5, 0.53, 0.56), this.cur.dark).multiplyScalar(0.06 + dayAmt * 0.94);
    if (warm > 0.5 && dayAmt > 0.2) fc.lerp(new THREE.Color(0.85, 0.62, 0.45), (warm - 0.5) * 0.5 * (1 - this.cur.cover));
    this.scene.fog.color.copy(fc); this.scene.fog.density = this.cur.fog;
    this.sky.material.uniforms.mieCoefficient.value = 0.003 + this.cur.cover * 0.01;
    this.renderer.toneMappingExposure = 0.55 + dayAmt * 0.25 - this.cur.dark * 0.12 + this.flash * 2.2;
    this.renderer.setClearColor(fc);

    // environment reflection map refresh (cheap: low-res, every few seconds)
    this.envT -= dt; if (this.envT <= 0) { this.envT = 4; const eu = this.envSky.material.uniforms; eu.sunPosition.value.copy(sunV); eu.turbidity.value = u.turbidity.value; eu.rayleigh.value = u.rayleigh.value;
      if (this.envRT) this.envRT.dispose(); this.envRT = this.pmrem.fromScene(this.envScene, 0, 1, 1000); this.scene.environment = this.envRT.texture;
      this.scene.environmentIntensity = (0.08 + dayAmt * 0.35) * (1 - this.cur.dark * 0.5); }

    // rain
    const rr = this.cur.rain; this.rainMat.opacity = rr * 0.55; this.rain.visible = rr > 0.02;
    if (this.rain.visible) {
      const p = this.rainGeo.attributes.position.array, fall = 9 * dt, wx = Math.sin(wd) * this.cur.wind * 0.08, wz = -Math.cos(wd) * this.cur.wind * 0.08;
      const n = Math.floor(this.rainN * Math.min(1, rr * 1.2));
      for (let i = 0; i < this.rainN; i++) {
        const s = i * 3; this.rainSeed[s + 1] -= fall * 1.0; if (this.rainSeed[s + 1] < 0) { this.rainSeed[s + 1] += 45; this.rainSeed[s] = (Math.random() - .5) * 90; this.rainSeed[s + 2] = (Math.random() - .5) * 90; }
        const o = i * 6; if (i >= n) { p[o] = p[o + 3] = 0; p[o + 1] = p[o + 4] = -9999; p[o + 2] = p[o + 5] = 0; continue; }
        const x = playerPos.x + this.rainSeed[s], y = playerPos.y - 8 + this.rainSeed[s + 1], z = playerPos.z + this.rainSeed[s + 2];
        p[o] = x; p[o + 1] = y; p[o + 2] = z; p[o + 3] = x + wx * 0.6; p[o + 4] = y - 0.55; p[o + 5] = z + wz * 0.6;
      }
      this.rainGeo.attributes.position.needsUpdate = true;
    }
    // surface wetness: builds in rain, dries in sun/wind
    this.wet = THREE.MathUtils.clamp(this.wet + (rr > 0.05 ? dt * simSpeed * rr / 600 : -dt * simSpeed * (0.2 + dayAmt) / 2400), 0, 1);

    // lightning
    this.flash = Math.max(0, this.flash - dt * 6);
    if (WX[this.state].bolt && this.cur.rain > 0.6) { this.boltTimer -= dt; if (this.boltTimer <= 0) { this.boltTimer = 5 + Math.random() * 18; const dist = 600 + Math.random() * 8000; this.flash = Math.min(1, 2500 / dist) * 0.5; this.thunder(dist); } }

    // audio mix
    if (this.audio) { const a = this.audio, t = a.ctx.currentTime; a.wind.g.gain.setTargetAtTime(0.02 + this.cur.wind * 0.012, t, 0.5); a.rain.g.gain.setTargetAtTime(rr * 0.22, t, 0.5); a.rainLow.g.gain.setTargetAtTime(rr * 0.12, t, 0.5); }

    // ambient temperature: diurnal swing around October normals (~84°F high / 60°F low), cooled by cloud/rain
    if (!(this.mode === 'live' && this.live?.tempF != null)) {
      const hr = (simDate.getUTCHours() - 5 + 24) % 24 + simDate.getUTCMinutes() / 60;
      const base = 72 + 12 * Math.sin((hr - 9) / 24 * 2 * Math.PI) - this.cur.cover * 5 - this.cur.rain * 6;
      this.tempF += (base - this.tempF) * Math.min(1, dt * simSpeed / 1800);
    }
    return { sunV, dayAmt };
  }
}

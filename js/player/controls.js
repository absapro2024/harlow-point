// Touch controls (iOS-first): virtual joystick + drag-to-look + action buttons.
// Left-handed mode swaps the sides. Dev mode (?dev=1) adds WASD + mouse look.
import { settings } from '../core/settings.js';
export class Controls {
  constructor(el) {
    this.move = { x: 0, y: 0 }; this.lookDX = 0; this.lookDY = 0; this.sprint = false; this.enabled = true;
    this.stickTouch = null; this.lookTouch = null; this.keys = {};
    this.stick = document.getElementById('stick'); this.knob = document.getElementById('knob');
    el.addEventListener('touchstart', e => this.ts(e), { passive: false });
    el.addEventListener('touchmove', e => this.tm(e), { passive: false });
    el.addEventListener('touchend', e => this.te(e)); el.addEventListener('touchcancel', e => this.te(e));
    addEventListener('keydown', e => { this.keys[e.code] = true; });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    el.addEventListener('mousedown', () => { if (this.enabled && !('ontouchstart' in window)) el.requestPointerLock?.(); });
    addEventListener('blur', () => { this.keys = {}; });
    addEventListener('mousemove', e => { if (document.pointerLockElement) { this.lookDX += e.movementX * 0.6; this.lookDY += e.movementY * 0.6; } });
  }
  isStickSide(x) { const left = x < innerWidth * 0.45; return settings.leftHanded ? !left : left; }
  ts(e) {
    if (!this.enabled) return; e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.isStickSide(t.clientX) && this.stickTouch === null) { this.stickTouch = t.identifier; this.sx = t.clientX; this.sy = t.clientY;
        this.stick.style.left = (t.clientX - 60) + 'px'; this.stick.style.top = (t.clientY - 60) + 'px'; this.stick.classList.add('active'); }
      else if (this.lookTouch === null) { this.lookTouch = t.identifier; this.lx = t.clientX; this.ly = t.clientY; }
    }
  }
  tm(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.stickTouch) { let dx = t.clientX - this.sx, dy = t.clientY - this.sy; const m = Math.hypot(dx, dy), r = 50; if (m > r) { dx *= r / m; dy *= r / m; }
        this.move.x = dx / r; this.move.y = -dy / r; this.knob.style.transform = `translate(${dx}px,${dy}px)`; }
      if (t.identifier === this.lookTouch) { this.lookDX += (t.clientX - this.lx) * 2.2; this.lookDY += (t.clientY - this.ly) * 2.2; this.lx = t.clientX; this.ly = t.clientY; }
    }
  }
  te(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.stickTouch) { this.stickTouch = null; this.move.x = this.move.y = 0; this.knob.style.transform = ''; this.stick.classList.remove('active'); }
      if (t.identifier === this.lookTouch) this.lookTouch = null;
    }
  }
  read() {
    let mx = this.move.x, my = this.move.y;
    if (this.keys.KeyW || this.keys.ArrowUp) my = 1; if (this.keys.KeyS || this.keys.ArrowDown) my = -1; if (this.keys.KeyA || this.keys.ArrowLeft) mx = -1; if (this.keys.KeyD || this.keys.ArrowRight) mx = 1;
    const k = 0.0032 * settings.lookSensitivity;
    const out = { mx, my, look: this.lookDX * k, pitch: this.lookDY * k * (settings.invertY ? -1 : 1) };
    this.lookDX = this.lookDY = 0; return out;
  }
  reset() { this.move.x = this.move.y = 0; this.stickTouch = this.lookTouch = null; this.knob.style.transform = ''; this.keys = {}; }
}

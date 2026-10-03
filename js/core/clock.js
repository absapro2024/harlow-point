// In-game clock and calendar. 1 real second = 1 game minute by default (12-min real shift).
export const SHIFTS = [
  { id: 'day', name: 'Day Shift', start: 6 * 60, end: 18 * 60 },
  { id: 'night', name: 'Night Shift', start: 18 * 60, end: 30 * 60 },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOLIDAYS = { 4: 'Founders Day (fictional company holiday)' };
export class Clock {
  constructor() { this.day = 0; this.minute = 6 * 60 + 40; this.scale = 1; this.paused = false; this._hooks = []; }
  tick(dt) {
    if (this.paused) return;
    const prev = this.minute;
    this.minute += dt * this.scale;
    if (this.minute >= 1440) { this.minute -= 1440; this.day++; }
    for (const h of this._hooks) if (crossed(prev, this.minute, h.at)) h.fn();
  }
  at(minute, fn) { this._hooks.push({ at: minute, fn }); }
  advance(mins) { this.minute += mins; while (this.minute >= 1440) { this.minute -= 1440; this.day++; } }
  get hour() { return this.minute / 60; }
  get dayName() { return DAYS[this.day % 7]; }
  get isWeekend() { return this.day % 7 >= 5; }
  get holiday() { return HOLIDAYS[this.day] || null; }
  get shift() { const m = this.minute; return m >= 360 && m < 1080 ? SHIFTS[0] : SHIFTS[1]; }
  get period() { const h = this.hour; return h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'; }
  fmt() { const m = Math.floor(this.minute); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
  label() { return `${this.dayName} D${this.day + 1} ${this.fmt()}`; }
  toJSON() { return { day: this.day, minute: this.minute }; }
  load(d) { this.day = d.day; this.minute = d.minute; }
}
function crossed(a, b, t) { return b >= a ? a < t && b >= t : a < t || b >= t; }

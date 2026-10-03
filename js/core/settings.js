// Accessibility & gameplay settings (persisted separately from saves).
const KEY = 'hp_settings_v1';
export const defaults = {
  difficulty: 'standard',        // relaxed | standard | demanding
  simplifiedHealth: false,
  reducedFatigue: false,
  reminders: true,
  colorBlind: false,             // swaps red/green access cues for blue/orange + icons
  subtitles: true,
  reducedReading: false,         // shorter text everywhere
  guidedNav: true,               // waypoint arrow to current objective
  disableStressEvents: false,    // skips drills / alarms
  lookSensitivity: 1.0,
  invertY: false,
  leftHanded: false,             // swaps joystick & look sides (touch remap)
  timeScale: 1,
  showAIThoughts: true,          // shows each NPC's current goal above their head
};
export const settings = { ...defaults, ...(JSON.parse(localStorage.getItem(KEY) || '{}')) };
export function saveSettings() { localStorage.setItem(KEY, JSON.stringify(settings)); }

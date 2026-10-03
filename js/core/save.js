// Versioned save system: localStorage slots + export/import code (protects against Safari storage eviction).
const VERSION = 1;
const slotKey = s => `hp_save_slot_${s}`;
export function writeSave(slot, data) {
  const blob = { version: VERSION, savedAt: Date.now(), ...data };
  localStorage.setItem(slotKey(slot), JSON.stringify(blob));
  return blob;
}
export function readSave(slot) {
  const raw = localStorage.getItem(slotKey(slot));
  if (!raw) return null;
  const d = JSON.parse(raw);
  return migrate(d);
}
export function hasSave(slot) { return !!localStorage.getItem(slotKey(slot)); }
export function exportCode(slot) { const r = localStorage.getItem(slotKey(slot)); return r ? btoa(unescape(encodeURIComponent(r))) : ''; }
export function importCode(slot, code) {
  const json = decodeURIComponent(escape(atob(code.trim())));
  JSON.parse(json); localStorage.setItem(slotKey(slot), json);
}
function migrate(d) { /* future: if (d.version < 2) {...} */ return d; }

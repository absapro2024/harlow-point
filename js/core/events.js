// Event bus. Every gameplay fact is broadcast here so systems (missions, AI perception,
// director, radio) can react without hard dependencies on each other.
const listeners = new Map();
export const bus = {
  on(type, fn) { (listeners.get(type) || listeners.set(type, []).get(type)).push(fn); },
  emit(type, data = {}) {
    for (const fn of listeners.get(type) || []) fn(data);
    for (const fn of listeners.get('*') || []) fn({ type, ...data });
  },
};

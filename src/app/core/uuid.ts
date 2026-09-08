/**
 * UUID v4 generator that works everywhere. `crypto.randomUUID()` would
 * be nicer but only exists in secure contexts (HTTPS or localhost); the
 * app is served over http on the LAN IP for phone testing, so we need a
 * Math.random fallback for that case. Collision probability at the
 * scale a client mints them (session / workout ids) is astronomical.
 */
export function uuidV4(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

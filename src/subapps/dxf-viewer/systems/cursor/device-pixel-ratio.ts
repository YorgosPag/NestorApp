/**
 * device-pixel-ratio — SSoT for *changes* to `window.devicePixelRatio` (ADR-549 Phase 7).
 *
 * `getDevicePixelRatio()` (./utils) reads the CURRENT ratio; this module fires when it
 * CHANGES. A DPR change happens with NO element-size change — dragging the window to a
 * monitor with different OS scaling, or changing the OS display scaling while the app is
 * open. ResizeObserver does NOT fire then, so every viewport canvas keeps a backing store
 * sized for the OLD dpr → a permanent backing-store↔CSS mismatch in a fixed region (the
 * «trails in the same area, suddenly, after days» bug). Big players (Three.js examples,
 * Figma, Google Maps) re-rasterize on DPR change; this is the web-canonical mechanism.
 *
 * `matchMedia('(resolution: <X>dppx)')` matches only the CURRENT dpr, so it flips to
 * non-matching the instant dpr changes — we listen for that flip, then RE-ARM a fresh
 * query for the new dpr (a single query cannot watch "any" dpr). One shared listener
 * fans out to all subscribers; the media query is torn down when the last unsubscribes.
 *
 * @module systems/cursor/device-pixel-ratio
 */

import { getDevicePixelRatio } from './utils';

/** Notified with the NEW device pixel ratio whenever it changes. */
export type DevicePixelRatioListener = (dpr: number) => void;

const listeners = new Set<DevicePixelRatioListener>();
let mediaQuery: MediaQueryList | null = null;
let lastDpr = getDevicePixelRatio();

/** (Re)arm a media query bound to the CURRENT dpr; it flips when the dpr changes. */
function arm(): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  if (mediaQuery) mediaQuery.removeEventListener('change', onChange);
  mediaQuery = window.matchMedia(`(resolution: ${lastDpr}dppx)`);
  mediaQuery.addEventListener('change', onChange);
}

function onChange(): void {
  const next = getDevicePixelRatio();
  // Re-arm FIRST so we never miss a rapid second change while notifying.
  if (next !== lastDpr) {
    lastDpr = next;
    arm();
    listeners.forEach((cb) => cb(next));
  } else {
    arm();
  }
}

/**
 * Subscribe to device-pixel-ratio CHANGES. The callback receives the new dpr. Returns an
 * unsubscribe fn; the shared media query is created on the first subscriber and torn down
 * after the last. Safe to call during SSR (no-op without `window.matchMedia`).
 */
export function subscribeDevicePixelRatio(cb: DevicePixelRatioListener): () => void {
  if (listeners.size === 0) {
    lastDpr = getDevicePixelRatio();
    arm();
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && mediaQuery) {
      mediaQuery.removeEventListener('change', onChange);
      mediaQuery = null;
    }
  };
}

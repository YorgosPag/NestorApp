/**
 * FontReadyStore — singleton signal fired when CAD glyph fonts finish loading
 * into the FontCache (ADR-530).
 *
 * Mirrors the MissingFontStore / HoverStore pattern (ADR-040): module-level
 * mutable state + subscriber set, low-frequency updates (once per font batch).
 * The DXF canvas renderer subscribes to this and invalidates its bitmap cache so
 * the entity layer rebuilds with glyph-path text instead of the CSS fallback.
 *
 * The font itself is NOT part of the bitmap cache key — loading is a one-time
 * event, so a single invalidate() on `bumpFontReady()` is ADR-040 compliant
 * (same contract as `subscribeLayerStore` → `bitmapCache.invalidate()`).
 *
 * @module text-engine/fonts/font-ready-store
 */

import { createExternalStore } from '../../stores/createExternalStore';

type Listener = () => void;

// SSoT pub/sub via createExternalStore (WAVE 2.6). No `equals` — `bumpFontReady`
// always increments, so every call is a real change anyway.
const store = createExternalStore<number>(0);

// ─── Mutation API ─────────────────────────────────────────────────────────────

/** Called by the font preloader after a font batch lands in FontCache. */
export function bumpFontReady(): void {
  store.set(store.get() + 1);
}

// ─── useSyncExternalStore / subscription interface ────────────────────────────

export function subscribeFontReady(listener: Listener): () => void {
  return store.subscribe(listener);
}

/** Monotonic counter — increments each time a new font batch becomes available. */
export function getFontReadyVersion(): number {
  return store.get();
}

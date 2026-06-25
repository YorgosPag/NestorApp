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

type Listener = () => void;

// ─── Internal mutable state ───────────────────────────────────────────────────

let version = 0;
const subscribers = new Set<Listener>();

// ─── Mutation API ─────────────────────────────────────────────────────────────

/** Called by the font preloader after a font batch lands in FontCache. */
export function bumpFontReady(): void {
  version += 1;
  subscribers.forEach((cb) => cb());
}

// ─── useSyncExternalStore / subscription interface ────────────────────────────

export function subscribeFontReady(listener: Listener): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

/** Monotonic counter — increments each time a new font batch becomes available. */
export function getFontReadyVersion(): number {
  return version;
}

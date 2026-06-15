/**
 * Pointer rect cache (ADR-040 — cursor-lag Φ5).
 *
 * The high-frequency mousemove path used to call `element.getBoundingClientRect()`
 * on EVERY event (forced synchronous layout/reflow). On a heavy page (ribbon +
 * panels + canvas layers) that is 2-10ms per event × ~60-120 events/s → the
 * browser input queue backs up → the crosshair visibly lags behind the mouse.
 *
 * This module caches the canvas DOMRect and re-reads it only when it can actually
 * have changed:
 *   - `ResizeObserver` on the element — size changes (panel toggles that reflow
 *     the canvas; the canvas is `absolute inset-0`, so a container move/resize
 *     resizes it too).
 *   - `window` 'scroll' (capture) — any ancestor scroll shifts the rect.
 *   - `window` 'resize'.
 *   - `window` 'mousedown' (capture) — guarantees a fresh rect at the start of
 *     every click / drag / pan, where picking precision matters most.
 *
 * Worst-case staleness = a hover that crosses a layout change with no scroll /
 * resize / mousedown in between → at most a few px of cosmetic crosshair offset,
 * corrected on the next interaction. Picking / snapping stay exact because every
 * mousedown refreshes the rect.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

let cachedElement: HTMLElement | null = null;
let cachedRect: DOMRect | null = null;
let dirty = true;
let observer: ResizeObserver | null = null;
let globalListenersBound = false;

function markDirty(): void {
  dirty = true;
}

function ensureGlobalListeners(): void {
  if (globalListenersBound || typeof window === 'undefined') return;
  globalListenersBound = true;
  // capture: catch scrolls of ANY ancestor container, not just window.
  window.addEventListener('scroll', markDirty, { capture: true, passive: true });
  window.addEventListener('resize', markDirty, { passive: true });
  // mousedown (capture) → rect is always fresh before a click/drag/pan begins.
  window.addEventListener('mousedown', markDirty, { capture: true, passive: true });
}

/**
 * Returns the (cached) bounding rect for `element`, re-reading from the DOM only
 * when the cache is dirty or the element changed. Eliminates per-mousemove reflow.
 */
export function getCachedClientRect(element: HTMLElement): DOMRect {
  ensureGlobalListeners();

  if (element !== cachedElement) {
    cachedElement = element;
    dirty = true;
    observer?.disconnect();
    observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(markDirty) : null;
    observer?.observe(element);
  }

  if (dirty || !cachedRect) {
    cachedRect = element.getBoundingClientRect();
    dirty = false;
  }

  return cachedRect;
}

/** Force the next `getCachedClientRect` to re-read from the DOM. */
export function invalidatePointerRectCache(): void {
  dirty = true;
}

/** Test / teardown helper — drops the cache, observer and element binding. */
export function resetPointerRectCache(): void {
  observer?.disconnect();
  observer = null;
  cachedElement = null;
  cachedRect = null;
  dirty = true;
}

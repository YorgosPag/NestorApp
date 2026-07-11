/**
 * ADR-639 Στάδιο 5 — WebGL line-layer content-invalidation SSoT.
 *
 * ONE place lists the low-frequency stores whose changes alter the RESOLVED style of
 * a line (colour / lineweight / alpha / visibility) and therefore require rebuilding
 * the persistent GPU buffers. The leaf (STEP 10) wires this to `manager.invalidate()`.
 *
 * These are exactly the CONTENT triggers of the bitmap `CacheKey`
 * (`dxf-bitmap-cache.ts`) MINUS transform (scale/offset — camera-only in Στάδιο 5)
 * and MINUS interaction identity (hover/selection/grip — ADR-040 rule 3, never a
 * rebuild). Centralising them here means the WebGL rebuild list can never silently
 * drift from the Canvas2D invalidation list (N.18):
 *   • LayerStore     — visible / frozen / colour (resolveEntityRenderStyle input)
 *   • IsolateEffects — dim alpha (applyIsolateAlpha)
 *   • LWDISPLAY      — global lineweight toggle (gatePx)
 *   • BimRenderSettings — drawingScale / viewRange / dxfImport projection colour+lineweight
 *
 * Deliberately NOT subscribed (they do not change solid-line geometry/colour on the
 * GPU layer): font-ready and canvas-background/theme (affect text glyphs + dim-text
 * masks, which stay on Canvas2D), and print-colour-policy (active only during the
 * offscreen print render, a separate Canvas2D path — the live GPU layer never prints).
 *
 * @see canvas-v2/dxf-canvas/useDxfCanvasCacheInvalidation.ts — the Canvas2D sibling
 * @see canvas-v2/dxf-canvas/dxf-renderer-style-resolve.ts — the resolved-style inputs
 */

import { subscribeIsolateEffects } from '../../systems/isolate/IsolateEffectsStore';
import { subscribeLayerStore } from '../../stores/LayerStore';
import { subscribeLineweightDisplay } from '../../stores/LineweightDisplayStore';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';

/**
 * Subscribe to every content signal that invalidates the GPU line buffers. Fires
 * `callback` on any change; returns a single unsubscribe that tears down all of them.
 */
export function subscribeContentInvalidation(callback: () => void): () => void {
  const unsubscribes: Array<() => void> = [
    subscribeLayerStore(callback),
    subscribeIsolateEffects(callback),
    subscribeLineweightDisplay(callback),
    useBimRenderSettingsStore.subscribe(callback),
  ];
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}

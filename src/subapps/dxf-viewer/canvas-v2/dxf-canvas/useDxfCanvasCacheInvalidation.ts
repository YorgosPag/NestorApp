/**
 * useDxfCanvasCacheInvalidation — bitmap-cache dirty/invalidate subscriptions.
 *
 * Extracted from `dxf-canvas-renderer.ts` (file-size SRP split, N.7.1) — the store
 * subscriptions that mark the DxfCanvas dirty (and, where the changed state is read at
 * entity-paint time rather than baked into the cache key, imperatively invalidate the
 * hybrid bitmap cache). Pure lifecycle wiring: no change to the hot `renderScene` RAF
 * callback, so the ADR-040 micro-leaf render path is untouched.
 *
 * Invalidate (state read at paint time, NOT in the cache key → force rebuild):
 *   - Isolate effects (ADR-358 §5.6.bis Φ10) · LayerStore flags · CAD glyph fonts (ADR-530)
 *   - LWDISPLAY toggle (ADR-510 Φ2G) · canvas background/theme (ADR-608)
 * Dirty-only (state already IN the cache key → a dirty mark re-evaluates it):
 *   - BIM render settings (ADR-375 Φ B: drawingScale / viewRange / objectStyles)
 *
 * @module canvas-v2/dxf-canvas/useDxfCanvasCacheInvalidation
 * @see canvas-v2/dxf-canvas/dxf-canvas-renderer — the consumer
 * @see ADR-040 — Preview Canvas Performance (bitmap cache invalidation rules)
 */

import { useEffect } from 'react';
import type { DxfBitmapCache } from './dxf-bitmap-cache';
// ADR-358 §5.6.bis Phase 10 — re-render on isolate state change.
import { subscribeIsolateEffects } from '../../systems/isolate/IsolateEffectsStore';
// ADR-358 §5.6.bis Phase 10 — re-render on LayerStore mutations (visible/frozen toggles).
import { subscribeLayerStore } from '../../stores/LayerStore';
// ADR-510 Φ2G — global LWDISPLAY toggle: read at entity-paint time (not the cache
// key), so a flip must invalidate the normal-state bitmap (same contract as LayerStore).
import { subscribeLineweightDisplay } from '../../stores/LineweightDisplayStore';
import { subscribeCanvasBackgroundChange } from '../../config/canvas-theme';
// ADR-510 Φ2E #4 — user-created linetype PATTERN edits (inline «Τμήματα Μοτίβου»
// COW editor) mutate the LinetypeRegistry in place. The dash is derived at
// entity-paint time (resolveEntityRenderStyle → resolveLinetypePatternMm → registry)
// and is NOT part of the bitmap cache key, so a same-name pattern update must
// invalidate to repaint — identical contract to LWDISPLAY/LayerStore/isolate below.
import { subscribeLinetypeRegistry } from '../../stores/LinetypeRegistry';
// ADR-375 Phase B — re-render on BIM render-settings changes (drawingScale / viewRange / objectStyles).
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
// ADR-530 — preload CAD glyph fonts + rebuild the bitmap layer once they land.
import { preloadCadSubstituteFonts, subscribeFontReady } from '../../text-engine/fonts';
// ADR-654 — μια raster εικόνα (entourage sprite / hatch image-fill) φτάνει ΑΣΥΓΧΡΟΝΑ,
// αφού ο cache έχει ήδη χτιστεί με το placeholder. Δεν είναι μέρος του cache key (one-time
// event, ίδιο συμβόλαιο με τα CAD fonts) → invalidate ώστε να ξαναχτιστεί το entity layer.
import { subscribeImageAssetReady } from '../../rendering/entities/shared/hatch-image-cache';

/**
 * Register the DxfCanvas bitmap-cache dirty/invalidate store subscriptions. `bitmapCacheRef`
 * is the renderer's cache ref (invalidated for paint-time state); `isDirtyRef` is the RAF
 * dirty flag (set for every tracked change so the next frame repaints).
 */
export function useDxfCanvasCacheInvalidation(
  bitmapCacheRef: React.MutableRefObject<DxfBitmapCache | null>,
  isDirtyRef: React.MutableRefObject<boolean>,
): void {
  // ADR-358 §5.6.bis Phase 10 — mark dirty on IsolateEffectsStore changes
  // (toggle isolate → dim opacity slider drag → mode swap). Zero-cost when
  // store is idle (single Set entry, no notifications until command fires).
  useEffect(() => {
    return subscribeIsolateEffects(() => {
      // ADR-040 Phase D wiring: isolate alpha is applied at entity-paint time and
      // is NOT part of the bitmap cache key → invalidate so the layer rebuilds.
      bitmapCacheRef.current?.invalidate();
      isDirtyRef.current = true;
    });
  }, [bitmapCacheRef, isDirtyRef]);

  // ADR-358 §5.6.bis Phase 10 — mark dirty on LayerStore mutations (Phase 8
  // visibility toggle, Phase 10 LayerOff/Freeze/Lock, etc). The renderer
  // reads layer flags from LayerStore as the runtime SSoT.
  useEffect(() => {
    return subscribeLayerStore(() => {
      // ADR-040 Phase D wiring: visible/frozen/lock/colour flags are read from
      // LayerStore at paint time (not the cache key) → invalidate to force rebuild.
      bitmapCacheRef.current?.invalidate();
      isDirtyRef.current = true;
    });
  }, [bitmapCacheRef, isDirtyRef]);

  // ADR-375 Phase B — mark dirty on BIM render-settings changes (DrawingScale,
  // ViewRange, ObjectStyles). Bitmap cache key already includes these fields,
  // so a dirty mark forces re-evaluation and rebuild on the next frame.
  useEffect(() => {
    return useBimRenderSettingsStore.subscribe(() => {
      isDirtyRef.current = true;
    });
  }, [isDirtyRef]);

  // ADR-530 — preload the CAD glyph font(s) once on mount, then rebuild the
  // entity layer when they land so text re-renders as glyph paths instead of the
  // CSS fillText fallback. Font availability is NOT part of the bitmap cache key
  // (one-time event), so a single invalidate() on the ready signal is ADR-040
  // compliant — same contract as the LayerStore subscription above.
  useEffect(() => {
    const unsubscribe = subscribeFontReady(() => {
      bitmapCacheRef.current?.invalidate();
      isDirtyRef.current = true;
    });
    void preloadCadSubstituteFonts();
    return unsubscribe;
  }, [bitmapCacheRef, isDirtyRef]);

  // ADR-654 — invalidate όταν προσγειώνεται decoded raster εικόνα (entourage sprite /
  // furniture-plan sprite / hatch image-fill). Το πρώτο paint είναι ΠΑΝΤΑ placeholder
  // (async `img.decode()`), και το `markAllCanvasDirty` του cache ΜΟΝΟ του δεν αρκεί: το
  // key δεν άλλαξε → cache HIT → blit του stale bitmap. Ίδιο συμβόλαιο με το subscribeFontReady.
  useEffect(() => {
    return subscribeImageAssetReady(() => {
      bitmapCacheRef.current?.invalidate();
      isDirtyRef.current = true;
    });
  }, [bitmapCacheRef, isDirtyRef]);

  // ADR-510 Φ2G — mark dirty when the global "Show Lineweight" (LWDISPLAY) toggle
  // flips. The resolved px width is read at entity-paint time (resolveEntityRenderStyle
  // → getShowLineweight), NOT baked into the bitmap cache key → invalidate to rebuild.
  useEffect(() => {
    return subscribeLineweightDisplay(() => {
      bitmapCacheRef.current?.invalidate();
      isDirtyRef.current = true;
    });
  }, [bitmapCacheRef, isDirtyRef]);

  // ADR-608 — invalidate on canvas background/theme change: dim-text «Φόντο σχεδίου» masks bake the
  // LIVE background (`resolveDxfCanvasBackgroundHex`), which is NOT in the cache key. Same as LWDISPLAY.
  useEffect(() => {
    return subscribeCanvasBackgroundChange(() => {
      bitmapCacheRef.current?.invalidate();
      isDirtyRef.current = true;
    });
  }, [bitmapCacheRef, isDirtyRef]);

  // ADR-510 Φ2E #4 — invalidate when a user-created linetype's PATTERN changes
  // (inline «Τμήματα Μοτίβου» COW editor calls `upsertUserLinetype` on each edit).
  // The dash is resolved from the registry at entity-paint time (NOT the cache key),
  // so a same-name pattern update repaints only via this invalidate — same contract
  // as LWDISPLAY above. Low-frequency (linetype edits are rare, like the isolate
  // opacity slider), so a full-layer rebuild here is ADR-040 compliant.
  useEffect(() => {
    return subscribeLinetypeRegistry(() => {
      bitmapCacheRef.current?.invalidate();
      isDirtyRef.current = true;
    });
  }, [bitmapCacheRef, isDirtyRef]);
}

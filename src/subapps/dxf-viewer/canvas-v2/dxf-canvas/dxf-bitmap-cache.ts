/**
 * DXF BITMAP CACHE — Phase D RE-IMPLEMENT (ADR-040, 2026-05-09)
 *
 * Hybrid bitmap cache for the DXF entity layer (AutoCAD dual-buffer pattern).
 * The cache contains ONLY normal-state entity rendering. Interactive state
 * (hover, selection grips, drag preview) is rendered as a single-entity overlay
 * on top of the blit by DxfRenderer.renderSingleEntity().
 *
 * ARCHITECTURAL RULE — DO NOT VIOLATE:
 * Bitmap cache invalidation triggers are LIMITED to:
 *   - scene reference
 *   - viewport size
 *   - device pixel ratio
 *
 * Including hoveredEntityId / selectedEntityIds / gripInteractionState / dragPreview
 * in the cache key WILL cause the cache to invalidate at ~60Hz on hover and
 * trigger a full N-entity rebuild per frame, freezing the page (Phase D v1 incident).
 *
 * ANCHORED RASTER — ADR-726 Φ3 (2026-07-29), ADR-040 Phase XXII.B part 2:
 * `transform.scale/offsetX/offsetY` are NO LONGER part of the key. They used to be, which
 * made every pan/zoom frame a MISS BY DESIGN: measured `frame:dxf-canvas` **min 32,7ms**
 * across every sampled pan frame (98,3% of the frame budget, ~12 FPS) because all 2.996
 * entities were re-rasterised offscreen per frame. The raster is now built with an
 * OVERSCAN margin at an *anchor* transform and projected onto the live transform with a
 * single `drawImage` (see `dxf-bitmap-cache-anchor` for the geometry). It is rebuilt only
 * when the raster can no longer serve the view (hole / too magnified), when a structural
 * input changes, or ~120ms after the gesture stops (idle re-raster, which also re-centres
 * the overscan so the next gesture gets its budget back).
 *
 * GESTURE-AWARE ACCEPTANCE — ADR-726 Φ3.1 (2026-07-30):
 * "hole / too magnified" are REST-TIME criteria. While `isNavigationGesture()` is true the
 * raster is served AS-IS — no transform-driven rebuild ever runs mid-gesture (measured in
 * production: judging quality mid-gesture caused 75-185ms full re-rasters inside wheel-zoom,
 * `frame:dxf-canvas` p90 74,6ms). Structural invalidation, `invalidate()`, the idle
 * re-raster and the very first build are NOT suspended.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ADR-743 Φ1 (2026-08-03) — ΔΥΟ ΔΙΟΡΘΩΣΕΙΣ ΣΤΟ ΠΑΡΑΠΑΝΩ, ΑΠΟ ΜΕΤΡΗΣΗ
 * ──────────────────────────────────────────────────────────────────────────────
 * (α) **Ο idle re-raster ΠΑΡΕΚΑΜΠΤΕ τη Φ3.1.** Ο έλεγχος της εκκρεμότητας γίνεται ΠΡΙΝ από τον
 *     gesture guard, και `RASTER_IDLE` (120ms) < `WHEEL_IDLE` (220ms) ⇒ κάθε ησυχία ≥120ms μέσα
 *     σε ριπή ροδέλας πυροδοτούσε πλήρη ανακατασκευή. Μετρημένο: **43/43** των ανακατασκευών του
 *     zoom, **78,2%** όλου του `frame:dxf-canvas`. Θεραπεία: ο χρονιστής **ρωτά** τον ιδιοκτήτη
 *     της χειρονομίας πριν δηλώσει εκκρεμότητα → `dxf-bitmap-cache-idle-timer`.
 *
 * (β) **Το «ΩΣ ΕΧΕΙ» ήταν ΑΝΕΥ ΟΡΩΝ** — το `k` έμενε άφραγο σε εύρος κλίμακας 9 τάξεων μεγέθους.
 *     Δεν φαινόταν επειδή το (α) ξανάχτιζε κάθε 120ms και το έκρυβε· κλείνοντας το (α), εκτίθεται.
 *     Θεραπεία: **πάτωμα ποιότητας** εκφρασμένο αποκλειστικά στη μεγέθυνση (στο καθαρό pan
 *     `k ≡ 1` ⇒ αποδεδειγμένα δεν αγγίζει το pan) → `dxf-bitmap-cache-anchor`.
 *
 * ⚠️ Το δομικό κλειδί (και ο κανόνας #3 του ADR-040) ζει πλέον στο `dxf-bitmap-cache-key`.
 *    Οι αλλαγές του μόνο ΑΦΑΙΡΟΥΝ εισόδους· κάθε προσθήκη interactive κατάστασης επαναφέρει το
 *    πάγωμα της Phase D v1.
 */

import { DxfRenderer } from './DxfRenderer';
import type { DxfScene, DxfRenderOptions } from './dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import { getDevicePixelRatio, toDevicePixels } from '../../systems/cursor/utils';
// ADR-726 Φ3 — anchored-raster geometry + policy (pure, DOM-free, unit-tested).
import {
  ANCHOR_PROBE_WORLD_POINT,
  type AnchorTransform,
  type AnchoredBlitRect,
  computeAnchoredBlitRect,
  computeOverscanPx,
  isAnchoredBlitAcceptable,
  isAnchoredBlitUsable,
  isSameTransform,
  isWithinGestureMagnificationBudget,
  magnification,
  overscannedRenderTransform,
  overscannedViewport,
} from './dxf-bitmap-cache-anchor';
// ADR-743 Φ1 — ο χρονιστής ηρεμίας ΡΩΤΑΕΙ το SSoT της χειρονομίας αντί να υποθέτει από τον δικό
// του χρόνο. Δική του μονάδα γιατί ήταν ο μετρημένος ένοχος του zoom (43/43 ανακατασκευές) και
// γιατί η σύγκλισή του θέλει δικούς της φύλακες με ψεύτικους χρονιστές.
import { IdleRerasterTimer } from './dxf-bitmap-cache-idle-timer';
// ADR-726 Φ3.1 — gesture-aware acceptance: while a navigation gesture is in flight the raster
// is served AS-IS (quality criteria are rest-time criteria). Same SSoT the snap scheduler uses
// (ADR-728 Φ1) — «is the user moving the view?» has exactly one owner.
import { isNavigationGesture } from '../../systems/navigation/NavigationGestureStore';
// ADR-726 Φ3 — the ONE authority for world→screen (margins + Y-inversion). The projection
// offset is MEASURED through it, never re-derived here: a hand-written copy of this formula
// is exactly what made the raster pan the wrong way vertically.
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
// ADR-726 Φ3 — the offscreen canvas is replaced whenever its size changes; its stubbed
// bounds live in the shared bounds cache and must be evicted with it.
import { canvasBoundsService } from '../../services/CanvasBoundsService';
// ADR-743 Φ1 (N.7.1) — «άλλαξε κάτι που αλλάζει τα ΙΔΙΑ ΤΑ PIXELS;» είναι άλλη ευθύνη από
// «μπορούν αυτά τα pixels να σερβίρουν την τρέχουσα όψη;». Εκεί ζει και ο κανόνας #3 του ADR-040.
import {
  type BitmapCacheRenderInputs,
  type CacheKey,
  buildCacheKey,
  isStructurallyStale,
} from './dxf-bitmap-cache-key';
import { createModuleLogger } from '@/lib/telemetry';
// ADR-743 Φ0 — attribution: ΤΟ ΥΠΑΡΧΟΝ όργανο (ίδιο flag, ίδιος aggregator, μηδέν νέο σύστημα).
import { withPerf, recordSample, isPerfEnabled } from '../../systems/cursor/mouse-handler-perf';
import {
  RASTER_STAGES,
  rasterRebuildReasonCounter,
  type RasterRebuildReason,
} from './dxf-canvas-perf-stages';

const logger = createModuleLogger('DxfBitmapCache');

// Το δομικό κλειδί ζει στο `dxf-bitmap-cache-key` — εδώ μόνο ξανα-εξάγεται ο τύπος που
// καταναλώνει ο host renderer, ώστε η δημόσια επιφάνεια του cache να μείνει αμετάβλητη.
export type { BitmapCacheRenderInputs };

/** Wiring the cache needs from its host renderer (ADR-726 Φ3 idle re-raster). */
export interface DxfBitmapCacheOptions {
  /**
   * Mark the host canvas dirty so the scheduler runs one more frame. Called once,
   * `IDLE_RERASTER_MS` after the last transform change, to trigger the re-raster —
   * without it the raster would stay projected (and the overscan off-centre) until
   * something else happened to repaint.
   */
  requestRepaint?: () => void;
}

export class DxfBitmapCache {
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenRenderer: DxfRenderer | null = null;
  private cacheKey: CacheKey | null = null;

  // ── ADR-726 Φ3: anchored-raster state ──────────────────────────────
  /** View transform the raster was rasterised at. `null` ⇒ no usable raster. */
  private anchor: AnchorTransform | null = null;
  /** Overscan margin (CSS px per side) baked into the current raster. */
  private overscanPx = 0;
  /**
   * ADR-743 Φ1 — ο χρονιστής της ανακατασκευής ηρεμίας. Του δίνεται ο ΕΝΑΣ ιδιοκτήτης του
   * «είμαστε σε χειρονομία;» ως εξάρτηση, ώστε να μη μπορεί ποτέ να χτυπήσει μέσα σε χειρονομία.
   */
  private readonly idleReraster: IdleRerasterTimer;

  constructor(private readonly options: DxfBitmapCacheOptions = {}) {
    this.idleReraster = new IdleRerasterTimer({
      isGestureActive: isNavigationGesture,
      requestRepaint: () => this.options.requestRepaint?.(),
    });
  }

  /**
   * True when the cache cannot serve this frame and must be rebuilt first.
   *
   * ADR-743 Φ0 — η απόφαση δεν είναι πια σκέτο `boolean` εσωτερικά: υπολογίζεται η **αιτία** και
   * καταγράφεται ως μετρητής, χωρισμένη σε «μέσα σε χειρονομία / σε ηρεμία». Χωρίς αυτό, ένα
   * `frame:dxf-canvas` p90 = 120ms σε n=155 είναι αριθμός **χωρίς αιτία** — δεν ξεχωρίζει το
   * «ένα ακριβό re-raster» από το «πολλά μικρά», ούτε λέει ποιος τα ζήτησε.
   *
   * ⚠️ Η υπογραφή και η συμπεριφορά μένουν ΑΚΡΙΒΩΣ ίδιες· μόνο η παρατηρησιμότητα προστίθεται.
   */
  isDirty(
    scene: DxfScene | null,
    transform: ViewTransform,
    viewport: Viewport,
    inputs: BitmapCacheRenderInputs,
  ): boolean {
    const reason = withPerf(RASTER_STAGES.judge, () =>
      this.resolveRebuildReason(scene, transform, viewport, inputs));
    if (reason !== null && isPerfEnabled()) {
      recordSample(rasterRebuildReasonCounter(reason, isNavigationGesture()), 1);
    }
    return reason !== null;
  }

  /** Η αιτία που επιβάλλει rebuild, ή `null` όταν το raster μπορεί να εξυπηρετήσει το καρέ. */
  private resolveRebuildReason(
    scene: DxfScene | null,
    transform: ViewTransform,
    viewport: Viewport,
    inputs: BitmapCacheRenderInputs,
  ): RasterRebuildReason | null {
    if (!this.offscreenCanvas || !this.cacheKey || !this.anchor) return 'no-raster';
    // ADR-726 Φ3 — the settled-gesture re-raster: one rebuild at the live transform.
    // ADR-743 Φ1 — αυτό ΔΕΝ μπορεί πλέον να είναι αληθές μέσα σε χειρονομία: ο χρονιστής ρωτά
    // το `NavigationGestureStore` πριν δηλώσει εκκρεμότητα. Ο έλεγχος μένει ΠΡΩΤΟΣ (μια
    // εκκρεμότητα ηρεμίας νικά κάθε ποιοτικό κριτήριο), αλλά δεν παρακάμπτει πια τίποτα.
    if (this.idleReraster.isDue) return 'idle-due';
    if (isStructurallyStale(this.cacheKey, scene, viewport, inputs, getDevicePixelRatio())) {
      return 'structural';
    }
    // Transform drift is NOT staleness: the raster is re-projected while it still
    // covers the viewport sharply enough. Only then does it need rebuilding.
    return this.resolveProjectionReason(transform, viewport);
  }

  /**
   * ADR-726 Φ3 — the destination rect for `transform`, plus its magnification.
   * ONE code path, shared by the accept/reject decision and by the actual blit, so the
   * pixels that get drawn are always the ones that were judged acceptable.
   */
  private resolveBlit(
    transform: ViewTransform,
    viewport: Viewport,
  ): { rect: AnchoredBlitRect; k: number } | null {
    const canvas = this.offscreenCanvas;
    const anchor = this.anchor;
    const key = this.cacheKey;
    if (!canvas || !anchor || !key) return null;
    const k = magnification(anchor, transform);
    // Measure, do not derive: ask the world→screen SSoT where one probe point sits inside
    // the raster and where it belongs on screen now. Margins + Y-inversion come for free.
    const rect = computeAnchoredBlitRect(
      {
        raster: CoordinateTransforms.worldToScreen(
          ANCHOR_PROBE_WORLD_POINT,
          overscannedRenderTransform(anchor, this.overscanPx),
          overscannedViewport(viewport, this.overscanPx),
        ),
        screen: CoordinateTransforms.worldToScreen(ANCHOR_PROBE_WORLD_POINT, transform, viewport),
      },
      k,
      canvas.width,
      canvas.height,
      key.dpr,
    );
    return { rect, k };
  }

  /**
   * ADR-726 Φ3 — can the anchored raster still be projected onto `transform`?
   * `null` ⇒ ναι· διαφορετικά η αιτία της άρνησης (ADR-743 Φ0).
   */
  private resolveProjectionReason(
    transform: ViewTransform,
    viewport: Viewport,
  ): RasterRebuildReason | null {
    const key = this.cacheKey;
    const resolved = this.resolveBlit(transform, viewport);
    if (!key || !resolved) return 'unusable';
    // A numerically unusable projection can never be shown (drawImage no-ops on
    // non-finite args) — rebuild regardless of any gesture.
    if (!isAnchoredBlitUsable(resolved.rect, resolved.k)) return 'unusable';
    // ADR-726 Φ3.1 — gesture-aware acceptance (Google Maps/Figma pattern): while a
    // navigation gesture is in flight, sharpness/coverage are NOT judged — they are REST-TIME
    // criteria, and judging them mid-gesture is what caused the measured 75-185ms full
    // re-rasters inside wheel-zoom (production, 2026-07-30).
    //
    // ADR-743 Φ1 — «ΩΣ ΕΧΕΙ» δεν σημαίνει «σε οποιαδήποτε κατάσταση»: εφαρμόζεται **πάτωμα**
    // ποιότητας εκφρασμένο αποκλειστικά στη μεγέθυνση. Στο καθαρό pan `k ≡ 1`, άρα το πάτωμα
    // αποδεδειγμένα δεν αγγίζει το pan (που μετρήθηκε compositing-bound με μηδέν ανακατασκευές).
    // Το σκεπτικό και τα δύο παράγωγα όρια: `dxf-bitmap-cache-anchor`.
    if (isNavigationGesture()) {
      const withinBudget = isWithinGestureMagnificationBudget({
        magnification: resolved.k,
        dpr: key.dpr,
        viewport,
        overscanPx: this.overscanPx,
      });
      return withinBudget ? null : 'quality';
    }
    const acceptable = isAnchoredBlitAcceptable({
      rect: resolved.rect,
      magnification: resolved.k,
      dpr: key.dpr,
      physW: toDevicePixels(viewport.width, key.dpr),
      physH: toDevicePixels(viewport.height, key.dpr),
    });
    return acceptable ? null : 'quality';
  }

  /**
   * Force the next isDirty() to return true. Used for inputs that affect the
   * cached entity layer but are NOT part of the key — isolate alpha and
   * LayerStore visible/frozen/colour flags, which the renderer reads from their
   * stores at paint time. The renderer subscribes to those stores and calls this.
   */
  invalidate(): void {
    this.cacheKey = null;
    this.anchor = null;
    this.idleReraster.standDown();
  }

  /**
   * Render the scene to the offscreen canvas in pure normal-state
   * (skipInteractive=true). Reuses an offscreen DxfRenderer instance.
   */
  rebuild(
    scene: DxfScene | null,
    transform: ViewTransform,
    viewport: Viewport,
    baseOptions: Pick<DxfRenderOptions, 'showGrid' | 'showLayerNames' | 'wireframeMode'>,
  ): void {
    if (viewport.width <= 0 || viewport.height <= 0) return;

    const dpr = getDevicePixelRatio();
    // ADR-726 Φ3 — rasterise a margin BEYOND the viewport on every side so a pan can be
    // served by re-projection instead of a rebuild. Shifting the render offset by the
    // margin is what maps raster pixel (M,M) onto viewport pixel (0,0).
    const overscanPx = computeOverscanPx(viewport);
    const rasterViewport = overscannedViewport(viewport, overscanPx);
    // ADR-743 Φ0 — χωριστά: η (σπάνια) δημιουργία/αλλαγή μεγέθους backing store δεν πρέπει να
    // χρεώνεται στο raster των οντοτήτων. Στο steady state είναι idempotent no-op.
    withPerf(RASTER_STAGES.ensureOffscreen, () => this.ensureOffscreen(rasterViewport, dpr));

    const renderer = this.offscreenRenderer;
    if (!renderer) return;

    try {
      renderer.render(
        scene,
        { ...transform, ...overscannedRenderTransform(transform, overscanPx) },
        rasterViewport,
        {
          showGrid: baseOptions.showGrid,
          showLayerNames: baseOptions.showLayerNames,
          wireframeMode: baseOptions.wireframeMode,
          selectedEntityIds: [],
          hoveredEntityId: null,
          skipInteractive: true,
        },
      );

      this.cacheKey = buildCacheKey(scene, viewport, baseOptions, dpr);
      this.anchor = { scale: transform.scale, offsetX: transform.offsetX, offsetY: transform.offsetY };
      this.overscanPx = overscanPx;
      // A fresh raster IS the settled state — cancel any pending re-raster (idempotent:
      // rebuilding twice at the same transform leaves exactly this state).
      this.idleReraster.standDown();
    } catch (error) {
      logger.error('Bitmap cache rebuild failed', { error });
      this.cacheKey = null;
      this.anchor = null;
    }
  }

  /**
   * Project the cached raster onto the visible canvas for `transform` (ADR-726 Φ3).
   * Caller's ctx is expected to have its DPR transform applied (setupCanvasContext).
   *
   * When `transform` equals the anchor this is the classic 1:1 blit; otherwise the
   * destination rect expresses the pan/zoom difference — ONE `drawImage` instead of a
   * 2.996-entity rebuild.
   */
  blit(targetCtx: CanvasRenderingContext2D, viewport: Viewport, transform: ViewTransform): void {
    const canvas = this.offscreenCanvas;
    const key = this.cacheKey;
    const resolved = this.resolveBlit(transform, viewport);
    if (!canvas || !key || !resolved) return;
    const dpr = key.dpr;
    const physW = toDevicePixels(viewport.width, dpr);
    const physH = toDevicePixels(viewport.height, dpr);
    const rect = resolved.rect;

    targetCtx.save();
    // Reset to identity so we draw at backing-store pixel coords (1:1 with offscreen).
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    // The blit now OWNS the entity-layer repaint (it replaced renderer.render(),
    // which used to clearRect each frame). The cached bitmap has a transparent
    // background, so drawImage alone would composite over last frame's overlays
    // → ghost trails. Clear the full backing store first.
    targetCtx.clearRect(0, 0, physW, physH);
    targetCtx.drawImage(canvas, rect.dx, rect.dy, rect.dw, rect.dh);
    // Restore caller's DPR transform.
    targetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    targetCtx.restore();

    // Η προβολή απέχει από την άγκυρα ⇒ υπάρχει κάτι να αποκατασταθεί όταν ησυχάσει η όψη.
    const anchor = this.anchor;
    this.idleReraster.sync(anchor !== null && !isSameTransform(anchor, transform));
  }

  dispose(): void {
    this.idleReraster.dispose();
    if (this.offscreenCanvas) canvasBoundsService.clearCache(this.offscreenCanvas);
    this.offscreenCanvas = null;
    this.offscreenRenderer = null;
    this.cacheKey = null;
    this.anchor = null;
  }

  /** `viewport` here is the RASTER viewport (visible size + overscan on both sides). */
  private ensureOffscreen(viewport: Viewport, dpr: number): void {
    const physicalW = toDevicePixels(viewport.width, dpr);
    const physicalH = toDevicePixels(viewport.height, dpr);

    if (
      this.offscreenCanvas &&
      this.offscreenCanvas.width === physicalW &&
      this.offscreenCanvas.height === physicalH &&
      this.offscreenRenderer
    ) {
      return;
    }

    // The replaced canvas keeps a strong entry in the shared bounds cache (Map, not
    // WeakMap) — evict it, or every resize leaks one overscanned backing store.
    if (this.offscreenCanvas) canvasBoundsService.clearCache(this.offscreenCanvas);

    const canvas = document.createElement('canvas');
    canvas.width = physicalW;
    canvas.height = physicalH;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    // Stub getBoundingClientRect for canvasBoundsService (offscreen canvas
    // is detached from the DOM and would otherwise return zero bounds).
    const bounds: DOMRect = {
      x: 0, y: 0, top: 0, left: 0,
      right: viewport.width, bottom: viewport.height,
      width: viewport.width, height: viewport.height,
      toJSON() { return this; },
    } as DOMRect;
    canvas.getBoundingClientRect = () => bounds;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      logger.error('Failed to get 2D context for offscreen bitmap cache');
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.offscreenCanvas = canvas;
    this.offscreenRenderer = new DxfRenderer(canvas);
  }
}

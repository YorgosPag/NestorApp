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
 * ⚠️ This change only ever REMOVES inputs from the key. Adding any interactive state back
 *    in reintroduces the Phase D v1 freeze.
 */

import { DxfRenderer } from './DxfRenderer';
import type { DxfScene, DxfRenderOptions } from './dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import { getDevicePixelRatio, toDevicePixels } from '../../systems/cursor/utils';
// ADR-726 Φ3 — anchored-raster geometry + policy (pure, DOM-free, unit-tested).
import {
  ANCHOR_PROBE_WORLD_POINT,
  IDLE_RERASTER_MS,
  type AnchorTransform,
  type AnchoredBlitRect,
  computeAnchoredBlitRect,
  computeOverscanPx,
  isAnchoredBlitAcceptable,
  isSameTransform,
  magnification,
  overscannedRenderTransform,
  overscannedViewport,
} from './dxf-bitmap-cache-anchor';
// ADR-726 Φ3 — the ONE authority for world→screen (margins + Y-inversion). The projection
// offset is MEASURED through it, never re-derived here: a hand-written copy of this formula
// is exactly what made the raster pan the wrong way vertically.
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
// ADR-726 Φ3 — the offscreen canvas is replaced whenever its size changes; its stubbed
// bounds live in the shared bounds cache and must be evicted with it.
import { canvasBoundsService } from '../../services/CanvasBoundsService';
// 🏢 ADR-344 Phase 11: bitmap cache must invalidate on viewport annotation scale change
import { getActiveScaleName } from '../../systems/viewport/ViewportStore';
// 🏢 ADR-375 Phase B: BIM render settings (drawingScale + viewRange + objectStyles)
//    affect per-entity line weight and cut-state — invalidate when they change.
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
// 🏢 ADR-376 Phase C.2: opening tag style mutations must bust the bitmap cache.
import { getCurrentOpeningTagStyle } from '../../bim/services/opening-tag-style-service';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('DxfBitmapCache');

/** Normal-state render toggles that change the cached pixels (ADR-040 Phase D wiring). */
export type BitmapCacheRenderInputs = Pick<DxfRenderOptions, 'showGrid' | 'showLayerNames' | 'wireframeMode'>;

/**
 * STRUCTURAL cache key — inputs that change the cached PIXELS THEMSELVES.
 * ADR-726 Φ3: the view transform is deliberately absent — it is handled by the anchor
 * projection instead (a transform change re-uses the raster, it does not invalidate it).
 */
interface CacheKey {
  sceneRef: object | null;
  width: number;
  height: number;
  dpr: number;
  /** ADR-344 Phase 11: invalidate cache when viewport annotation scale changes. */
  activeAnnotationScale: string;
  /** ADR-375 Phase B.1: invalidate cache when annotation scale denominator changes. */
  drawingScale: number;
  /** ADR-375 Phase B.2: viewRange/objectStyles hash — JSON snapshot of small structs. */
  bimSettingsHash: string;
  /** ADR-040 Phase D wiring (2026-06-11): wireframe / layer-name / grid toggles
   *  alter the cached normal-state pixels — they arrive via renderOptions, not a
   *  store the cache subscribes to, so they must live in the key. */
  showGrid: boolean;
  showLayerNames: boolean;
  wireframeMode: boolean;
}

function readBimCacheInputs(): { drawingScale: number; bimSettingsHash: string } {
  const s = useBimRenderSettingsStore.getState();
  return {
    drawingScale: s.drawingScale,
    // ADR-452 — `cpa` (cutPlaneActive) busts the cache when the cut-plane hide
    // gate toggles; `viewRange.cutPlaneMm` (in `vr`) covers slider drag.
    // ADR-455 — the vertical X/Y cuts are NOT in this key: the cut-away side is faded by a
    // translucent overlay rect drawn ABOVE the bitmap (axis-cut-line-renderer), not baked
    // into entity pixels, so the bitmap is identical regardless of cut position. The
    // bim-render-settings subscription still marks the canvas dirty → the overlay repaints
    // on drag/flip/toggle without an (expensive) full entity-bitmap rebuild.
    // ADR-449/456 — `fs` (showFinishSkin) + `rebar` (showReinforcement) bust the cache:
    // both overlays are baked into the cached normal-state bitmap (scene-level passes in
    // `DxfRenderer.render`), so toggling them must rebuild it (they arrive via the store the
    // cache does NOT subscribe to — they must live in the key, like the ADR-040 Phase D toggles).
    // ADR-375 — `dxf` (dxfImport: «DXF Σχέδιο» V/G row) busts the cache: visibility +
    // colour + lineweight overrides for every raw DXF entity are baked into the cached
    // normal-state bitmap (DxfRenderer.isEntityLayerSkipped + resolveStyleForRender), so
    // toggling/recolouring/reweighting the imported drawing must rebuild it. Same rule as
    // fs/rebar — a per-view setting that alters normal-state pixels MUST live in the key.
    bimSettingsHash: JSON.stringify({ vr: s.viewRange, cpa: s.cutPlaneActive, os: s.objectStyles, ts: getCurrentOpeningTagStyle(), fs: s.showFinishSkin, rebar: s.showReinforcement, dxf: s.dxfImport }),
  };
}

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
  /** Set by the idle timer; forces ONE rebuild at the settled transform. */
  private rerasterDue = false;
  private idleTimerId: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: DxfBitmapCacheOptions = {}) {}

  /** True when the cache cannot serve this frame and must be rebuilt first. */
  isDirty(
    scene: DxfScene | null,
    transform: ViewTransform,
    viewport: Viewport,
    inputs: BitmapCacheRenderInputs,
  ): boolean {
    if (!this.offscreenCanvas || !this.cacheKey || !this.anchor) return true;
    // ADR-726 Φ3 — the settled-gesture re-raster: one rebuild at the live transform.
    if (this.rerasterDue) return true;
    if (this.isStructurallyStale(scene, viewport, inputs)) return true;
    // Transform drift is NOT staleness: the raster is re-projected while it still
    // covers the viewport sharply enough. Only then does it need rebuilding.
    return !this.canServe(transform, viewport);
  }

  /** Structural key comparison — everything that changes the cached pixels. */
  private isStructurallyStale(
    scene: DxfScene | null,
    viewport: Viewport,
    inputs: BitmapCacheRenderInputs,
  ): boolean {
    const key = this.cacheKey;
    if (!key) return true;
    const { drawingScale, bimSettingsHash } = readBimCacheInputs();
    return (
      key.sceneRef !== scene ||
      key.width !== viewport.width ||
      key.height !== viewport.height ||
      key.dpr !== getDevicePixelRatio() ||
      key.activeAnnotationScale !== getActiveScaleName() ||
      key.drawingScale !== drawingScale ||
      key.bimSettingsHash !== bimSettingsHash ||
      key.showGrid !== !!inputs.showGrid ||
      key.showLayerNames !== !!inputs.showLayerNames ||
      key.wireframeMode !== !!inputs.wireframeMode
    );
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

  /** ADR-726 Φ3 — can the anchored raster still be projected onto `transform`? */
  private canServe(transform: ViewTransform, viewport: Viewport): boolean {
    const key = this.cacheKey;
    const resolved = this.resolveBlit(transform, viewport);
    if (!key || !resolved) return false;
    return isAnchoredBlitAcceptable({
      rect: resolved.rect,
      magnification: resolved.k,
      dpr: key.dpr,
      physW: toDevicePixels(viewport.width, key.dpr),
      physH: toDevicePixels(viewport.height, key.dpr),
    });
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
    this.clearIdleTimer();
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
    this.ensureOffscreen(rasterViewport, dpr);

    if (!this.offscreenRenderer) return;

    try {
      this.offscreenRenderer.render(
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

      const { drawingScale, bimSettingsHash } = readBimCacheInputs();
      this.cacheKey = {
        sceneRef: scene,
        // The VISIBLE viewport — the raster's own (overscanned) size is derived from it.
        width: viewport.width,
        height: viewport.height,
        dpr,
        activeAnnotationScale: getActiveScaleName(),
        drawingScale,
        bimSettingsHash,
        showGrid: !!baseOptions.showGrid,
        showLayerNames: !!baseOptions.showLayerNames,
        wireframeMode: !!baseOptions.wireframeMode,
      };
      this.anchor = { scale: transform.scale, offsetX: transform.offsetX, offsetY: transform.offsetY };
      this.overscanPx = overscanPx;
      // A fresh raster IS the settled state — cancel any pending re-raster (idempotent:
      // rebuilding twice at the same transform leaves exactly this state).
      this.rerasterDue = false;
      this.clearIdleTimer();
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

    this.syncIdleReraster(transform);
  }

  /**
   * Arm (or stand down) the settled-gesture re-raster. Re-armed on every drifted frame,
   * so it fires exactly once — `IDLE_RERASTER_MS` after the gesture actually stops.
   */
  private syncIdleReraster(transform: ViewTransform): void {
    const anchor = this.anchor;
    this.clearIdleTimer();
    if (!anchor || isSameTransform(anchor, transform)) return;
    this.idleTimerId = setTimeout(() => {
      this.idleTimerId = null;
      this.rerasterDue = true;
      this.options.requestRepaint?.();
    }, IDLE_RERASTER_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimerId === null) return;
    clearTimeout(this.idleTimerId);
    this.idleTimerId = null;
  }

  dispose(): void {
    this.clearIdleTimer();
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

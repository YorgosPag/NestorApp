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
 *   - transform.scale / offsetX / offsetY
 *   - viewport size
 *   - device pixel ratio
 *
 * Including hoveredEntityId / selectedEntityIds / gripInteractionState / dragPreview
 * in the cache key WILL cause the cache to invalidate at ~60Hz on hover and
 * trigger a full N-entity rebuild per frame, freezing the page (Phase D v1 incident).
 */

import { DxfRenderer } from './DxfRenderer';
import type { DxfScene, DxfRenderOptions } from './dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import { getDevicePixelRatio, toDevicePixels } from '../../systems/cursor/utils';
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

interface CacheKey {
  sceneRef: object | null;
  scale: number;
  offsetX: number;
  offsetY: number;
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
    bimSettingsHash: JSON.stringify({ vr: s.viewRange, cpa: s.cutPlaneActive, os: s.objectStyles, ts: getCurrentOpeningTagStyle() }),
  };
}

export class DxfBitmapCache {
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenRenderer: DxfRenderer | null = null;
  private cacheKey: CacheKey | null = null;

  /** True when cache content is missing or stale relative to inputs. */
  isDirty(
    scene: DxfScene | null,
    transform: ViewTransform,
    viewport: Viewport,
    inputs: BitmapCacheRenderInputs,
  ): boolean {
    if (!this.offscreenCanvas || !this.cacheKey) return true;

    const dpr = getDevicePixelRatio();
    const activeAnnotationScale = getActiveScaleName();
    const { drawingScale, bimSettingsHash } = readBimCacheInputs();
    return (
      this.cacheKey.sceneRef !== scene ||
      this.cacheKey.scale !== transform.scale ||
      this.cacheKey.offsetX !== transform.offsetX ||
      this.cacheKey.offsetY !== transform.offsetY ||
      this.cacheKey.width !== viewport.width ||
      this.cacheKey.height !== viewport.height ||
      this.cacheKey.dpr !== dpr ||
      this.cacheKey.activeAnnotationScale !== activeAnnotationScale ||
      this.cacheKey.drawingScale !== drawingScale ||
      this.cacheKey.bimSettingsHash !== bimSettingsHash ||
      this.cacheKey.showGrid !== !!inputs.showGrid ||
      this.cacheKey.showLayerNames !== !!inputs.showLayerNames ||
      this.cacheKey.wireframeMode !== !!inputs.wireframeMode
    );
  }

  /**
   * Force the next isDirty() to return true. Used for inputs that affect the
   * cached entity layer but are NOT part of the key — isolate alpha and
   * LayerStore visible/frozen/colour flags, which the renderer reads from their
   * stores at paint time. The renderer subscribes to those stores and calls this.
   */
  invalidate(): void {
    this.cacheKey = null;
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
    this.ensureOffscreen(viewport, dpr);

    if (!this.offscreenRenderer) return;

    try {
      this.offscreenRenderer.render(scene, transform, viewport, {
        showGrid: baseOptions.showGrid,
        showLayerNames: baseOptions.showLayerNames,
        wireframeMode: baseOptions.wireframeMode,
        selectedEntityIds: [],
        hoveredEntityId: null,
        skipInteractive: true,
      });

      const { drawingScale, bimSettingsHash } = readBimCacheInputs();
      this.cacheKey = {
        sceneRef: scene,
        scale: transform.scale,
        offsetX: transform.offsetX,
        offsetY: transform.offsetY,
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
    } catch (error) {
      logger.error('Bitmap cache rebuild failed', { error });
      this.cacheKey = null;
    }
  }

  /**
   * Blit the cached bitmap onto the visible canvas at logical (CSS) coordinates.
   * Caller's ctx is expected to have its DPR transform applied (setupCanvasContext).
   */
  blit(targetCtx: CanvasRenderingContext2D, viewport: Viewport): void {
    if (!this.offscreenCanvas || !this.cacheKey) return;
    const dpr = this.cacheKey.dpr;
    const physW = toDevicePixels(viewport.width, dpr);
    const physH = toDevicePixels(viewport.height, dpr);

    targetCtx.save();
    // Reset to identity so we draw at backing-store pixel coords (1:1 with offscreen).
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    // The blit now OWNS the entity-layer repaint (it replaced renderer.render(),
    // which used to clearRect each frame). The cached bitmap has a transparent
    // background, so drawImage alone would composite over last frame's overlays
    // → ghost trails. Clear the full backing store first.
    targetCtx.clearRect(0, 0, physW, physH);
    targetCtx.drawImage(this.offscreenCanvas, 0, 0, physW, physH);
    // Restore caller's DPR transform.
    targetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    targetCtx.restore();
  }

  dispose(): void {
    this.offscreenCanvas = null;
    this.offscreenRenderer = null;
    this.cacheKey = null;
  }

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

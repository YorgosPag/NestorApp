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
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('DxfBitmapCache');

interface CacheKey {
  sceneRef: object | null;
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  dpr: number;
}

export class DxfBitmapCache {
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenRenderer: DxfRenderer | null = null;
  private cacheKey: CacheKey | null = null;

  /** True when cache content is missing or stale relative to inputs. */
  isDirty(scene: DxfScene | null, transform: ViewTransform, viewport: Viewport): boolean {
    if (!this.offscreenCanvas || !this.cacheKey) return true;

    const dpr = getDevicePixelRatio();
    return (
      this.cacheKey.sceneRef !== scene ||
      this.cacheKey.scale !== transform.scale ||
      this.cacheKey.offsetX !== transform.offsetX ||
      this.cacheKey.offsetY !== transform.offsetY ||
      this.cacheKey.width !== viewport.width ||
      this.cacheKey.height !== viewport.height ||
      this.cacheKey.dpr !== dpr
    );
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

      this.cacheKey = {
        sceneRef: scene,
        scale: transform.scale,
        offsetX: transform.offsetX,
        offsetY: transform.offsetY,
        width: viewport.width,
        height: viewport.height,
        dpr,
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

    targetCtx.save();
    // Reset to identity so we draw at backing-store pixel coords (1:1 with offscreen).
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    targetCtx.drawImage(
      this.offscreenCanvas,
      0, 0,
      toDevicePixels(viewport.width, dpr),
      toDevicePixels(viewport.height, dpr),
    );
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

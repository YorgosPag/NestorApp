/**
 * transform-ghost-matrix-cache.ts — O(1)/frame matrix ghost cache + runner (ADR-646 Φάση 6).
 *
 * PROBLEM (CODE=SoT): the live transform ghost (`useTransformGhostPreview` → `useScalePreview`)
 * re-ran a FULL per-entity geometry transform + REAL entity render (`drawRealEntityPreview`: model
 * build + style resolve + composite) for EVERY selected entity on EVERY drag frame. At thousands of
 * selected entities that is O(N) heavy renders per frame → main-thread freeze (the same O(N)/frame
 * trap ADR-040 forbids on the main canvas). Φάση 5's LOD/cap only bounded it, still froze at extreme
 * scale.
 *
 * SOLUTION (Figma/Illustrator/AutoCAD/Revit/C4D — and the SAME philosophy as ADR-516 `DxfBackdropCache`
 * + ADR-040 bitmap-under-matrix): render the selection's ghost ONCE into an offscreen raster at drag
 * start, then every frame apply ONE affine matrix (`ctx.transform` + `drawImage`) → constant cost per
 * frame, independent of entity count. The real per-entity bake still happens only on commit
 * (`ScaleEntityCommand`, unchanged). Stretch (per-vertex) is NOT affine → it stays on the legacy
 * `renderCopies` path (this module is never engaged for it).
 *
 * This file holds the DOM cache class (mirroring `DxfBackdropCache`'s arm/capture/blit shape) + the
 * per-tool opt-in config + the frame runner. The PURE affine math lives in `./transform-ghost-matrix`
 * (re-exported here) so it stays unit-testable without loading the real-render stack.
 *
 * @see hooks/tools/transform-ghost-matrix — pure affine math (jest-tested)
 * @see bim-3d/scene/dxf-backdrop-cache — ADR-516 "render once, blit under transform" (WebGL sibling)
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { SceneLayer } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { BimPreviewRenderer } from '../../canvas-v2/preview-canvas/bim-preview-render';
import { drawRealEntityPreview } from '../../rendering/ghost/draw-real-entity-preview';
// ADR-646 Φ.5 SSoT — the selection's UNSCALED union bbox (reused, not re-implemented) drives the rect.
import { computeUnionBBox } from '../../systems/scale/scale-preview-lod';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
import {
  type Affine2x3,
  type CaptureRect,
  composeAffine,
  worldToScreenAffine,
  offscreenToWorldAffine,
  captureRectFromBBox,
  buildCaptureTransform,
  MATRIX_GHOST_MARGIN_PX,
  MATRIX_GHOST_MAX_CSS,
} from './transform-ghost-matrix';

// Re-export the pure math so consumers have a single entry point.
export {
  type Affine2x3,
  type CaptureRect,
  composeAffine,
  scaleAboutBaseWorldAffine,
  worldToScreenAffine,
  offscreenToWorldAffine,
  captureRectFromBBox,
  buildCaptureTransform,
  MATRIX_GHOST_MARGIN_PX,
  MATRIX_GHOST_MAX_CSS,
} from './transform-ghost-matrix';

/** True when two base points coincide (value equality — a fresh drag re-uses the raster if unchanged). */
function samePoint(a: Point2D | null, b: Point2D | null): boolean {
  return !!a && !!b && a.x === b.x && a.y === b.y;
}

/**
 * Offscreen ghost cache — mirrors `DxfBackdropCache` (ADR-516): capture the static selection ONCE, then
 * blit it under one affine per frame. Holds a single offscreen `HTMLCanvasElement` + a `BimPreviewRenderer`
 * bound to its ctx. Never engaged for per-vertex tools (stretch) — only for affine transforms.
 */
export class TransformGhostMatrixCache {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: BimPreviewRenderer | null = null;
  private rect: CaptureRect | null = null;
  private captureScale = 0;
  private ids: readonly string[] | null = null;
  private basePoint: Point2D | null = null;

  /**
   * True when the current raster already matches this selection + base → reuse it. Deliberately does
   * NOT compare the live zoom: the raster is captured at the drag-start zoom and reused for the whole
   * drag (blit re-derives position from the LIVE transform), so a wheel-zoom mid-drag never forces an
   * O(N) re-capture — it only trades a little sharpness (Figma/Revit-grade).
   */
  matches(ids: readonly string[], basePoint: Point2D): boolean {
    return this.ids === ids && samePoint(this.basePoint, basePoint) && this.canvas !== null;
  }

  /**
   * Render every selected entity UNSCALED into the offscreen raster ONCE. Returns `false` (→ caller
   * falls back to LOD) when the selection has no finite bbox or the rect exceeds the memory cap.
   */
  capture(
    ids: readonly string[],
    basePoint: Point2D,
    scale0: number,
    getEntity: (id: string) => DxfEntityUnion | null,
    layers: Record<string, SceneLayer> | undefined,
  ): boolean {
    const bbox = computeUnionBBox(ids, getEntity);
    if (!bbox) return false;
    const rect = captureRectFromBBox(bbox, scale0, MATRIX_GHOST_MARGIN_PX, MATRIX_GHOST_MAX_CSS);
    if (!rect) return false;

    const dpr = getDevicePixelRatio();
    const ctx = this.ensureCanvas(rect.wCss, rect.hCss, dpr);
    if (!ctx) return false;
    const { transform, viewport } = buildCaptureTransform(rect, scale0);
    for (const id of ids) {
      const entity = getEntity(id);
      if (entity) drawRealEntityPreview(this.renderer!, entity, layers, transform, viewport);
    }
    this.rect = rect;
    this.captureScale = scale0;
    this.ids = ids;
    this.basePoint = basePoint;
    return true;
  }

  /** Blit the cached raster under `worldAffine` composed with the LIVE current transform (O(1)). */
  blit(ctx: CanvasRenderingContext2D, worldAffine: Affine2x3, current: ViewTransform, viewport: Viewport): void {
    if (!this.canvas || !this.rect) return;
    const toScreen = worldToScreenAffine(current, viewport);
    const fromPx = offscreenToWorldAffine(this.rect, this.captureScale);
    const m = composeAffine(toScreen, composeAffine(worldAffine, fromPx));
    // The preview ctx is already DPR-scaled (`clearCanvasDpr` → setTransform(dpr,dpr)); `transform`
    // multiplies onto it, so the CSS-px matrix `m` composes with the DPR scale — never overwrites it.
    ctx.save();
    ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.drawImage(this.canvas, 0, 0, this.rect.wCss, this.rect.hCss);
    ctx.restore();
  }

  /** Release the offscreen raster (unmount). */
  dispose(): void {
    this.canvas = null;
    this.renderer = null;
    this.rect = null;
    this.ids = null;
    this.basePoint = null;
    this.captureScale = 0;
  }

  /** Lazily (re)allocate the offscreen at the DPR backing size and return a cleared, DPR-scaled ctx. */
  private ensureCanvas(wCss: number, hCss: number, dpr: number): CanvasRenderingContext2D | null {
    const wDev = Math.max(1, Math.round(wCss * dpr));
    const hDev = Math.max(1, Math.round(hCss * dpr));
    if (!this.canvas) this.canvas = document.createElement('canvas');
    if (this.canvas.width !== wDev || this.canvas.height !== hDev) {
      this.canvas.width = wDev;
      this.canvas.height = hDev;
      this.renderer = null; // ctx identity changes with the backing store → rebind the renderer
    }
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return null;
    if (!this.renderer) this.renderer = new BimPreviewRenderer(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, wDev, hDev);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
}

/**
 * Per-tool opt-in for the matrix-ghost path. A tool that is a pure affine-about-base transform
 * (scale / move / rotate / mirror) supplies its selection ids + the per-frame world affine; the shared
 * primitive then renders once + blits under one matrix. Returning `null` from `getWorldAffine` (or
 * omitting `matrixGhost` entirely, e.g. per-vertex stretch) keeps the tool on the legacy `renderCopies`.
 */
export interface MatrixGhostConfig<S> {
  readonly getIds: (state: S) => readonly string[];
  readonly getWorldAffine: (state: S, cursor: Point2D, basePoint: Point2D) => Affine2x3 | null;
}

/** Everything the shared primitive hands into one matrix-ghost frame. */
export interface MatrixGhostFrame<S> {
  readonly ctx: CanvasRenderingContext2D;
  readonly state: S;
  readonly cursor: Point2D;
  readonly basePoint: Point2D;
  readonly current: ViewTransform;
  readonly viewport: Viewport;
  readonly getEntity: (id: string) => DxfEntityUnion | null;
  readonly layers: Record<string, SceneLayer> | undefined;
  readonly config: MatrixGhostConfig<S>;
}

/**
 * Drive one matrix-ghost frame. Returns `true` when the raster path fully handled the draw; `false`
 * (→ caller falls back to `renderCopies`) when the tool opts out this frame or the selection cannot be
 * rastered (no finite bbox / oversize → Φ.5 LOD). Capture happens ONCE per (selection, base); every
 * later frame is a single blit.
 */
export function runMatrixGhost<S>(cache: TransformGhostMatrixCache, frame: MatrixGhostFrame<S>): boolean {
  const { config, state, cursor, basePoint } = frame;
  const worldAffine = config.getWorldAffine(state, cursor, basePoint);
  if (!worldAffine) return false;
  const ids = config.getIds(state);
  if (ids.length === 0) return false;
  if (!cache.matches(ids, basePoint)) {
    if (!cache.capture(ids, basePoint, frame.current.scale, frame.getEntity, frame.layers)) return false;
  }
  cache.blit(frame.ctx, worldAffine, frame.current, frame.viewport);
  return true;
}
